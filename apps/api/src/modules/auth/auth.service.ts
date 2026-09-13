import { Injectable } from "@nestjs/common";
import { contracts } from "@repo/contracts";
import bcrypt from "bcryptjs";
import { AuthContextType } from "../auth-core/decorators/authcontext.decorator.js";
import { DrizzleService } from "../drizzle/drizzle.service.js";
import { VerifyService } from "../verify/verify.service.js";
import { AppJwtService } from "../jwt/jwt.service.js";
import { UserService } from "../user/user.service.js";
import { eq } from "drizzle-orm";
import { Exception } from "../../shared/lib/exception.js";
import { db } from "@repo/db";

@Injectable()
export class AuthService {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly verifyService: VerifyService,
    private readonly jwtService: AppJwtService,
    private readonly userService: UserService,
  ) {}

  /**
   * validates and sends an authentication code via email
   * @param email email to issue the code to
   * @returns newly generated code (also sent to email) if validated
   */
  async code(body: contracts.auth.Code) {
    const [exists = null] = await this.drizzleService.db.select().from(db.users).where(eq(db.users.email, body.email));
    switch (body.type) {
      case "signup": {
        // does the user exist?
        if (exists) {
          throw Exception.conflict("USER_ALREADY_EXISTS", "email is already taken.");
        }

        break;
      }
      default: {
        // does the eamil exist?
        if (!exists) {
          throw Exception.notFound("USER_NOT_FOUND", "email does not exist.");
        }

        break;
      }
    }

    // issuing the code
    const code = await this.verifyService.issueCode(body);
    return code;
  }

  /**
   * signs the user up
   * @param email email address
   * @param password secure password
   * @param code code that was sent to email (use /code/)
   * @returns user object
   */
  async signup(body: contracts.auth.Signup) {
    // verifying the code
    await this.verifyService.validateCode({
      email: body.email,
      type: "signup",
      code: body.code,
    });

    // creating the user
    const user = await this.userService.create({
      email: body.email,
      password: body.password,
    });

    return user;
  }

  /**
   * validates the login (does not create anything, pure function)
   */
  async loginVerify(body: contracts.auth.Login) {
    // verifying the code
    await this.verifyService.validateCode({
      email: body.email,
      type: "login",
      code: body.code,
    });

    // does the user already exist?
    const [user = null] = await this.drizzleService.db.select().from(db.users).where(eq(db.users.email, body.email));

    if (!user?.password) {
      throw Exception.notFound("USER_NOT_FOUND", "user does not exist.");
    }

    // do password hashes match?
    const isPasswordCorrect = await bcrypt.compare(body.password, user.password);

    if (!isPasswordCorrect) {
      throw Exception.unauthorized("INVALID_CREDENTIALS", "either password or email are incorrect.");
    }

    return { user };
  }

  /**
   * authenticates the user.
   * @param email email address
   * @param password secure password
   * @param code code that was sent to email (use /code/)
   * @returns authentication tokens, user and a session
   */
  async login(body: contracts.auth.Login, ctx: AuthContextType) {
    const { user } = await this.loginVerify(body);

    // issuing tokens + auth session
    const { accessToken, refreshToken, session } = await this.jwtService.issueAuthData({
      userId: user.id,
      ctx,
    });

    return {
      user,
      accessToken,
      refreshToken,
      session,
    };
  }

  /**
   * changes the password
   * @param email email address (required)
   * @param password password (required, will be hashed)
   * @param code (secondary, used to verify)
   * @returns new user object
   */
  async forgotPassword(body: contracts.auth.ForgotPassword) {
    // throw if email does not exist
    if (
      !(await this.drizzleService.db.query.users.findFirst({
        where: eq(db.users.email, body.email),
      }))
    ) {
      throw Exception.notFound("USER_NOT_FOUND", "user with that email does not exist.");
    }

    // verifying the code
    await this.verifyService.validateCode({
      email: body.email,
      type: "forgot_password",
      code: body.code,
    });

    // hashing the new password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(body.password, salt);

    // changing user's data
    const [user] = await this.drizzleService.db
      .update(db.users)
      .set({ password: hash })
      .where(eq(db.users.email, body.email))
      .returning();

    return user!;
  }

  /**
   * logs out a specific session id, deleting the session
   * @param sessionId id of the session to be deleted
   * @returns succesful log out should return a session
   */
  async logout(sessionId: string) {
    // check if it exists at all
    const isFound = await this.drizzleService.db.query.auth_sessions.findFirst({
      where: eq(db.auth_sessions.id, sessionId),
    });

    if (!isFound) {
      throw Exception.unauthorized("UNAUTHORIZED", "session not found.");
    }

    // deleting the session
    const [session = null] = await this.drizzleService.db
      .delete(db.auth_sessions)
      .where(eq(db.auth_sessions.id, sessionId))
      .returning();

    return session;
  }
}
