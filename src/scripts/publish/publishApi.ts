export async function publishErrorMessage(response: Response): Promise<string> {
	try {
		const body = await response.json();
		return body?.message || body?.error || `Publish failed (${response.status})`;
	} catch {
		return `Publish failed (${response.status})`;
	}
}
