// @ts-nocheck

export function yamlString(value) {
	return JSON.stringify(`${value ?? ""}`);
}

export function parseFrontmatterMarkdown(text) {
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) {
		return { data: {}, body: text };
	}
	const data = {};
	for (const line of match[1].split(/\r?\n/)) {
		const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!field) {
			continue;
		}
		const value = field[2].trim();
		if (value.startsWith("[") && value.endsWith("]")) {
			data[field[1]] = value
				.slice(1, -1)
				.split(",")
				.map((item) => item.trim().replace(/^["']|["']$/g, ""))
				.filter(Boolean);
			continue;
		}
		data[field[1]] = value.replace(/^["']|["']$/g, "");
	}
	return { data, body: text.slice(match[0].length).replace(/^(?:[ \t]*\r?\n)+/, "") };
}

export function isDraftShortcutLine(line) {
	return (
		/^:!img\s+\S+(?:\s+\S+){0,3}$/.test(line) ||
		/^:!grid(?:\s+\S+){2,5}$/.test(line) ||
		/^:!mosaic(?:\s+\S+){0,3}$/.test(line) ||
		/^:\/(?:\s+\S+)?$/.test(line) ||
		/^!:(?:grid|mosaic)$/.test(line)
	);
}

export function splitDraftBodyAndImageBlock(body) {
	const lines = body.trimEnd().split(/\r?\n/);
	let start = lines.length;
	while (start > 0 && (lines[start - 1].trim() === "" || isDraftShortcutLine(lines[start - 1].trim()))) {
		start -= 1;
	}
	const shortcutLines = lines.slice(start).map((line) => line.trim()).filter(Boolean);
	return {
		text: lines.slice(0, start).join("\n").trimEnd(),
		shortcutLines,
	};
}

export function imageIdFromDraftFileName(fileName) {
	return fileName.replace(/\.[^.]+$/, "");
}
