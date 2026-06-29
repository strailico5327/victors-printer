export function transformSeparatorShortcutParagraph(node) {
	if (!node || !Array.isArray(node.children)) {
		return false;
	}

	if (node.type !== "paragraph") {
		return false;
	}

	const textNode = getOnlyTextChild(node);

	if (!textNode || textNode.value.trim() !== ":===:") {
		return false;
	}

	node.type = "html";
	node.value = '<div class="shortcut-card-separator" aria-hidden="true"></div>';

	delete node.children;
	delete node.data;
	delete node.properties;

	return true;
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
