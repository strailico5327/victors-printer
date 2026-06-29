import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type ChangelogDay = {
	date: Date;
	items: string[];
};

export type ChangelogMonth = {
	year: number;
	month: number;
	title: string;
	url: string;
	published: Date;
	days: ChangelogDay[];
};

const CHANGELOG_DIR = join(process.cwd(), "src/spec/changelog");

export async function getChangelogMonths(): Promise<ChangelogMonth[]> {
	const files = await readdir(CHANGELOG_DIR);
	const days = (
		await Promise.all(
			files
				.filter((file) => file.endsWith(".md"))
				.map(async (file) =>
					parseChangelogYear(
						await readFile(join(CHANGELOG_DIR, file), "utf-8"),
					),
				),
		)
	).flat();

	const monthMap = new Map<string, ChangelogDay[]>();

	for (const day of days) {
		const key = monthKey(day.date.getFullYear(), day.date.getMonth() + 1);
		monthMap.set(key, [...(monthMap.get(key) ?? []), day]);
	}

	return Array.from(monthMap.entries())
		.map(([key, monthDays]) => {
			const [year, month] = key.split("-").map(Number);
			const sortedDays = monthDays.sort(
				(a, b) => b.date.getTime() - a.date.getTime(),
			);

			return {
				year,
				month,
				title: "Changelog",
				url: changelogMonthUrl(year, month),
				published: new Date(year, month - 1, 1),
				days: sortedDays,
			};
		})
		.sort((a, b) => b.year - a.year || b.month - a.month);
}

export function changelogMonthUrl(year: number, month: number): string {
	return `/changelog/${year}/${String(month).padStart(2, "0")}/`;
}

export function formatChangelogMonth(month: ChangelogMonth): string {
	return `${String(month.month).padStart(2, "0")}/${month.year}`;
}

function parseChangelogYear(body: string): ChangelogDay[] {
	const lines = stripFrontmatter(body).split(/\r?\n/);
	const days: ChangelogDay[] = [];
	let pendingItems: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();

		if (
			!trimmed ||
			trimmed === "---" ||
			/^:!#{1,6}\s+/.test(trimmed) ||
			/^#{1,6}\s+/.test(trimmed)
		) {
			continue;
		}

		const shortcutDate = trimmed.match(/^:!date\s+(\d{2})(\d{2})(\d{4})\s*$/i);

		if (shortcutDate) {
			pushDay(days, parseShortcutDate(shortcutDate), pendingItems);
			pendingItems = [];
			continue;
		}

		const legacyDate = trimmed.match(
			/^\{%\s*date\s+(\d{1,2})\s+(\d{1,2})\s+(\d{2,4})\s*%\}(?:<br>)?$/i,
		);

		if (legacyDate) {
			pushDay(days, parseLegacyDate(legacyDate), pendingItems);
			pendingItems = [];
			continue;
		}

		const itemMatch = trimmed.match(
			/^(?:\{%\s*fidt\s*%\}\s*)?(.+?)(?:<br>)?$/i,
		);
		pendingItems.push(itemMatch?.[1].trim() ?? trimmed);
	}

	return days;
}

function stripFrontmatter(body: string): string {
	return body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function pushDay(days: ChangelogDay[], date: Date, items: string[]) {
	if (items.length === 0) {
		return;
	}

	days.push({ date, items });
}

function parseShortcutDate(match: RegExpMatchArray): Date {
	return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function parseLegacyDate(match: RegExpMatchArray): Date {
	const day = Number(match[1]);
	const month = Number(match[2]);
	const rawYear = Number(match[3]);
	const year = rawYear < 100 ? 2000 + rawYear : rawYear;

	return new Date(year, month - 1, day);
}

function monthKey(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, "0")}`;
}
