export class Constant {
	constructor(
		public readonly name: string,
		public readonly id: string,
	) {}

	toString() {
		return `${this.id}.${this.name}`;
	}
}
