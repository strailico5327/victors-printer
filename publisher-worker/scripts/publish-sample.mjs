const target = process.argv[2] ?? "http://localhost:8787/api/publish";
const eventId = "a8f3k2p9";

const manifest = {
	id: eventId,
	datetime: "2026-06-21T23:15:00+08:00",
	location: "Fuzhou",
	content: "content.md",
	images: [
		{
			id: `${eventId}-1`,
			width: 1600,
			height: 1200,
			thumbWidth: 480,
			thumbHeight: 360,
			alt: "",
		},
	],
};

const content = `Saw a strange sky on the way back.

:!grid 1 1 1/1
:!img ${eventId}-1.webp 20260621
!:grid
`;

const sampleWebp = new Blob([new TextEncoder().encode("RIFF0000WEBPVP8 ")], {
	type: "image/webp",
});
const sampleThumb = new Blob([new TextEncoder().encode("RIFF0000WEBPVP8 ")], {
	type: "image/webp",
});

const form = new FormData();
form.set("manifest", JSON.stringify(manifest));
form.set("content", content);
form.append("images[]", sampleWebp, `${eventId}-1.webp`);
form.append("thumbs[]", sampleThumb, `${eventId}-1_thumb.webp`);

const response = await fetch(target, {
	method: "POST",
	body: form,
});

const body = await response.text();
console.log(`${response.status} ${response.statusText}`);
console.log(body);

if (!response.ok) {
	process.exitCode = 1;
}
