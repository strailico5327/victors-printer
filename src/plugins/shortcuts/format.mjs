import { buildLinkAnchorHtml, parseLinkShortcut } from "./link.mjs";

export function transformFormatShortcutParagraph(node) {
	if (!node || !Array.isArray(node.children)) {
		return;
	}

	if (node.type !== "paragraph" && node.tagName !== "p") {
		return;
	}

	const paragraphText = getParagraphText(node);

	if (transformShortcutTitle(node, paragraphText)) {
		return;
	}

	for (const child of node.children) {
		if (isBreakNode(child)) {
			continue;
		}

		if (child.type !== "text" || typeof child.value !== "string") {
			return;
		}

		transformShortcutText(node, child);
		return;
	}
}

function transformShortcutTitle(parent, value) {
	if (typeof value !== "string") {
		return false;
	}

	const titleMatch = value.match(/^\s*:!(#{1,6})(?:\s|$)/);

	if (!titleMatch) {
		return false;
	}

	const level = titleMatch[1].length;
	const titleText = value.replace(/^\s*:!#{1,6}\s*/, "");
	const titleLink = parseLinkShortcut(titleText);

	if (titleLink) {
		parent.type = "html";
		parent.value = `<h${level} class="shortcut-title">${buildLinkAnchorHtml(titleLink)}</h${level}>`;
		delete parent.children;
		delete parent.data;
		delete parent.properties;
		return true;
	}

	parent.type = "heading";
	parent.tagName = `h${level}`;
	parent.depth = level;
	parent.children = [{ type: "text", value: titleText }];
	addClass(parent, "shortcut-title");
	return true;
}

function isBreakNode(node) {
	return (
		(node.type === "html" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "raw" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "element" && node.tagName === "br")
	);
}

function transformShortcutText(parent, textNode) {
	const value = textNode.value;
	const titleMatch = value.match(/^\s*:!(#{1,6})(?:\s|$)/);

	if (titleMatch) {
		const titleText = value.replace(/^\s*:!#{1,6}\s*/, "");
		parent.type = "heading";
		parent.tagName = `h${titleMatch[1].length}`;
		parent.depth = titleMatch[1].length;

		const titleLink = parseLinkShortcut(titleText);

		if (titleLink) {
			parent.type = "html";
			parent.value = `<h${titleMatch[1].length} class="shortcut-title">${buildLinkAnchorHtml(titleLink)}</h${titleMatch[1].length}>`;
			delete parent.children;
			delete parent.data;
			delete parent.properties;
			return;
		}

		textNode.value = titleText;
		addClass(parent, "shortcut-title");
		return;
	}

	if (/^\s*:>>/.test(value)) {
		textNode.value = value.replace(/^\s*:>>\s*/, "");
		addClass(parent, "force-right");
		return;
	}

	if (/^\s*:>/.test(value)) {
		textNode.value = value.replace(/^\s*:>\s*/, "");
		addClass(parent, "force-indent");
		return;
	}

	if (/^\s*:</.test(value)) {
		textNode.value = value.replace(/^\s*:<\s*/, "");
		addClass(parent, "force-no-indent");
	}
}

function getParagraphText(node) {
	const text = collectInlineText(node.children);
	return text?.trim() || null;
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

function addClass(node, className) {
	if (node.properties) {
		appendClass(node.properties, className);
		return;
	}

	node.data ??= {};
	node.data.hProperties ??= {};
	appendClass(node.data.hProperties, className);
}

function appendClass(properties, className) {
	const existing = properties.className;

	if (Array.isArray(existing)) {
		properties.className = [...existing, className];
	} else if (typeof existing === "string") {
		properties.className = [existing, className];
	} else {
		properties.className = [className];
	}
}
