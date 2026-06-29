export function transformSeparatorShortcutParagraph(node) {
	if (!node || !Array.isArray(node.children)) {
		return false;
	}

	if (node.type !== "paragraph") {
		return false;
	}

	const text = getParagraphText(node);

	if (text !== ":!===!:") {
		return false;
	}

	node.type = "html";
	node.value = '<div class="shortcut-card-separator" aria-hidden="true"></div>';

	delete node.children;
	delete node.data;
	delete node.properties;

	return true;
}

function getParagraphText(node) {
	if (!node || !Array.isArray(node.children)) {
		return null;
	}

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

		if (child.type === "textDirective" && child.name === "!===!") {
			text += ":!===!:";
			continue;
		}

		if (child.type === "textDirective" && typeof child.name === "string") {
			text += `:${child.name}`;
			continue;
		}

		return null;
	}

	return text;
}

function isBreakNode(node) {
	return (
		(node.type === "html" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "raw" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "element" && node.tagName === "br")
	);
}
