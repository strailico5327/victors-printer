export function transformImageShortcutParagraph(node, context = {}) {
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

	const image = parseImageShortcut(textNode.value, {
		context,
		defaultWidth: "75%",
		scope: "image",
	});

	if (!image) {
		return false;
	}

	const full = makeFullPath(image.input, context.assetBase);
	const thumb = makeThumbPath(full);

	node.type = "html";
	node.value = `<img class="shortcut-img" src="${escapeAttribute(thumb)}" data-full-src="${escapeAttribute(full)}" data-img-gallery="${escapeAttribute(image.gallery)}" alt="" loading="lazy" decoding="async" style="width: ${escapeAttribute(image.width)};" />`;

	delete node.children;
	delete node.data;
	delete node.properties;

	return true;
}

export function parseImageShortcut(value, options = {}) {
	if (typeof value !== "string") {
		return null;
	}

	const parts = value.trim().split(/\s+/);

	if (parts[0] !== ":!img" || parts.length < 2) {
		return null;
	}

	const input = parts[1];
	const args = parts.slice(2);
	const galleryOverride = takeGalleryOverride(args);

	let gallery = galleryOverride;
	let width = null;

	if (args.length === 1) {
		if (isWidthToken(args[0])) {
			width = args[0];
		} else {
			gallery = gallery || args[0];
		}
	} else if (args.length === 2) {
		if (isWidthToken(args[0])) {
			width = args[0];
			gallery = gallery || args[1];
		} else {
			gallery = gallery || args[0];
			width = args[1];
		}
	} else if (args.length > 2) {
		throw new Error(
			`[shortcut img] Invalid syntax: "${value}". Use :!img <path> <width?> <@gallery?>`,
		);
	}

	const resolvedGallery = resolveShortcutGallery(
		gallery || options.defaultGallery,
		options.context,
		options.scope || "image",
	);

	return {
		input,
		gallery: resolvedGallery,
		width: options.defaultWidth === false
			? null
			: normalizeWidth(width || options.defaultWidth || "75%"),
	};
}

export function resolveShortcutGallery(gallery, context = {}, scope = "image") {
	if (gallery) {
		return gallery;
	}

	if (typeof context.galleryResolver === "function") {
		const resolved = context.galleryResolver({ scope, assetBase: context.assetBase });

		if (resolved) {
			return resolved;
		}
	}

	// TODO: Replace this fallback when post/timeline gallery naming is finalised.
	return context.autoGallery || context.assetBase || `shortcut-${scope}`;
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

export function makeFullPath(input, assetBase) {
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

export function makeThumbPath(path) {
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

export function normalizeWidth(width) {
	if (/^\d+(\.\d+)?$/.test(width)) {
		return `${width}%`;
	}

	return width;
}

export function normalizeRatio(value, fullText, label = "ratio") {
	const match = value.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);

	if (!match) {
		throw new Error(
			`[shortcut ${label}] Invalid ratio "${value}" in "${fullText}". Use forms like 1/1, 16/9, or 3/4.`,
		);
	}

	const width = Number(match[1]);
	const height = Number(match[2]);

	if (width <= 0 || height <= 0) {
		throw new Error(
			`[shortcut ${label}] Invalid ratio "${value}" in "${fullText}". Ratio numbers must be greater than 0.`,
		);
	}

	return `${match[1]} / ${match[2]}`;
}

export function isRatioToken(value) {
	return /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(value);
}

export function escapeAttribute(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function takeGalleryOverride(args) {
	const last = args.at(-1);

	if (!last?.startsWith("@")) {
		return null;
	}

	args.pop();
	return last.slice(1);
}

function isWidthToken(value) {
	return /^\d+(?:\.\d+)?%?$/.test(value) || /^(auto|inherit|initial|unset)$/.test(value);
}
