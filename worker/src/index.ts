import { strFromU8, unzipSync } from "fflate";

type Env = {
	GITHUB_OWNER: string;
	GITHUB_REPO: string;
	GITHUB_BRANCH: string;
	GITHUB_TOKEN: string;
	CF_ACCESS_TEAM_DOMAIN: string;
	CF_ACCESS_AUD: string;
	PAGES_DEPLOY_HOOK_URL?: string;
	ALLOW_LOCAL_BYPASS?: string;
	LOCAL_DRY_RUN?: string;
	MAX_IMAGES?: string;
	MAX_IMAGE_BYTES?: string;
	MAX_CONTENT_BYTES?: string;
	MAX_REQUEST_BYTES?: string;
};

type DraftEvent = {
	type?: string;
	id: string;
	published: string;
	draft?: string;
	location?: string;
};

type AccessJwk = JsonWebKey & {
	kid?: string;
};

type GithubContentResponse = {
	sha: string;
	content?: string;
	encoding?: string;
};

type GithubDirectoryItem = {
	name: string;
	path: string;
	sha: string;
	type: string;
};

type AccessCerts = {
	keys: AccessJwk[];
};

const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"cache-control": "no-store",
};
const PUBLIC_SITE_ORIGIN = "https://strailico.me";

const ID_PATTERN = /^\d{10}-[a-z0-9]{8}$/;
const ISO_WITH_ZONE =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

let accessCertsCache: { expiresAt: number; certs: AccessCerts } | undefined;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		try {
			const url = new URL(request.url);

			if (request.method === "OPTIONS") {
				return withCors(new Response(null, { status: 204 }), request);
			}

			if (url.pathname === "/api/health" && request.method === "GET") {
				await assertAccess(request, env);
				return json({ ok: true }, 200, request);
			}

			if (url.pathname === "/api/publish" && request.method === "POST") {
				await assertAccess(request, env);
				return withCors(await handlePublish(request, env), request);
			}

			if ((request.method === "GET" || request.method === "HEAD") && url.hostname === "dashboard.strailico.me") {
				return handlePublisherPageRequest(request, url);
			}

			return json({ ok: false, error: "not_found" }, 404, request);
		} catch (error) {
			if (error instanceof HttpError) {
				return json({ ok: false, error: error.code, message: error.message }, error.status, request);
			}

			console.error(JSON.stringify({ level: "error", error: String(error) }));
			return json({ ok: false, error: "internal_error" }, 500, request);
		}
	},
};

async function handlePublisherPageRequest(request: Request, url: URL): Promise<Response> {
	if (!isPublisherProxyPath(url.pathname)) {
		return Response.redirect(new URL(`${url.pathname}${url.search}`, PUBLIC_SITE_ORIGIN), 302);
	}

	return proxyPublicSite(request, url);
}

function isPublisherProxyPath(pathname: string): boolean {
	return (
		pathname === "/" ||
		pathname === "/dashboard" ||
		pathname === "/dashboard/" ||
		pathname === "/publish" ||
		pathname === "/publish/" ||
		pathname.startsWith("/_astro/") ||
		pathname.startsWith("/images/")
	);
}

async function proxyPublicSite(request: Request, url: URL): Promise<Response> {
	if (url.pathname === "/dashboard" || url.pathname === "/dashboard/") {
		return Response.redirect(new URL("/", url), 301);
	}

	const pathname = url.pathname === "/" ? "/publish/" : url.pathname;
	const target = new URL(`${pathname}${url.search}`, PUBLIC_SITE_ORIGIN);
	const response = await fetch(target, { method: request.method });
	return new Response(response.body, response);
}

async function handlePublish(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const contentLength = Number(request.headers.get("content-length") ?? "0");
	const maxRequestBytes = readLimit(env.MAX_REQUEST_BYTES, 100 * 1024 * 1024);
	if (contentLength > maxRequestBytes) {
		throw new HttpError(413, "request_too_large", "Request body exceeds the configured limit.");
	}

	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.toLowerCase().includes("multipart/form-data")) {
		throw new HttpError(415, "unsupported_media_type", "Use multipart/form-data.");
	}

	const form = await request.formData();
	const draft = form.get("draft");
	if (!(draft instanceof File)) {
		throw new HttpError(400, "missing_draft", "draft zip is required.");
	}

	const zip = unzipSync(new Uint8Array(await draft.arrayBuffer()));
	const event = parseDraftZip(zip, env);
	const dateParts = parseTimelineDate(event.frontmatter.published);
	const paths = buildPaths(event.id, dateParts.year, dateParts.month);
	const imagePaths = event.images.map((image) => `public/images/timeline/${dateParts.year}/${dateParts.month}/${image.name}`);

	if (isLocalDryRun(url, env)) {
		return json({
			ok: true,
			dryRun: true,
			id: event.id,
			commit: null,
			paths: {
				content: paths.content,
				images: imagePaths,
			},
		});
	}

	const github = createGithubClient(env);
	await github.deleteMatching(
		`public/images/timeline/${dateParts.year}/${dateParts.month}`,
		(image) => image.name.startsWith(`${event.id}-`),
		`timeline: replace ${event.id} images`,
	);

	let commit = "";
	for (let index = 0; index < event.images.length; index += 1) {
		const image = event.images[index];
		commit = await github.putBytes(imagePaths[index], toArrayBuffer(image.bytes), `timeline: publish ${image.name}`);
	}
	commit = await github.putText(paths.content, event.markdown, `timeline: publish ${event.id}`);
	const deploy = await triggerPagesDeploy(env);

	return json({
		ok: true,
		id: event.id,
		commit,
		deploy,
		paths: {
			content: paths.content,
			images: imagePaths,
		},
	});
}

async function triggerPagesDeploy(env: Env): Promise<{ configured: boolean; ok?: boolean; status?: number; error?: string }> {
	const hook = env.PAGES_DEPLOY_HOOK_URL?.trim();
	if (!hook) {
		return { configured: false };
	}

	try {
		const response = await fetch(hook, { method: "POST" });
		if (response.ok) {
			return { configured: true, ok: true, status: response.status };
		}

		const detail = await response.text();
		const error = responsePreview(detail);
		console.error(JSON.stringify({ level: "warn", status: response.status, error }));
		return { configured: true, ok: false, status: response.status, error };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(JSON.stringify({ level: "warn", error: message }));
		return { configured: true, ok: false, error: message };
	}
}

function parseDraftZip(zip: Record<string, Uint8Array>, env: Env): {
	id: string;
	frontmatter: DraftEvent;
	markdown: string;
	images: { name: string; bytes: Uint8Array }[];
} {
	const markdownPaths = Object.keys(zip).filter((name) => !name.includes("/") && name.toLowerCase().endsWith(".md"));
	if (markdownPaths.length !== 1) {
		throw new HttpError(400, "invalid_draft_zip", "zip must contain exactly one root markdown file.");
	}

	const markdown = strFromU8(zip[markdownPaths[0]]);
	validateContent(markdown, env);
	const { data, body } = parseFrontmatter(markdown);
	validateDraftEvent(data);
	const eventId = data.id;
	const expectedMarkdownPath = `${eventId}.md`;
	if (markdownPaths[0] !== expectedMarkdownPath) {
		throw new HttpError(400, "invalid_markdown_name", `markdown file must be ${expectedMarkdownPath}.`);
	}

	const images = Object.entries(zip)
		.filter(([name]) => name.startsWith("images/") && name.split("/").length === 2)
		.map(([path, bytes]) => ({ name: path.slice("images/".length), bytes }));
	validateImageFiles(eventId, images, env);

	return {
		id: eventId,
		frontmatter: data,
		markdown: buildPublishedMarkdown(data, body),
		images,
	};
}

function parseFrontmatter(markdown: string): { data: DraftEvent; body: string } {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) {
		throw new HttpError(400, "missing_frontmatter", "markdown frontmatter is required.");
	}

	const data: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const item = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
		if (!item) {
			continue;
		}
		const [, key, rawValue] = item;
		data[key] = parseYamlScalar(rawValue);
	}

	return { data: data as DraftEvent, body: markdown.slice(match[0].length) };
}

function parseYamlScalar(value: string): string {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return trimmed.slice(1, -1);
		}
	}
	return trimmed;
}

function validateDraftEvent(event: DraftEvent): void {
	if (event.type !== "event") {
		throw new HttpError(400, "invalid_event_type", 'type must be "event".');
	}
	if (!ID_PATTERN.test(event.id)) {
		throw new HttpError(400, "invalid_event_id", "id must match ddmmyyhhmm-xxxxxxxx.");
	}
	parseTimelineDate(event.published);
	if (event.location !== undefined && event.location.length > 120) {
		throw new HttpError(400, "location_too_long", "location must be at most 120 characters.");
	}
}

function buildPublishedMarkdown(event: DraftEvent, body: string): string {
	const lines = [
		"---",
		'type: "event"',
		`id: ${JSON.stringify(event.id)}`,
		`published: ${event.published}`,
		"draft: false",
		`location: ${JSON.stringify(event.location ?? "")}`,
		"---",
		"",
		body.trimEnd(),
		"",
	];
	return lines.join("\n");
}

function validateContent(content: string, env: Env): void {
	const maxContentBytes = readLimit(env.MAX_CONTENT_BYTES, 20_000);
	const bytes = new TextEncoder().encode(content).byteLength;

	if (bytes === 0) {
		throw new HttpError(400, "empty_content", "content is required.");
	}

	if (bytes > maxContentBytes) {
		throw new HttpError(413, "content_too_large", "content.md exceeds the configured limit.");
	}

	if (content.includes("\0")) {
		throw new HttpError(400, "invalid_content", "content contains invalid characters.");
	}
}

function validateImageFiles(eventId: string, images: { name: string; bytes: Uint8Array }[], env: Env): void {
	const maxImages = readLimit(env.MAX_IMAGES, 16);
	const originals = new Set<string>();
	const thumbs = new Set<string>();
	if (images.length > maxImages * 2) {
		throw new HttpError(413, "too_many_images", "Too many images.");
	}

	for (const image of images) {
		if (image.bytes.byteLength > readLimit(env.MAX_IMAGE_BYTES, 25 * 1024 * 1024)) {
			throw new HttpError(413, "image_too_large", `${image.name} exceeds the configured limit.`);
		}
		const original = image.name.match(new RegExp(`^${escapeRegExp(eventId)}-(\\d+)\\.(?:jpe?g|png)$`, "i"));
		if (original) {
			originals.add(original[1]);
			continue;
		}
		const thumb = image.name.match(new RegExp(`^${escapeRegExp(eventId)}-(\\d+)_thumb\\.webp$`));
		if (thumb) {
			thumbs.add(thumb[1]);
			continue;
		}
		throw new HttpError(400, "invalid_image_name", `Invalid image filename: ${image.name}`);
	}

	for (const imageNumber of originals) {
		if (!thumbs.has(imageNumber)) {
			throw new HttpError(400, "missing_thumb", `Missing thumbnail for ${eventId}-${imageNumber}.`);
		}
	}
	if (thumbs.size !== originals.size) {
		throw new HttpError(400, "orphan_thumb", "Every thumbnail must match an original image.");
	}
}

function parseTimelineDate(value: string): { year: string; month: string } {
	const match = ISO_WITH_ZONE.exec(value);
	if (!match) {
		throw new HttpError(400, "invalid_datetime", "datetime must be ISO 8601 with timezone.");
	}

	const [, year, month, day, hour, minute, second = "00"] = match;
	const parsed = new Date(value);

	if (Number.isNaN(parsed.getTime())) {
		throw new HttpError(400, "invalid_datetime", "datetime is not a valid date.");
	}

	const monthNumber = Number(month);
	const dayNumber = Number(day);
	const hourNumber = Number(hour);
	const minuteNumber = Number(minute);
	const secondNumber = Number(second);
	const maxDay = new Date(Date.UTC(Number(year), monthNumber, 0)).getUTCDate();

	if (
		monthNumber < 1 ||
		monthNumber > 12 ||
		dayNumber < 1 ||
		dayNumber > maxDay ||
		hourNumber > 23 ||
		minuteNumber > 59 ||
		secondNumber > 59
	) {
		throw new HttpError(400, "invalid_datetime", "datetime is not a valid date.");
	}

	return { year, month };
}

function buildPaths(eventId: string, year: string, month: string): { content: string } {
	const base = `src/content/timeline/${year}/${month}`;
	return {
		content: `${base}/${eventId}.md`,
	};
}

async function assertAccess(request: Request, env: Env): Promise<void> {
	const url = new URL(request.url);
	if (env.ALLOW_LOCAL_BYPASS === "true" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
		return;
	}

	const token = request.headers.get("cf-access-jwt-assertion");
	if (!token) {
		throw new HttpError(401, "missing_access_jwt", "Cloudflare Access JWT is required.");
	}

	await verifyAccessJwt(token, env);
}

async function verifyAccessJwt(token: string, env: Env): Promise<void> {
	const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
	if (!encodedHeader || !encodedPayload || !encodedSignature) {
		throw new HttpError(401, "invalid_access_jwt", "Malformed Cloudflare Access JWT.");
	}

	const header = JSON.parse(decodeBase64UrlToText(encodedHeader)) as { kid?: string; alg?: string };
	const payload = JSON.parse(decodeBase64UrlToText(encodedPayload)) as {
		aud?: string | string[];
		exp?: number;
		nbf?: number;
		iss?: string;
	};

	if (header.alg !== "RS256" || !header.kid) {
		throw new HttpError(401, "invalid_access_jwt", "Unsupported Access JWT header.");
	}

	const now = Math.floor(Date.now() / 1000);
	if (!payload.exp || payload.exp <= now || (payload.nbf && payload.nbf > now)) {
		throw new HttpError(401, "expired_access_jwt", "Cloudflare Access JWT is expired or not yet valid.");
	}

	const expectedAud = env.CF_ACCESS_AUD;
	const actualAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
	if (!actualAud.includes(expectedAud)) {
		throw new HttpError(403, "invalid_access_audience", "Cloudflare Access audience mismatch.");
	}

	const issuer = getAccessIssuer(payload.iss);
	if (!issuer) {
		throw new HttpError(403, "invalid_access_issuer", "Cloudflare Access issuer mismatch.");
	}

	const certs = await getAccessCerts(issuer);
	const jwk = certs.keys.find((key) => key.kid === header.kid);
	if (!jwk) {
		throw new HttpError(401, "unknown_access_key", "Access JWT signing key was not found.");
	}

	const key = await crypto.subtle.importKey(
		"jwk",
		jwk,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);
	const signedData = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
	const signature = decodeBase64UrlToBytes(encodedSignature);
	const signatureBuffer = new ArrayBuffer(signature.byteLength);
	new Uint8Array(signatureBuffer).set(signature);
	const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signatureBuffer, signedData);

	if (!valid) {
		throw new HttpError(401, "invalid_access_signature", "Cloudflare Access JWT signature is invalid.");
	}
}

async function getAccessCerts(issuer: string): Promise<AccessCerts> {
	const now = Date.now();
	if (accessCertsCache && accessCertsCache.expiresAt > now) {
		return accessCertsCache.certs;
	}

	const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
	if (!response.ok) {
		throw new HttpError(502, "access_certs_unavailable", "Unable to fetch Cloudflare Access certificates.");
	}

	const certs = (await response.json()) as AccessCerts;
	accessCertsCache = {
		expiresAt: now + 60 * 60 * 1000,
		certs,
	};

	return certs;
}

function createGithubClient(env: Env) {
	const apiBase = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents`;
	const headers = {
		accept: "application/vnd.github+json",
		authorization: `Bearer ${env.GITHUB_TOKEN}`,
		"user-agent": "victors-printer-publisher",
		"x-github-api-version": "2022-11-28",
	};

	async function request(path: string, init?: RequestInit & { searchParams?: Record<string, string> }): Promise<Response> {
		const { searchParams, ...requestInit } = init ?? {};
		const encodedPath = path.split("/").map(encodeURIComponent).join("/");
		const url = new URL(`${apiBase}/${encodedPath}`);
		for (const [key, value] of Object.entries(searchParams ?? {})) {
			url.searchParams.set(key, value);
		}

		const response = await fetch(url, {
			...requestInit,
			headers: {
				...headers,
				...(requestInit.headers ?? {}),
			},
		});

		return response;
	}

	async function getContent(path: string): Promise<GithubContentResponse | null> {
		const response = await request(path, { searchParams: { ref: env.GITHUB_BRANCH } });
		if (response.status === 404) {
			return null;
		}

		if (!response.ok) {
			throw await githubReadError(path, response);
		}

		return (await response.json()) as GithubContentResponse;
	}

	async function getDirectory(path: string): Promise<GithubDirectoryItem[]> {
		const response = await request(path, { searchParams: { ref: env.GITHUB_BRANCH } });
		if (response.status === 404) {
			return [];
		}

		if (!response.ok) {
			throw await githubReadError(path, response);
		}

		const body = (await response.json()) as unknown;
		return Array.isArray(body) ? (body as GithubDirectoryItem[]) : [];
	}

	return {
		async putText(path: string, text: string, message: string): Promise<string> {
			const bytes = new TextEncoder().encode(text);
			return await this.putBytes(path, bytes.buffer as ArrayBuffer, message);
		},

		async putBytes(path: string, bytes: ArrayBuffer, message: string): Promise<string> {
			const existing = await getContent(path);
			const response = await request(path, {
				method: "PUT",
				body: JSON.stringify({
					message,
					content: arrayBufferToBase64(bytes),
					branch: env.GITHUB_BRANCH,
					...(existing?.sha ? { sha: existing.sha } : {}),
				}),
			});

			if (!response.ok) {
				const detail = await response.text();
				console.error(JSON.stringify({ level: "error", path, status: response.status, detail }));
				throw new HttpError(502, "github_write_failed", `GitHub write failed for ${path}.`);
			}

			const body = (await response.json()) as { commit?: { sha?: string } };
			return body.commit?.sha ?? "";
		},

		async deleteMatching(path: string, matches: (item: GithubDirectoryItem) => boolean, message: string): Promise<void> {
			let items: GithubDirectoryItem[];
			try {
				items = (await getDirectory(path)).filter((item) => item.type === "file" && matches(item));
			} catch (error) {
				if (error instanceof HttpError && error.code === "github_read_failed") {
					console.error(JSON.stringify({ level: "warn", path, error: error.message }));
					return;
				}
				throw error;
			}
			for (const item of items) {
				const response = await request(item.path, {
					method: "DELETE",
					body: JSON.stringify({
						message,
						sha: item.sha,
						branch: env.GITHUB_BRANCH,
					}),
				});

				if (!response.ok && response.status !== 404) {
					const detail = await response.text();
					console.error(JSON.stringify({ level: "error", path: item.path, status: response.status, detail }));
					throw new HttpError(502, "github_delete_failed", `GitHub delete failed for ${item.path}.`);
				}
			}
		},
	};
}

async function githubReadError(path: string, response: Response): Promise<HttpError> {
	const detail = await response.text();
	console.error(JSON.stringify({ level: "error", path, status: response.status, detail }));
	return new HttpError(502, "github_read_failed", `GitHub read failed for ${path} (${response.status}): ${githubErrorMessage(detail)}`);
}

function githubErrorMessage(detail: string): string {
	try {
		const body = JSON.parse(detail) as { message?: string };
		return body.message ?? responsePreview(detail);
	} catch {
		return responsePreview(detail);
	}
}

function responsePreview(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function normalizeTeamDomain(value: string): string {
	return value.replace(/\/+$/, "");
}

function getAccessIssuer(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const issuer = normalizeTeamDomain(value);
	const hostname = new URL(issuer).hostname;
	return hostname === "cloudflareaccess.com" || hostname.endsWith(".cloudflareaccess.com") ? issuer : undefined;
}

function isLocalDryRun(url: URL, env: Env): boolean {
	return env.LOCAL_DRY_RUN === "true" && ["localhost", "127.0.0.1"].includes(url.hostname);
}

function readLimit(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function json(body: unknown, status = 200, request?: Request): Response {
	return withCors(new Response(JSON.stringify(body), {
		status,
		headers: JSON_HEADERS,
	}), request);
}

function withCors(response: Response, request?: Request): Response {
	const origin = request?.headers.get("origin");
	if (!origin) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set("access-control-allow-origin", origin);
	headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
	headers.set("access-control-allow-headers", "content-type,cf-access-jwt-assertion");
	headers.set("access-control-allow-credentials", "true");
	headers.set("access-control-max-age", "86400");
	headers.append("vary", "Origin");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function decodeBase64UrlToText(value: string): string {
	return new TextDecoder().decode(decodeBase64UrlToBytes(value));
}

function decodeBase64UrlToBytes(value: string): Uint8Array {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
	return decodeBase64ToBytes(padded);
}

function decodeBase64ToText(value: string): string {
	return new TextDecoder().decode(decodeBase64ToBytes(value));
}

function decodeBase64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	const chunkSize = 0x8000;

	for (let index = 0; index < bytes.length; index += chunkSize) {
		const chunk = bytes.subarray(index, index + chunkSize);
		binary += String.fromCharCode(...chunk);
	}

	return btoa(binary);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
	) {
		super(message);
	}
}
