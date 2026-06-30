export function downloadBlob(blob: Blob, filename: string): void {
	const href = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = href;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function disableSwupFromPublish(): void {
	for (const link of document.querySelectorAll("a[href]")) {
		const href = link.getAttribute("href") || "";
		if (!href.startsWith("#") && !href.startsWith("http") && !href.startsWith("mailto:")) {
			link.setAttribute("data-no-swup", "");
		}
	}
}
