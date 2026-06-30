export function extensionForUploadedImage(file: Pick<File, "name" | "type">): string {
	const nameExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
	if (["jpg", "jpeg", "png"].includes(nameExtension)) {
		return nameExtension;
	}
	if (file.type === "image/jpeg") {
		return "jpg";
	}
	if (file.type === "image/png") {
		return "png";
	}
	return "png";
}

export function mimeTypeForExtension(extension: string): string {
	return extension === "jpg" || extension === "jpeg" ? "image/jpeg" : "image/png";
}

export function thumbNameForFileName(fileName: string): string {
	return fileName.replace(/\.[^.]+$/, "_thumb.webp");
}
