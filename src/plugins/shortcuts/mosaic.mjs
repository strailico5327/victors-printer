import {
	escapeAttribute,
	isRatioToken,
	makeFullPath,
	makeThumbPath,
	normalizeRatio,
	normalizeWidth,
	parseImageShortcut,
	resolveShortcutGallery,
} from "./img.mjs";

export function transformMosaicShortcutBlocks(parent, context = {}) {
	if (!parent || !Array.isArray(parent.children)) {
		return false;
	}

	let changed = false;
	let index = 0;

	while (index < parent.children.length) {
		const startText = getParagraphText(parent.children[index]);
		const mosaic = parseMosaicStart(startText, context);

		if (!mosaic) {
			index += 1;
			continue;
		}

		const endIndex = findMosaicEnd(parent.children, index + 1);

		if (endIndex === -1) {
			throw new Error(
				`[shortcut mosaic] Missing !:mosaic after "${startText}"`,
			);
		}

		const rows = collectMosaicRows(
			parent.children,
			index + 1,
			endIndex,
			mosaic,
			context,
		);

		parent.children.splice(index, endIndex - index + 1, {
			type: "html",
			value: buildMosaicHtml(mosaic, rows, context),
		});

		changed = true;
		index += 1;
	}

	return changed;
}

function collectMosaicRows(children, startIndex, endIndex, mosaic, context) {
	const rows = [{ ratio: null, images: [] }];

	for (let childIndex = startIndex; childIndex < endIndex; childIndex += 1) {
		const text = getParagraphText(children[childIndex]);
		const divider = parseMosaicRowDivider(text);

		if (divider) {
			const current = rows.at(-1);

			if (current && current.images.length === 0) {
				current.ratio = divider.ratio;
			} else {
				rows.push({ ratio: divider.ratio, images: [] });
			}

			continue;
		}

		const image = parseImageShortcut(text, {
			context,
			defaultGallery: mosaic.gallery,
			defaultWidth: false,
			scope: "mosaic",
		});

		if (image) {
			rows.at(-1)?.images.push(image);
		}
	}

	return rows.filter((row) => row.images.length > 0);
}

function parseMosaicStart(value, context) {
	if (typeof value !== "string") {
		return null;
	}

	const parts = value.trim().split(/\s+/);

	if (parts[0] !== ":!mosaic") {
		return null;
	}

	const galleryOverride = takeGalleryOverride(parts);

	if (parts.length > 3) {
		throw new Error(
			`[shortcut mosaic] Invalid syntax: "${value}". Use :!mosaic <width?> <group-ratio?> <@gallery?>`,
		);
	}

	let width = "100%";
	let ratio = "4 / 3";

	for (const part of parts.slice(1)) {
		if (isRatioToken(part)) {
			ratio = normalizeRatio(part, value, "mosaic");
		} else {
			width = normalizeWidth(part);
		}
	}

	return {
		width,
		ratio,
		gallery: resolveShortcutGallery(galleryOverride, context, "mosaic"),
	};
}

function parseMosaicRowDivider(value) {
	if (typeof value !== "string") {
		return null;
	}

	const parts = value.trim().split(/\s+/);

	if (parts[0] !== ":/") {
		return null;
	}

	if (parts.length > 2) {
		throw new Error(
			`[shortcut mosaic] Invalid row syntax: "${value}". Use :/ <cell-ratio?>`,
		);
	}

	return {
		ratio: parts[1] ? normalizeRatio(parts[1], value, "mosaic") : null,
	};
}

function buildMosaicHtml(mosaic, rows, context) {
	const usesRowRatios = rows.some((row) => row.ratio);
	const rowHtml = rows
		.map((row) => buildMosaicRowHtml(row, usesRowRatios, context))
		.join("");
	const modeClass = usesRowRatios
		? "shortcut-mosaic-row-ratios"
		: "shortcut-mosaic-group-ratio";
	const ratioStyle = usesRowRatios
		? ""
		: ` --shortcut-mosaic-ratio: ${escapeAttribute(mosaic.ratio)};`;

	return `<div class="shortcut-mosaic ${modeClass}" style="width: ${escapeAttribute(mosaic.width)};${ratioStyle}">${rowHtml}</div>`;
}

function buildMosaicRowHtml(row, usesRowRatios, context) {
	const ratio = row.ratio || "1 / 1";
	const rowStyle = usesRowRatios
		? `--shortcut-mosaic-row-ratio: ${escapeAttribute(ratio)}; `
		: "";
	const items = row.images
		.map((image) => {
			const full = makeFullPath(image.input, context.assetBase);
			const thumb = makeThumbPath(full);

			return `<div class="shortcut-mosaic-item"><img class="shortcut-img" src="${escapeAttribute(thumb)}" data-full-src="${escapeAttribute(full)}" data-img-gallery="${escapeAttribute(image.gallery)}" alt="" loading="lazy" decoding="async" /></div>`;
		})
		.join("");

	return `<div class="shortcut-mosaic-row" style="${rowStyle}--shortcut-mosaic-columns: ${row.images.length};">${items}</div>`;
}

function findMosaicEnd(children, startIndex) {
	for (let index = startIndex; index < children.length; index += 1) {
		if (isMosaicEndParagraph(children[index])) {
			return index;
		}
	}

	return -1;
}

function isMosaicEndParagraph(node) {
	if (getParagraphText(node) === "!:mosaic") {
		return true;
	}

	if (!node || node.type !== "paragraph" || !Array.isArray(node.children)) {
		return false;
	}

	const meaningfulChildren = node.children.filter(
		(child) => !isBreakNode(child),
	);

	if (meaningfulChildren.length !== 2) {
		return false;
	}

	const [bang, directive] = meaningfulChildren;

	return (
		bang.type === "text" &&
		bang.value === "!" &&
		directive.type === "textDirective" &&
		directive.name === "mosaic"
	);
}

function getParagraphText(node) {
	if (!node || node.type !== "paragraph" || !Array.isArray(node.children)) {
		return null;
	}

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

	return child.value.trim();
}

function isBreakNode(node) {
	return (
		(node.type === "html" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "raw" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "element" && node.tagName === "br")
	);
}

function takeGalleryOverride(parts) {
	const last = parts.at(-1);

	if (!last?.startsWith("@")) {
		return null;
	}

	parts.pop();
	return last.slice(1);
}
