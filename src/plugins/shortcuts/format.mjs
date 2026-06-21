export function transformFormatShortcutParagraph(node) {
	if (!node || !Array.isArray(node.children)) {
		return;
	}

	if (node.type !== "paragraph" && node.tagName !== "p") {
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

function isBreakNode(node) {
	return (
		(node.type === "html" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "raw" && /^<br\s*\/?>$/i.test(node.value.trim())) ||
		(node.type === "element" && node.tagName === "br")
	);
}

function transformShortcutText(parent, textNode) {
	const value = textNode.value;

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
