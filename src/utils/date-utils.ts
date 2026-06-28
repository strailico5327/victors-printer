export function formatDateForDisplay(date: Date): string {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${day}/${month}/${date.getFullYear()}`;
}

export function formatDateToISODate(date: Date): string {
	return date.toISOString().substring(0, 10);
}
