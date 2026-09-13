import { Injectable } from "@nestjs/common";
import { contracts } from "@repo/contracts";
import { AuthContextType } from "../auth-core/decorators/authcontext.decorator.js";
import { AuthenticatedUserType } from "../auth-core/decorators/index.js";
import { AuthService } from "../auth/auth.service.js";
import { DrizzleService } from "../drizzle/drizzle.service.js";
import { AppJwtService } from "../jwt/jwt.service.js";
import { VerifyService } from "../verify/verify.service.js";
import { db } from "@repo/db";
import { and, eq, inArray } from "drizzle-orm";
import { Exception } from "../../shared/lib/exception.js";
import { lib } from "@repo/lib";

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly jwtService: AppJwtService,
    private readonly authService: AuthService,
    private readonly verifyService: VerifyService,
  ) {}

  async connectionCode(body: contracts.connections.Code) {
    // getting the email
    const connection = await this.drizzleService.db.query.connections_group.findFirst({
      where: eq(db.connections.id, body.connectionId),
      with: {
        users: true,
      },
    });

    if (!connection) {
      throw Exception.notFound("NOT_FOUND", "connection not found.");
    }

    await this.verifyService.issueCode({
      type: "owner_connect",
      email: connection.users.email,
    });

    return true;
  }

  async connectionLogin(
    body: contracts.connections.Login,
    ctx: AuthContextType,
    authenticatedUser: AuthenticatedUserType,
  ) {
    // validating and getting the connection
    const foundConnection = await this.drizzleService.db.query.connections.findFirst({
      where: eq(db.connections.id, body.connectionId),
      with: {
        users: true,
      },
    });

    if (!foundConnection) {
      throw Exception.notFound("NOT_FOUND", "connection not found.");
    }

    // deleting the old session
    await this.drizzleService.db.delete(db.auth_sessions).where(eq(db.auth_sessions.id, authenticatedUser.session.id));

    // tokens + session issuing
    const { accessToken, refreshToken, session } = await this.jwtService.issueAuthData({
      userId: foundConnection.users.id,
      ctx,
      config: { createGroup: false },
    });

    const { users: user, ...connection } = foundConnection;
    return { accessToken, refreshToken, connection, user, session };
  }

  /**
   * gets all the currently connected auth sessions in groups
   * @param id of the user
   * @returns sessions categorized by its connection (id + title + emoji)
   */
  async connections(userId: string) {
    // getting the connection ids
    const groupIds = await this.drizzleService.db.query.connections.findMany({
      where: eq(db.connections.user_id, userId),
      columns: {
        group_id: true,
      },
    });

    // getting the sessions
    const connected = await this.drizzleService.db.query.connections_group.findMany({
      where: inArray(
        db.connections_group.id,
        groupIds.map(({ group_id }) => group_id),
      ),
      with: {
        connections: {
          with: {
            users: true,
          },
        },
      },
    });

    return connected;
  }

  /**
   * adds the user for a connection
   * @param email email address
   * @param password secure password
   * @param code code that was sent to email (use /code/)
   * @param groupId id of the group
   * @param connectionId optional id of the connection
   * @returns authentication tokens, user and a session
   */
  async connectionAdd(body: contracts.connections.Add) {
    const { user } = await this.authService.loginVerify({
      password: body.password,
      code: body.code,
      email: body.email,
    });

    const { connection } = await this.connectionCreate({
      groupId: body.groupId,
      userId: user.id,
      connectionId: body.connectionId ?? lib.id.create(),
    });

    return { user, connection };
  }

  /**
   * creates a group that can link multiple sessions
   * @param title required title
   * @param emoji optional emoji
   * @returns group
   */
  async connectionCreate(body: contracts.connections.Create) {
    // checking if the connection already exists
    const isFound = await this.drizzleService.db.query.connections.findFirst({
      where: and(eq(db.connections.user_id, body.userId), eq(db.connections.group_id, body.groupId)),
    });

    if (isFound) {
      throw Exception.conflict("USER_ALREADY_EXISTS", "connection already exists.");
    }

    // creating the connection
    const [connection] = await this.drizzleService.db
      .insert(db.connections)
      .values({
        id: body.connectionId ?? lib.id.create(),
        user_id: body.userId,
        group_id: body.groupId,
      })
      .returning();

    if (!connection) {
      throw Exception.internalServerError("INTERNAL_ERROR", "failed creating the connection");
    }

    return { connection };
  }

  /**
   * deletes the connection by its id (have to be an owner)
   * @param connectionId id of the connection to delete
   * @returns
   */
  async connectionDelete(body: contracts.connections.Delete) {
    const [connection] = await this.drizzleService.db
      .delete(db.connections)
      .where(eq(db.connections.id, body.connectionId))
      .returning();

    if (!connection) {
      throw Exception.notFound("NOT_FOUND", "connection not found.");
    }

    return connection;
  }

  /**
   * creates a group that can link multiple sessions
   * @param title required title
   * @param emoji optional emoji
   * @returns group
   */
  async groupAdd(body: contracts.connectionGroups.Create, user: AuthenticatedUserType) {
    // group
    const [group] = await this.drizzleService.db
      .insert(db.connections_group)
      .values({
        id: body.groupId ?? lib.id.create(),
        owner_user_id: user.id,
        title: body.title,
        emoji: body.emoji,
      })
      .returning();

    if (!group) {
      throw Exception.conflict("INTERNAL_ERROR", "failed creating the group");
    }

    // connection
    const [connection] = await this.drizzleService.db
      .insert(db.connections)
      .values({
        id: body.connectionId ?? lib.id.create(),
        user_id: user.id,
        group_id: group.id,
      })
      .returning();

    if (!connection) {
      throw Exception.conflict("INTERNAL_ERROR", "failed creating the connection");
    }

    return { group, connection };
  }

  /**
   * edits the group (works only if you're the owner)
   * @param groupId id of the group
   * @param title title
   * @param emoji emoji
   * @returns updated group
   */
  async groupEdit(body: contracts.connectionGroups.Edit) {
    const [group] = await this.drizzleService.db
      .update(db.connections_group)
      .set({
        title: body.title,
        emoji: body.emoji,
        edited_at: new Date(),
      })
      .where(eq(db.connections_group.id, body.groupId))
      .returning();

    if (!group) {
      throw Exception.conflict("INTERNAL_ERROR", "failed creating the group");
    }

    return group;
  }

  /**
   * deletes a group (works only if you're the owner)
   * @param groupId id of the group
   * @returns deleted group
   */
  async groupDelete(body: contracts.connectionGroups.Delete) {
    const [group] = await this.drizzleService.db
      .delete(db.connections_group)
      .where(eq(db.connections_group.id, body.groupId))
      .returning();

    if (!group) {
      throw Exception.conflict("INTERNAL_ERROR", "failed creating the group");
    }

    return group;
  }
}
