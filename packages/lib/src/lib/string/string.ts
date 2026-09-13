export class strings {
  /**
   * normalizes the string and replaces all not [a-z0-9] symbols with underscores
   * @param local string to normalize
   * @param char symbol to replace
   * @returns normalized string, with a-z0-9 symbols.
   */
  static normalize = (local: string, char: string = "_") => {
    const splitted = local.split("+")[0];

    if (!splitted) {
      return "";
    }

    return splitted
      .toLowerCase()
      .replace(/[^a-z0-9]/g, char)
      .replace(/_+/g, char)
      .replace(/^_+|_+$/g, "");
  };
}
