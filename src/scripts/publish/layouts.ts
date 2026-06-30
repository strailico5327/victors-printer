export type Ratio = {
	width: number;
	height: number;
};

export function clampGridSize(value: number): number {
	return Math.min(4, Math.max(1, value));
}

export function parseGridRatio(value: string | undefined, fallbackWidth = 1, fallbackHeight = 1): Ratio {
	const [rawWidth, rawHeight] = `${value ?? ""}`.split(":");
	const width = Math.max(1, Number.parseInt(rawWidth, 10) || fallbackWidth);
	const height = Math.max(1, Number.parseInt(rawHeight, 10) || fallbackHeight);
	return { width, height };
}

export function gridRatioLabel(width: number, height: number): string {
	return `${width}:${height}`;
}
