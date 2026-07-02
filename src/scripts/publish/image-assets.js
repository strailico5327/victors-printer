// @ts-nocheck

export function extensionForUploadedImage(file) {
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

export function mimeTypeForExtension(extension) {
	return extension === "jpg" || extension === "jpeg" ? "image/jpeg" : "image/png";
}

export function thumbNameForFileName(fileName) {
	return fileName.replace(/\.[^.]+$/, "_thumb.webp");
}

export function canvasToBlob(canvas, type, quality) {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error("canvas_to_blob_failed"));
				}
			},
			type,
			quality,
		);
	});
}

export async function encodeSafeImage(source, maxSize, type, quality) {
	const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
	const scale = Number.isFinite(maxSize) ? Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height)) : 1;
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) {
		bitmap.close();
		throw new Error("canvas_context_unavailable");
	}
	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	const blob = await canvasToBlob(canvas, type, quality);
	return { blob, width, height };
}

export async function measureImageSource(source) {
	const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
	const dimensions = { width: bitmap.width, height: bitmap.height };
	bitmap.close();
	return dimensions;
}
