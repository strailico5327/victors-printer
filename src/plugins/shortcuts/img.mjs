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

const value = textNode.value.trim();
const match = value.match(/^:!img\s+(\S+)\s+(\S+)(?:\s+(\S+))?\s*$/);

if (!match) {
return false;
}

const input = match[1];
const gallery = match[2];
const width = normalizeWidth(match[3] || "75%");

const full = makeFullPath(input, context.assetBase);
const thumb = makeThumbPath(full);

node.type = "html";
node.value = `<img class="shortcut-img" src="${escapeAttribute(thumb)}" data-full-src="${escapeAttribute(full)}" data-img-gallery="${escapeAttribute(gallery)}" alt="" loading="lazy" decoding="async" style="width: ${escapeAttribute(width)};" />`;

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
