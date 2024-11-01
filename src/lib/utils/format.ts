export function formatMB(ram: number, hideMb?: boolean) {
	const formatted = Intl.NumberFormat("pt-BR", {
		style: "unit",
		unit: "megabyte",
		unitDisplay: "short",
	}).format(ram);

	return formatted.replace(" MB", hideMb ? "" : "MB");
}
