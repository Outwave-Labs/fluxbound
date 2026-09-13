import { customAlphabet } from "nanoid";
import z from "zod";

/**
 * centralized secured id generator
 */
export class id {
  /**
   * config
   */
  private static config = {
    length: 30,
    alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  };

  /**
   * schema to validate
   */
  private static schema = z.string().superRefine((id, ctx) => {
    return this.validate(id, ctx);
  });

  /**
   * validates the id and adds errors to the zod context
   * @param id id to be validated
   * @param ctx zod context to add errors
   */
  private static validate = (id: string, ctx: z.z.core.$RefinementCtx<string>) => {
    // type
    if (typeof id !== "string") {
      ctx.addIssue({
        code: "invalid_type",
        expected: "string",
        input: id,
      });
    }

    // length
    if (id.length !== this.config.length) {
      ctx.addIssue({
        code: "custom",
        message: "id must be 25 characters long",
        input: id,
      });
    }

    // alphabet
    const invalid = Array.from(id).some((char) => !this.config.alphabet.includes(char));
    if (invalid) {
      ctx.addIssue({
        code: "custom",
        message: "id must only contain letters and numbers",
        input: id,
      });
    }
  };

  /**
   * creates a centralized id for the application
   * @returns created id
   */
  static create() {
    return customAlphabet(this.config.alphabet, this.config.length)();
  }

  /**
   * create a specified amount of ids
   * @param count how many ids to create
   * @returns created ids
   */
  static createMany(count: number) {
    return Array.from({ length: count }, () => this.create());
  }

  /**
   * determines whether the id is valid specified by our config
   * @param id id
   * @returns boolean whether the id is valid
   */
  static isValid(id: string) {
    return this.schema.safeParse(id).success;
  }
}
