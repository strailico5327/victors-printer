import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function transformFlexShortcutBlocks(parent, context = {}) {
	if (!parent || !Array.isArray(parent.children)) {
		return false;
	}

	let changed = false;
	let index = 0;

	while (index < parent.children.length) {
		const startText = getParagraphText(parent.children[index]);
		const flex = parseFlexStart(startText);

		if (!flex) {
			index += 1;
			continue;
		}

		const endIndex = findFlexEnd(parent.children, index + 1);

		if (endIndex === -1) {
			throw new Error(`[shortcut flex] Missing !:flex after "${startText}"`);
		}

		const images = [];

		for (let childIndex = index + 1; childIndex < endIndex; childIndex += 1) {
			const imageText = getParagraphText(parent.children[childIndex]);
			const image = parseImageShortcut(imageText);

			if (image) {
				images.push(image);
			}
		}

		parent.children.splice(index, endIndex - index + 1, {
			type: "html",
			value: buildFlexHtml(flex, images, context),
		});

		changed = true;
		index += 1;
	}

	return changed;
}

function findFlexEnd(children, startIndex) {
	for (let index = startIndex; index < children.length; index += 1) {
		if (isFlexEndParagraph(children[index])) {
			return index;
		}
	}

	return -1;
}

function isFlexEndParagraph(node) {
	if (getParagraphText(node) === "!:flex") {
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
		directive.name === "flex"
	);
}

function parseFlexStart(value) {
	if (typeof value !== "string") {
		return null;
	}

	const parts = value.trim().split(/\s+/);

	if (parts[0] !== ":!flex") {
		return null;
	}

	if (parts.length > 2) {
		throw new Error(
			`[shortcut flex] Invalid syntax: "${value}". Use :!flex <container-width?>`,
		);
	}

	return {
		width: normalizeWidth(parts[1] || "100%"),
	};
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

function buildFlexHtml(flex, images, context) {
	const items = images
		.map((image) => {
			const full = makeFullPath(image.input, context.assetBase);
			const thumb = makeThumbPath(full);
			const ratio = getImageRatio(full) || 1;

			return `<div class="shortcut-flex-item" style="--shortcut-flex-ratio: ${formatNumber(ratio)};"><img class="shortcut-img" src="${escapeAttribute(thumb)}" data-full-src="${escapeAttribute(full)}" data-img-gallery="${escapeAttribute(image.gallery)}" alt="" loading="lazy" decoding="async" /></div>`;
		})
		.join("");

	return `<div class="shortcut-flex" style="width: ${escapeAttribute(flex.width)};">${items}</div>`;
}

function getImageRatio(publicPath) {
	if (/^(https?:)?\/\//.test(publicPath)) {
		return null;
	}

	const imagePath = path.join(process.cwd(), "public", publicPath.replace(/^\/+/, ""));

	if (!existsSync(imagePath)) {
		return null;
	}

	const dimensions = readImageDimensions(imagePath);

	if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
		return null;
	}

	return dimensions.width / dimensions.height;
}

function readImageDimensions(imagePath) {
	const buffer = readFileSync(imagePath);

	return (
		readPngDimensions(buffer) ||
		readJpegDimensions(buffer) ||
		readWebpDimensions(buffer)
	);
}

function readPngDimensions(buffer) {
	if (
		buffer.length < 24 ||
		buffer.toString("ascii", 1, 4) !== "PNG" ||
		buffer.toString("ascii", 12, 16) !== "IHDR"
	) {
		return null;
	}

	return {
		width: buffer.readUInt32BE(16),
		height: buffer.readUInt32BE(20),
	};
}

function readJpegDimensions(buffer) {
	if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
		return null;
	}

	let offset = 2;

	while (offset < buffer.length) {
		if (buffer[offset] !== 0xff) {
			offset += 1;
			continue;
		}

		const marker = buffer[offset + 1];
		offset += 2;

		if (marker === 0xd9 || marker === 0xda) {
			break;
		}

		const length = buffer.readUInt16BE(offset);

		if (length < 2 || offset + length > buffer.length) {
			break;
		}

		if (
			(marker >= 0xc0 && marker <= 0xc3) ||
			(marker >= 0xc5 && marker <= 0xc7) ||
			(marker >= 0xc9 && marker <= 0xcb) ||
			(marker >= 0xcd && marker <= 0xcf)
		) {
			return {
				height: buffer.readUInt16BE(offset + 3),
				width: buffer.readUInt16BE(offset + 5),
			};
		}

		offset += length;
	}

	return null;
}

function readWebpDimensions(buffer) {
	if (
		buffer.length < 30 ||
		buffer.toString("ascii", 0, 4) !== "RIFF" ||
		buffer.toString("ascii", 8, 12) !== "WEBP"
	) {
		return null;
	}

	const chunkType = buffer.toString("ascii", 12, 16);

	if (chunkType === "VP8X" && buffer.length >= 30) {
		return {
			width: 1 + buffer.readUIntLE(24, 3),
			height: 1 + buffer.readUIntLE(27, 3),
		};
	}

	if (chunkType === "VP8 " && buffer.length >= 30) {
		return {
			width: buffer.readUInt16LE(26) & 0x3fff,
			height: buffer.readUInt16LE(28) & 0x3fff,
		};
	}

	if (chunkType === "VP8L" && buffer.length >= 25) {
		const bits = buffer.readUInt32LE(21);

		return {
			width: (bits & 0x3fff) + 1,
			height: ((bits >> 14) & 0x3fff) + 1,
		};
	}

	return null;
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

function formatNumber(value) {
	return Number(value.toFixed(6)).toString();
}

function escapeAttribute(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
