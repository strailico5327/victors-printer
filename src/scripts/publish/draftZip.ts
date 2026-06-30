export function draftMarkdownFileName(eventId: string): string {
	return `${eventId}.md`;
}

export function draftZipFileName(eventId: string): string {
	return `${eventId}-draft.zip`;
}
