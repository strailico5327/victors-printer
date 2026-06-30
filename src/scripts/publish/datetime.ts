export const datetimeDigitIndexes = [0, 1, 3, 4, 6, 7, 8, 9, 11, 12, 14, 15];
export const datetimeMask = "00/00/0000 00:00";

export function pad(value: number): string {
	return String(value).padStart(2, "0");
}

export function datetimeValue(date = new Date()): string {
	return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function datetimeToIso(value: string): string {
	const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
	if (!match) {
		throw new Error("invalid_datetime");
	}
	const [, day, month, year, hour, minute] = match;
	const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0);
	const offsetMinutes = -date.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const absOffset = Math.abs(offsetMinutes);
	return `${year}-${month}-${day}T${hour}:${minute}:00${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;
}

export function normalizeDatetimeValue(value: string): string {
	const digits = value.replace(/\D/g, "").padEnd(12, "0").slice(0, 12);
	let day = Number(digits.slice(0, 2));
	let month = Number(digits.slice(2, 4));
	let year = Number(digits.slice(4, 8));
	let hour = Number(digits.slice(8, 10));
	let minute = Number(digits.slice(10, 12));

	year = Math.min(Math.max(year, 1), 9999);
	month = Math.min(Math.max(month, 1), 12);
	const maxDay = new Date(year, month, 0).getDate();
	day = Math.min(Math.max(day, 1), maxDay);
	hour = Math.min(Math.max(hour, 0), 23);
	minute = Math.min(Math.max(minute, 0), 59);

	return `${pad(day)}/${pad(month)}/${String(year).padStart(4, "0")} ${pad(hour)}:${pad(minute)}`;
}

export function isoToDatetimeValue(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return normalizeDatetimeValue("");
	}
	return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
