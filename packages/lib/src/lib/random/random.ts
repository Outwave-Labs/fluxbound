import { GROUP_EMOJIS } from "./emojis.js";

export class random {
  /**
   * generates a random number within a specified range
   * @param min start value of the range
   * @param max end value of the range
   * @returns random number within that range
   */
  static range = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  /**
   * generates a random string
   * @param length length of the random string
   * @param characters (optional) characters to get random string from
   * @returns random string
   */
  static string = (length: number, characters?: string) => {
    const chars = characters ?? "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    return Array.from({ length }, () => this.range(0, chars.length - 1)).join("");
  };

  /**
   * generates a random hex color with # at the beginning
   * @returns hex color
   */
  static hex = () => {
    return (
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")
    );
  };

  /**
   * returns a random element in the array
   * @param array array to get an element from
   * @returns a random element
   */
  static element = <T>(array: T[]) => {
    if (!array.length) {
      return null;
    }

    return array[this.range(0, array.length - 1)] ?? null;
  };

  /**
   * picks a random emoji for a group
   * @returns random emoji
   */
  static groupEmoji = () => {
    return this.element(GROUP_EMOJIS) as string;
  };
}
