const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export function transformDateShortcutParagraph(node) {
	if (!node || !Array.isArray(node.children)) {
		return false;
	}

	if (node.type !== "paragraph") {
		return false;
	}

	const textNode = getOnlyTextChild(node);

	if (!textNode) {
		return false;
	}

	const value = textNode.value.trim();
	const match = value.match(/^:!date\s+(\d{8})\s*$/);

	if (!match) {
		return false;
	}

	const date = parseDateToken(match[1], value);

	node.type = "html";
	node.value = `<span class="shortcut-date">&mdash; ${date.day} ${date.month}, ${date.year}</span>`;

	delete node.children;
	delete node.data;
	delete node.properties;

	return true;
}

function parseDateToken(token, fullText) {
	const day = Number(token.slice(0, 2));
	const monthNumber = Number(token.slice(2, 4));
	const year = Number(token.slice(4, 8));

	if (monthNumber < 1 || monthNumber > 12) {
		throw new Error(
			`[shortcut date] Invalid month in "${fullText}". Use DDMMYYYY, for example :!date 29072007.`,
		);
	}

	const date = new Date(Date.UTC(year, monthNumber - 1, day));
	const isValidDate =
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === monthNumber - 1 &&
		date.getUTCDate() === day;

	if (!isValidDate) {
		throw new Error(
			`[shortcut date] Invalid date in "${fullText}". Use DDMMYYYY, for example :!date 29072007.`,
		);
	}

	return {
		day,
		month: MONTHS[monthNumber - 1],
		year,
	};
}

function getOnlyTextChild(node) {
	const meaningfulChildren = node.children.filter(
		(child) => !isBreakNode(child),
	);

	if (meaningfulChildren.length !== 1) {
		return null;
	}

	const child = meaningfulChildren[0];

	if (child.type !== "text" || typeof child.value !== "string") {
		return null;
	}

	return child;
}

function isBreakNode(node) {
	return (
		(node.type === "html" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "raw" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "element" && node.tagName === "br")
	);
}
