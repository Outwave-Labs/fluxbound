import { Avatar, Style } from "@dicebear/core";
import definition from "@dicebear/styles/identicon.json" with { type: "json" };

import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { DrizzleService } from "../drizzle/drizzle.service.js";
import { contracts } from "@repo/contracts";
import { db } from "@repo/db";
import { eq, like } from "drizzle-orm";
import { Exception } from "../../shared/lib/exception.js";
import { lib } from "@repo/lib";

@Injectable()
export class UserService {
  constructor(private readonly drizzleService: DrizzleService) {}

  /**
   * generates a safe username out of email that hasn't been taken
   * @param body email
   * @returns generated username
   */
  async generateUsername(body: contracts.user.Create["email"]) {
    // normalizing
    const username = body.split("@")[0] ?? "";
    const normalizedUsername = lib.strings.normalize(username);

    // not eixsting - return generated
    if (!(await this.drizzleService.db.query.users.findFirst({ where: eq(db.users.username, normalizedUsername) }))) {
      return normalizedUsername;
    }

    // eixsting - find all

    const existing = await this.drizzleService.db.query.users.findMany({
      where: like(db.users.username, `${normalizedUsername}%`),
      columns: {
        username: true,
      },
    });

    // 64 attempts to generate a new username
    const taken = new Set(existing.map(({ username }) => username));

    for (let i = 0; i < 64; ++i) {
      const candidate = `${normalizedUsername}${lib.id.create()}`;

      if (!taken.has(candidate)) {
        return candidate;
      }
    }

    // rare fallback
    return `${normalizedUsername}${Date.now()}`;
  }

  /**`
   * creates a new user (hashes the password)
   * @param email email address
   * @param password raw password
   * @returns user object, throws if email already taken
   */
  async create(body: contracts.user.Create) {
    // check if user already exists
    const isFound = await this.drizzleService.db.query.users.findFirst({
      where: eq(db.users.email, body.email),
    });

    if (isFound) {
      throw Exception.conflict("USER_ALREADY_EXISTS", "email is already taken.");
    }

    // password (optional hashing)
    let password = null;

    if (body.password) {
      const salt = await bcrypt.genSalt(10);
      password = await bcrypt.hash(body.password, salt);
    }

    // cosmetics
    const color = lib.random.hex();
    const style = new Style(definition);
    const avatar = new Avatar(style, {
      seed: body.email,
      rowColor: color,
    });

    // username
    const username = lib.strings.normalize(body.username ?? "") || (await this.generateUsername(body.email));

    // creating the user
    const [user] = await this.drizzleService.db
      .insert(db.users)
      .values({
        id: body.userId ?? lib.id.create(),
        username,
        email: body.email,
        password,
        color,
        image_url: avatar.toDataUri(),
      })
      .returning();

    if (!user) {
      throw Exception.internalServerError("INTERNAL_ERROR", "failed creating the user");
    }

    return user;
  }

  /**
   * deletes the user
   * @param key key (id or email)
   * @returns deleted user
   */
  async delete(body: contracts.user.Delete) {
    const [user] = await this.drizzleService.db.delete(db.users).where(eq(db.users.id, body.userId)).returning();

    if (!user) {
      throw Exception.internalServerError("INTERNAL_ERROR", "failed deleting the user.");
    }

    return user;
  }

  /**
   * edits the user
   * @param body body
   * @returns edited user
   */
  async edit(body: contracts.user.Edit) {
    const { userId, ...fields } = body;

    const [user] = await this.drizzleService.db.update(db.users).set(fields).where(eq(db.users.id, userId)).returning();

    if (!user) {
      throw Exception.internalServerError("INTERNAL_ERROR", "failed updating the user");
    }

    return user;
  }

  /**
   * gets the user by id
   * @param params params with id
   * @returns user
   */
  async get(params: contracts.user.Get) {
    const user = await this.drizzleService.db.query.users.findFirst({
      where: eq(db.users.id, params.userId),
    });

    return user;
  }

  /**
   * gets the user by username
   * @param params params with username
   * @returns user
   */
  async getByUsername(params: contracts.user.GetByUsername) {
    const user = await this.drizzleService.db.query.users.findFirst({
      where: eq(db.users.username, params.username),
    });

    return user;
  }
}
