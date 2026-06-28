import { strToU8, zipSync } from "fflate";

const target = process.argv[2] ?? "http://localhost:8787/api/publish";
const eventId = "2106262315-a8f3k2p9";

const markdown = `---
type: "event"
id: "${eventId}"
published: 2026-06-21T23:15:00+08:00
draft: true
location: "Fuzhou"
---

Saw a strange sky on the way back.

:!img ${eventId}-1.png
`;

const files = {
	[`${eventId}.md`]: strToU8(markdown),
	[`images/${eventId}-1.png`]: new Uint8Array([137, 80, 78, 71]),
	[`images/${eventId}-1_thumb.webp`]: new TextEncoder().encode("RIFF0000WEBPVP8 "),
};

const form = new FormData();
form.set("draft", new Blob([zipSync(files)], { type: "application/zip" }), `${eventId}-draft.zip`);

const response = await fetch(target, { method: "POST", body: form });
console.log(`${response.status} ${response.statusText}`);
console.log(await response.text());

if (!response.ok) {
	process.exitCode = 1;
}
