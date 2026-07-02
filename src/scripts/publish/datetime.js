// @ts-nocheck

export const datetimeDigitIndexes = [0, 1, 3, 4, 6, 7, 8, 9, 11, 12, 14, 15];
export const datetimeTimeIndexes = [11, 12, 14, 15];
export const datetimeMask = "00/00/0000 00:00";

function pad(value) {
	return String(value).padStart(2, "0");
}

export function datetimeValue(date = new Date()) {
	return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function datetimeToIso(value) {
	const match = normalizeDatetimeValue(value).match(/^(\d{2})\/(\d{2})\/(\d{4}) ([\dx]{2}):([\dx]{2})$/);
	if (!match) {
		throw new Error("invalid_datetime");
	}
	const [, day, month, year, hour, minute] = match;
	const hasUnknownTime = hour.toLowerCase().includes("x") || minute.toLowerCase().includes("x");
	const date = new Date(
		Number(year),
		Number(month) - 1,
		Number(day),
		hasUnknownTime ? 0 : Number(hour),
		hasUnknownTime ? 0 : Number(minute),
		0,
	);
	const offsetMinutes = -date.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const absOffset = Math.abs(offsetMinutes);
	const time = hasUnknownTime ? "xx:xx" : `${hour}:${minute}`;
	return `${year}-${month}-${day}T${time}:00${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;
}

export function isoToDatetimeValue(value) {
	const unknownTime = `${value ?? ""}`.match(/^(\d{4})-(\d{2})-(\d{2})Txx:xx(?::xx|:00)?(?:Z|[+-]\d{2}:\d{2})?$/);
	if (unknownTime) {
		const [, year, month, day] = unknownTime;
		return `${day}/${month}/${year} xx:xx`;
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return normalizeDatetimeValue("");
	}
	return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getClosestDatetimeDigitIndex(index, direction = 1) {
	const sortedIndexes = direction < 0 ? [...datetimeDigitIndexes].reverse() : datetimeDigitIndexes;
	return (
		sortedIndexes.find((digitIndex) =>
			direction < 0 ? digitIndex <= index : digitIndex >= index,
		) ?? sortedIndexes[sortedIndexes.length - 1]
	);
}

export function normalizeDatetimeValue(value) {
	const tokens = value.replace(/[^0-9x]/g, "").padEnd(12, "0").slice(0, 12);
	let day = Number(tokens.slice(0, 2).replace(/x/g, "0"));
	let month = Number(tokens.slice(2, 4).replace(/x/g, "0"));
	let year = Number(tokens.slice(4, 8).replace(/x/g, "0"));
	let hour = Number(tokens.slice(8, 10).replace(/x/g, "0"));
	let minute = Number(tokens.slice(10, 12).replace(/x/g, "0"));
	const hasUnknownTime = tokens.slice(8, 12).includes("x");

	year = Math.min(Math.max(year, 1), 9999);
	month = Math.min(Math.max(month, 1), 12);
	const maxDay = new Date(year, month, 0).getDate();
	day = Math.min(Math.max(day, 1), maxDay);
	hour = Math.min(Math.max(hour, 0), 23);
	minute = Math.min(Math.max(minute, 0), 59);

	const time = hasUnknownTime ? "xx:xx" : `${pad(hour)}:${pad(minute)}`;
	return `${pad(day)}/${pad(month)}/${String(year).padStart(4, "0")} ${time}`;
}
