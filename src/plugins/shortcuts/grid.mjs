export function transformGridShortcutBlocks(parent, context = {}) {
	if (!parent || !Array.isArray(parent.children)) {
		return false;
	}

	let changed = false;
	let index = 0;

	while (index < parent.children.length) {
		const startText = getParagraphText(parent.children[index]);
		const grid = parseGridStart(startText);

		if (!grid) {
			index += 1;
			continue;
		}

		const endIndex = findGridEnd(parent.children, index + 1);

		if (endIndex === -1) {
			throw new Error(`[shortcut grid] Missing !:grid after "${startText}"`);
		}

		const images = [];

		for (let childIndex = index + 1; childIndex < endIndex; childIndex += 1) {
			const imageText = getParagraphText(parent.children[childIndex]);
			const image = parseImageShortcut(imageText);

			if (!image) {
				continue;
			}

			if (images.length < grid.maxItems) {
				images.push(image);
			}
		}

		parent.children.splice(index, endIndex - index + 1, {
			type: "html",
			value: buildGridHtml(grid, images, context),
		});

		changed = true;
		index += 1;
	}

	return changed;
}

function findGridEnd(children, startIndex) {
	for (let index = startIndex; index < children.length; index += 1) {
		if (isGridEndParagraph(children[index])) {
			return index;
		}
	}

	return -1;
}

function isGridEndParagraph(node) {
	if (getParagraphText(node) === "!:grid") {
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
		directive.name === "grid"
	);
}

function parseGridStart(value) {
	if (typeof value !== "string") {
		return null;
	}

	const parts = value.trim().split(/\s+/);

	if (parts[0] !== ":!grid") {
		return null;
	}

	if (parts.length < 3 || parts.length > 5) {
		throw new Error(
			`[shortcut grid] Invalid syntax: "${value}". Use :!grid <columns> <rows> <cell-ratio?> <container-width?>`,
		);
	}

	const columns = parsePositiveInteger(parts[1], "columns", value);
	const rows = parsePositiveInteger(parts[2], "rows", value);

	let ratio = "1 / 1";
	let width = "100%";

	const third = parts[3];
	const fourth = parts[4];

	if (third && fourth) {
		if (!third.includes("/")) {
			throw new Error(
				`[shortcut grid] Invalid ratio "${third}" in "${value}". Ratio must contain "/", for example 1/1 or 16/9.`,
			);
		}

		ratio = normalizeRatio(third, value);
		width = normalizeWidth(fourth);
	} else if (third) {
		if (third.includes("/")) {
			ratio = normalizeRatio(third, value);
		} else {
			if (third === "1") {
				throw new Error(
					`[shortcut grid] Ambiguous value "1" in "${value}". Use empty ratio, 1/1, or a width like 90.`,
				);
			}

			width = normalizeWidth(third);
		}
	}

	return {
		columns,
		rows,
		ratio,
		width,
		maxItems: columns * rows,
	};
}

function parsePositiveInteger(value, fieldName, fullText) {
	if (!/^\d+$/.test(value)) {
		throw new Error(
			`[shortcut grid] Invalid ${fieldName} "${value}" in "${fullText}". It must be a positive integer.`,
		);
	}

	const number = Number(value);

	if (number < 1) {
		throw new Error(
			`[shortcut grid] Invalid ${fieldName} "${value}" in "${fullText}". It must be at least 1.`,
		);
	}

	return number;
}

function normalizeRatio(value, fullText) {
	const match = value.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);

	if (!match) {
		throw new Error(
			`[shortcut grid] Invalid ratio "${value}" in "${fullText}". Use forms like 1/1, 16/9, or 3/4.`,
		);
	}

	const width = Number(match[1]);
	const height = Number(match[2]);

	if (width <= 0 || height <= 0) {
		throw new Error(
			`[shortcut grid] Invalid ratio "${value}" in "${fullText}". Ratio numbers must be greater than 0.`,
		);
	}

	return `${match[1]} / ${match[2]}`;
}

function parseImageShortcut(value) {
	if (typeof value !== "string") {
		return null;
	}

	const match = value.trim().match(/^:!img\s+(\S+)\s+(\S+)(?:\s+(\S+))?\s*$/);

	if (!match) {
		return null;
	}

	return {
		input: match[1],
		gallery: match[2],
	};
}

function buildGridHtml(grid, images, context) {
	const items = images
		.map((image) => {
			const full = makeFullPath(image.input, context.assetBase);
			const thumb = makeThumbPath(full);

			return `<div class="shortcut-grid-item"><img class="shortcut-img" src="${escapeAttribute(thumb)}" data-full-src="${escapeAttribute(full)}" data-img-gallery="${escapeAttribute(image.gallery)}" alt="" loading="lazy" decoding="async" /></div>`;
		})
		.join("");

	return `<div class="shortcut-grid" style="width: ${escapeAttribute(grid.width)}; --shortcut-grid-columns: ${grid.columns}; --shortcut-grid-ratio: ${escapeAttribute(grid.ratio)};">${items}</div>`;
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

function makeFullPath(input, assetBase) {
	if (/^(https?:)?\/\//.test(input)) {
		return input;
	}

	if (input.startsWith("/")) {
		return input;
	}

	const cleanInput = input
		.replace(/\\/g, "/")
		.replace(/^\.\//, "")
		.replace(/^\/+/, "");

	if (!assetBase) {
		return cleanInput;
	}

	return `${assetBase}/${cleanInput}`;
}

function makeThumbPath(path) {
	const match = path.match(/^([^?#]+)([?#].*)?$/);
	const main = match?.[1] || path;
	const suffix = match?.[2] || "";

	const lastSlash = main.lastIndexOf("/");
	const lastDot = main.lastIndexOf(".");

	if (lastDot > lastSlash) {
		return `${main.slice(0, lastDot)}_thumb.webp${suffix}`;
	}

	return `${main}_thumb.webp${suffix}`;
}

function normalizeWidth(width) {
	if (/^\d+(\.\d+)?$/.test(width)) {
		return `${width}%`;
	}

	return width;
}

function escapeAttribute(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
