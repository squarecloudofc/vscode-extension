export class Constant<const T extends string, const U extends string> {
	/**
	 * Constructs a new instance of the Constant class.
	 *
	 * @param name - The name of the constant.
	 * @param id - The ID of the constant.
	 */
	constructor(
		public readonly name: T,
		public readonly id: U,
	) {}

	toString() {
		return `${this.id}.${this.name}` as const;
	}
}
