import { Injectable } from "@nestjs/common";
import { contracts } from "@repo/contracts";
import { DrizzleService } from "../drizzle/drizzle.service.js";
import { generateVerificationEmail } from "../mail/lib/constants.js";
import { MailService } from "../mail/mail.service.js";
import { lib } from "@repo/lib";
import { db } from "@repo/db";
import { and, eq, gte } from "drizzle-orm";
import { Exception } from "../../shared/lib/exception.js";
import { config } from "@repo/config";

@Injectable()
export class VerifyService {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly mailService: MailService,
  ) {}

  /**
   * create and send via email verification code
   * @param email email address to send it to
   * @param type verification code type
   * @returns created code
   */
  async issueCode(params: Pick<contracts.auth.Code, "email" | "type">) {
    const [code] = await this.drizzleService.db
      .insert(db.verification_codes)
      .values({
        id: lib.id.create(),
        code: lib.random.string(config.auth.code.length, "0123456789"),
        email: params.email,
        type: params.type,
        expiry_at: new Date(Date.now() + config.auth.code.expiryMs),
      })
      .returning();

    if (!code) {
      throw Exception.internalServerError("INTERNAL_ERROR", "failed creating the verification code.");
    }

    // send it via email
    await this.mailService.send({
      to: params.email,
      html: generateVerificationEmail(code.code),
      subject: `Verification code`,
    });

    return code;
  }

  /**
   * validates a code and throws if invalid (auto cleans it)
   * @param email the email the code was sent to
   * @param type the type of the code
   * @param code the code to validate
   * @param cleanup whether to clean up the code after the verification
   * @returns code or thrown error
   */
  async validateCode(params: { email: string; code: string; type: db.VerificationCodes["type"]; cleanup?: boolean }) {
    const status = await this.drizzleService.db.query.verification_codes.findFirst({
      where: and(
        eq(db.verification_codes.email, params.email),
        eq(db.verification_codes.type, params.type),
        eq(db.verification_codes.code, params.code),
        gte(db.verification_codes.expiry_at, new Date()),
      ),
    });

    // verification
    if (!status) {
      throw Exception.unauthorized("INVALID_VERIFICATION_CODE", "verification code could not be verified.");
    }

    // auto-cleanup
    if (params.cleanup !== false) {
      this.cleanupCodes({ email: params.email, type: params.type });
    }

    return status;
  }

  /**
   * cleans up the codes for a specific email
   * @param email the email the code was sent to
   * @param type the type of the code
   * @returns deleted codes or null if not found
   */
  async cleanupCodes(params: { email: string; type?: db.VerificationCodes["type"] }) {
    // do codes exist?
    const isFound = await this.drizzleService.db.query.verification_codes.findFirst({
      where: and(
        eq(db.verification_codes.email, params.email),
        params.type ? eq(db.verification_codes.type, params.type) : undefined,
      ),
    });

    if (!isFound) {
      return null;
    }

    const [deleted] = await this.drizzleService.db
      .delete(db.verification_codes)
      .where(
        and(
          eq(db.verification_codes.email, params.email),
          params.type ? eq(db.verification_codes.type, params.type) : undefined,
        ),
      )
      .returning();

    if (!deleted) {
      throw Exception.internalServerError("INTERNAL_ERROR", "failed deleting the verification codes.");
    }

    return deleted;
  }
}
