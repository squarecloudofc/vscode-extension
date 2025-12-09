export class Constant<const T extends string, const U extends string> {
  public readonly value: `${U}.${T}`;

  /**
   * Constructs a new instance of the Constant class.
   *
   * @param name - The name of the constant.
   * @param id - The ID of the constant.
   */
  constructor(
    public readonly name: T,
    public readonly id: U,
  ) {
    this.value = `${id}.${name}`;
  }

  toString() {
    return this.value;
  }
}
