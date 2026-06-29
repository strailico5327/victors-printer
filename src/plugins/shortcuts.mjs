import { transformDateShortcutParagraph } from "./shortcuts/date.mjs";
import { transformFlexShortcutBlocks } from "./shortcuts/flex.mjs";
import { transformFormatShortcutParagraph } from "./shortcuts/format.mjs";
import { transformGridShortcutBlocks } from "./shortcuts/grid.mjs";
import { transformImageShortcutParagraph } from "./shortcuts/img.mjs";
import { transformMosaicShortcutBlocks } from "./shortcuts/mosaic.mjs";
import { transformSeparatorShortcutParagraph } from "./shortcuts/separator.mjs";

export default function shortcuts() {
	return function transformer(tree, file) {
		const context = {
			assetBase: getContentAssetBase(file?.path),
		};

		transformChildren(tree, context);
	};
}

function transformChildren(parent, context) {
	if (!parent || !Array.isArray(parent.children)) {
		return;
	}

	splitShortcutParagraphs(parent);
	transformFlexShortcutBlocks(parent, context);
	transformGridShortcutBlocks(parent, context);
	transformMosaicShortcutBlocks(parent, context);

	parent.children = parent.children.map((child) => {
		if (transformDateShortcutParagraph(child)) {
			return child;
		}

		if (transformImageShortcutParagraph(child, context)) {
			return child;
		}

		if (transformSeparatorShortcutParagraph(child)) {
			return child;
		}

		transformFormatShortcutParagraph(child);
		transformChildren(child, context);

		return child;
	});
}

function splitShortcutParagraphs(parent) {
	let index = 0;

	while (index < parent.children.length) {
		const child = parent.children[index];
		const lines = getShortcutParagraphLines(child);

		if (!lines) {
			index += 1;
			continue;
		}

		const paragraphNodes = lines.map((line) => ({
			type: "paragraph",
			children: [{ type: "text", value: line }],
		}));

		parent.children.splice(index, 1, ...paragraphNodes);
		index += paragraphNodes.length;
	}
}

function getShortcutParagraphLines(node) {
	if (!node || node.type !== "paragraph" || !Array.isArray(node.children)) {
		return null;
	}

	const lines = collectParagraphLines(node);

	if (!lines || lines.length < 2) {
		return null;
	}

	const nonEmptyLines = lines.map((line) => line.trim()).filter(Boolean);

	if (
		nonEmptyLines.length < 2 ||
		!nonEmptyLines.every((line) => isShortcutLine(line))
	) {
		return null;
	}

	return nonEmptyLines;
}

function collectParagraphLines(node) {
	const lines = [""];

	for (const child of node.children) {
		if (child.type === "text" && typeof child.value === "string") {
			const parts = child.value.split(/\r?\n/);
			lines[lines.length - 1] += parts[0];

			for (const part of parts.slice(1)) {
				lines.push(part);
			}
			continue;
		}

		if (isBreakNode(child)) {
			lines.push("");
			continue;
		}

		if (child.type === "textDirective" && typeof child.name === "string") {
			lines[lines.length - 1] += `:${child.name}`;
			continue;
		}

		return null;
	}

	return lines;
}

function isBreakNode(node) {
	return (
		node.type === "break" ||
		(node.type === "html" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "raw" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "element" && node.tagName === "br")
	);
}

function isShortcutLine(line) {
	return (
		/^:!date\s+\d{8}$/.test(line) ||
		/^:!img\s+\S+(?:\s+\S+){0,3}$/.test(line) ||
		/^:!flex(?:\s+\S+){0,2}$/.test(line) ||
		/^:!grid(?:\s+\S+){2,5}$/.test(line) ||
		/^:!mosaic(?:\s+\S+){0,3}$/.test(line) ||
		/^:\/(?:\s+\S+)?$/.test(line) ||
		/^!:(?:flex|grid|mosaic)$/.test(line) ||
		/^:===:$/.test(line)
	);
}

function getContentAssetBase(filePath) {
	if (typeof filePath !== "string") {
		return null;
	}

	const normalisedPath = filePath.replace(/\\/g, "/");
	const match = normalisedPath.match(
		/\/src\/content\/(posts|spec|timeline)\/(.+)$/,
	);

	if (!match) {
		return null;
	}

	const collection = match[1];
	const relativePath = match[2];
	const parts = relativePath.split("/").filter(Boolean);

	if (parts.length === 0) {
		return null;
	}

	if (collection === "timeline") {
		const [year, month] = parts;
		return year && month
			? `/images/timeline/${year}/${month}`
			: "/images/timeline";
	}

	const filename = parts.at(-1) || "";
	const basename = filename.replace(/\.(md|mdx)$/i, "");

	if (parts.length === 1) {
		return `/images/${collection}/${slugify(basename)}`;
	}

	if (/^(a\.)?index$/i.test(basename)) {
		return `/images/${collection}/${slugify(parts.at(-2) || "")}`;
	}

	return `/images/${collection}/${slugify(basename)}`;
}

function slugify(value) {
	return String(value)
		.trim()
		.toLowerCase()
		.replace(/['\u2019]/g, "")
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
