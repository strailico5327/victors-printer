export function yamlString(value: unknown): string {
	return JSON.stringify(String(value ?? ""));
}
