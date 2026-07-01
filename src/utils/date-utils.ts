export function formatDateForDisplay(date: Date): string {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${day}/${month}/${date.getFullYear()}`;
}

export function formatTimeForDisplay(date: Date): string {
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function hasKnownTime(entryId: string): boolean {
	return !/(?:^|\/)\d{6}(?:\d{2})?x{4}-[a-z0-9]{8}(?:\.md)?$/.test(entryId);
}

export function formatDateTimeForDisplay(date: Date, entryId: string): string {
	const dateLabel = formatDateForDisplay(date);
	return hasKnownTime(entryId) ? `${dateLabel} ${formatTimeForDisplay(date)}` : dateLabel;
}

export function formatDateToISODate(date: Date): string {
	return date.toISOString().substring(0, 10);
}
