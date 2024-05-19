export class Constant<const T extends string, const U extends string> {
	constructor(
		public readonly name: T,
		public readonly id: U,
	) {}

	toString() {
		return `${this.id}.${this.name}` as const;
	}
}
