export function randomId(): string {
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
		.join("")
		.slice(0, 8);
}

export const maxImages = 16;
export const tileCount = maxImages;
