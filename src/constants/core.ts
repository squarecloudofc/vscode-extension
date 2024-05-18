export const EXTENSION_ID = "squarecloud";

export function constant<const T extends string, const U extends string>(
	name: T,
	id: U,
) {
	return {
		name,
		toString: () => `${id}.${name}` as const,
	} as const;
}
