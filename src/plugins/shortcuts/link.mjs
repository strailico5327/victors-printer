import {
	escapeAttribute,
	makeFullPath,
	makeThumbPath,
	parseImageShortcut,
} from "./img.mjs";

export function transformLinkShortcutBlocks(parent, context = {}) {
	if (!parent || !Array.isArray(parent.children)) {
		return false;
	}

	let changed = false;
	let index = 0;

	while (index < parent.children.length) {
		const startText = getParagraphText(parent.children[index]);
		const link = parseLinkBlockStart(startText);

		if (!link) {
			index += 1;
			continue;
		}

		const endIndex = findLinkEnd(parent.children, index + 1);

		if (endIndex === -1) {
			throw new Error(`[shortcut link] Missing !:link after "${startText}"`);
		}

		const innerHtml = parent.children
			.slice(index + 1, endIndex)
			.map((child) => renderLinkChild(child, context))
			.filter(Boolean)
			.join("");

		parent.children.splice(index, endIndex - index + 1, {
			type: "html",
			value: buildLinkWrapperHtml(link, innerHtml),
		});

		changed = true;
		index += 1;
	}

	return changed;
}

export function transformLinkShortcutParagraph(node) {
	if (!node || !Array.isArray(node.children)) {
		return false;
	}

	if (node.type !== "paragraph") {
		return false;
	}

	const text = getParagraphText(node);

	if (!text) {
		return false;
	}

	const link = parseLinkShortcut(text);

	if (!link) {
		return false;
	}

	const anchor = buildLinkAnchorHtml(link);

	node.type = "html";
	node.value = link.formatClass
		? `<p class="${escapeAttribute(link.formatClass)}">${anchor}</p>`
		: anchor;

	delete node.children;
	delete node.data;
	delete node.properties;

	return true;
}

export function parseLinkShortcut(value) {
	if (typeof value !== "string") {
		return null;
	}

	const input = value.trim();
	const formatMatch = input.match(/^(:>>|:>|:<)\s+(.+)$/);
	const formatClass = formatMatch ? getFormatClass(formatMatch[1]) : null;
	const shortcutText = formatMatch ? formatMatch[2] : input;
	const parts = shortcutText.split(/\s+/);

	if (parts[0] !== ":!link") {
		return null;
	}

	if (parts.length < 3) {
		throw new Error(
			`[shortcut link] Invalid syntax: "${value}". Use :!link <link text> <link url> <true|false?>`,
		);
	}

	let isPreview = true;
	const maybePreview = parts.at(-1);

	if (maybePreview === "true" || maybePreview === "false") {
		isPreview = maybePreview === "true";
		parts.pop();
	} else if (parts.length > 3 && /^(true|false)$/i.test(maybePreview)) {
		throw new Error(
			`[shortcut link] Invalid preview boolean "${maybePreview}" in "${value}". Use lowercase true or false.`,
		);
	}

	if (parts.length < 3) {
		throw new Error(
			`[shortcut link] Missing link URL in "${value}". Use :!link <link text> <link url> <true|false?>`,
		);
	}

	const url = parts.pop();
	const text = parts.slice(1).join(" ").trim();

	if (!text) {
		throw new Error(
			`[shortcut link] Missing link text in "${value}". Use :!link <link text> <link url> <true|false?>`,
		);
	}

	return {
		text,
		url,
		isPreview,
		formatClass,
	};
}

export function buildLinkAnchorHtml(link) {
	return `<a class="shortcut-link" href="${escapeAttribute(link.url)}" data-link-preview="${link.isPreview}">${escapeHtml(link.text)}</a>`;
}

export function parseLinkBlockStart(value) {
	if (typeof value !== "string") {
		return null;
	}

	const parts = value.trim().split(/\s+/);

	if (parts[0] !== ":!link" || parts.length < 2 || parts.length > 3) {
		return null;
	}

	const url = parts[1];

	if (!isUrlToken(url)) {
		return null;
	}

	let isPreview = true;

	if (parts[2]) {
		if (parts[2] !== "true" && parts[2] !== "false") {
			throw new Error(
				`[shortcut link] Invalid preview boolean "${parts[2]}" in "${value}". Use lowercase true or false.`,
			);
		}

		isPreview = parts[2] === "true";
	}

	return {
		url,
		isPreview,
	};
}

function findLinkEnd(children, startIndex) {
	for (let index = startIndex; index < children.length; index += 1) {
		if (isLinkEndParagraph(children[index])) {
			return index;
		}
	}

	return -1;
}

function isLinkEndParagraph(node) {
	if (getParagraphText(node) === "!:link") {
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
		directive.name === "link"
	);
}

function renderLinkChild(node, context) {
	const text = getParagraphText(node);
	const image = parseImageShortcut(text, {
		context,
		defaultWidth: "75%",
		scope: "link",
	});

	if (image) {
		return renderLinkedImage(image, context);
	}

	if (node?.type === "html" && typeof node.value === "string") {
		return node.value;
	}

	if (text) {
		return `<p>${escapeHtml(text)}</p>`;
	}

	return "";
}

function renderLinkedImage(image, context) {
	const full = makeFullPath(image.input, context.assetBase);
	const thumb = makeThumbPath(full);

	return `<img class="shortcut-img" src="${escapeAttribute(thumb)}" data-full-src="${escapeAttribute(full)}" data-img-gallery="${escapeAttribute(image.gallery)}" alt="" loading="lazy" decoding="async" style="width: ${escapeAttribute(image.width)};" />`;
}

function buildLinkWrapperHtml(link, innerHtml) {
	return `<a class="shortcut-link shortcut-link-wrapper no-styling" href="${escapeAttribute(link.url)}" data-link-preview="${link.isPreview}">${innerHtml}</a>`;
}

function getParagraphText(node) {
	if (!node || node.type !== "paragraph" || !Array.isArray(node.children)) {
		return null;
	}

	const text = collectInlineText(node.children);
	return text?.trim() || null;
}

function isBreakNode(node) {
	return (
		(node.type === "html" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "raw" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "element" && node.tagName === "br")
	);
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function collectInlineText(children) {
	let text = "";

	for (const child of children) {
		if (isBreakNode(child)) {
			continue;
		}

		if (child.type === "text" && typeof child.value === "string") {
			text += child.value;
			continue;
		}

		if (child.type === "textDirective" && typeof child.name === "string") {
			text += `:${child.name}`;
			continue;
		}

		if (child.type === "link" && typeof child.url === "string") {
			text += child.url;
			continue;
		}

		return null;
	}

	return text;
}

function getFormatClass(prefix) {
	if (prefix === ":>") {
		return "force-indent";
	}

	if (prefix === ":>>") {
		return "force-right";
	}

	if (prefix === ":<") {
		return "force-no-indent";
	}

	return null;
}

function isUrlToken(value) {
	return /^(https?:\/\/|mailto:|\/|#)/.test(value);
}
