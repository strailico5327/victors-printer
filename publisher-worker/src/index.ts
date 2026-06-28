type Env = {
	GITHUB_OWNER: string;
	GITHUB_REPO: string;
	GITHUB_BRANCH: string;
	GITHUB_TOKEN: string;
	CF_ACCESS_TEAM_DOMAIN: string;
	CF_ACCESS_AUD: string;
	ALLOW_LOCAL_BYPASS?: string;
	LOCAL_DRY_RUN?: string;
	MAX_IMAGES?: string;
	MAX_IMAGE_BYTES?: string;
	MAX_CONTENT_BYTES?: string;
	MAX_REQUEST_BYTES?: string;
};

type TimelineImage = {
	id: string;
	src?: string;
	thumb?: string;
	file?: string;
	alt?: string;
	width: number;
	height: number;
	thumbWidth: number;
	thumbHeight: number;
};

type DraftManifest = {
	id?: string;
	datetime: string;
	location?: string;
	content?: string;
	images?: TimelineImage[];
	grid?: unknown;
};

type PublishedImage = {
	id: string;
	src: string;
	thumb: string;
	alt: string;
	width: number;
	height: number;
	thumbWidth: number;
	thumbHeight: number;
};

type PublishedEvent = {
	id: string;
	datetime: string;
	location?: string;
	content: string;
	images: PublishedImage[];
};

type AccessJwk = JsonWebKey & {
	kid?: string;
};

type GithubContentResponse = {
	sha: string;
	content?: string;
	encoding?: string;
};

type AccessCerts = {
	keys: AccessJwk[];
};

const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"cache-control": "no-store",
};

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{5,31}$/;
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

async function handlePublish(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const contentLength = Number(request.headers.get("content-length") ?? "0");
	const maxRequestBytes = readLimit(env.MAX_REQUEST_BYTES, 50 * 1024 * 1024);
	if (contentLength > maxRequestBytes) {
		throw new HttpError(413, "request_too_large", "Request body exceeds the configured limit.");
	}

	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.toLowerCase().includes("multipart/form-data")) {
		throw new HttpError(415, "unsupported_media_type", "Use multipart/form-data.");
	}

	const form = await request.formData();
	const manifest = parseManifest(getRequiredString(form, "manifest"));
	const eventId = normalizeEventId(manifest.id);
	const content = await readContentField(form);
	const dateParts = parseTimelineDate(manifest.datetime);
	const imageFiles = getFileList(form, "images[]", "images");
	const thumbFiles = getFileList(form, "thumbs[]", "thumbs");

	validateContent(content, env);
	validateManifest(manifest);
	validateImageCounts(imageFiles, thumbFiles, manifest.images ?? [], env);
	validateImageFiles(eventId, imageFiles, thumbFiles, env);

	const paths = buildPaths(eventId, dateParts.year, dateParts.month);
	const publishedImages = buildPublishedImages(eventId, manifest.images ?? []);
	const event: PublishedEvent = {
		id: eventId,
		datetime: manifest.datetime,
		content: `${eventId}.md`,
		images: publishedImages,
	};

	if (manifest.location?.trim()) {
		event.location = manifest.location.trim();
	}

	if (isLocalDryRun(url, env)) {
		return json({
			ok: true,
			dryRun: true,
			id: eventId,
			commit: null,
			paths: {
				manifest: paths.manifest,
				content: paths.content,
				images: [...imageFiles, ...thumbFiles].map((file) => `public/images/timeline/${file.name}`),
			},
			event,
		});
	}

	const github = createGithubClient(env);
	const existingManifest = await github.getJson<PublishedEvent[]>(paths.manifest, []);

	if (existingManifest.some((item) => item.id === eventId)) {
		throw new HttpError(409, "duplicate_event_id", "This event id already exists in the target month.");
	}

	if (await github.exists(paths.content)) {
		throw new HttpError(409, "content_exists", "The target content file already exists.");
	}

	await github.putText(paths.content, content, `timeline: add ${eventId} content`);

	for (const file of imageFiles) {
		await github.putBytes(`public/images/timeline/${file.name}`, await file.arrayBuffer(), `timeline: add ${file.name}`);
	}

	for (const file of thumbFiles) {
		await github.putBytes(`public/images/timeline/${file.name}`, await file.arrayBuffer(), `timeline: add ${file.name}`);
	}

	const nextManifest = sortManifest([...existingManifest, event]);
	const manifestCommit = await github.putJson(paths.manifest, nextManifest, `timeline: publish ${eventId}`);

	return json({
		ok: true,
		id: eventId,
		commit: manifestCommit,
		paths: {
			manifest: paths.manifest,
			content: paths.content,
			images: [...imageFiles, ...thumbFiles].map((file) => `public/images/timeline/${file.name}`),
		},
	});
}

function parseManifest(value: string): DraftManifest {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new HttpError(400, "invalid_manifest_json", "manifest must be valid JSON.");
	}

	if (!parsed || typeof parsed !== "object") {
		throw new HttpError(400, "invalid_manifest", "manifest must be an object.");
	}

	return parsed as DraftManifest;
}

function validateManifest(manifest: DraftManifest): void {
	if (typeof manifest.datetime !== "string") {
		throw new HttpError(400, "invalid_datetime", "datetime is required.");
	}

	parseTimelineDate(manifest.datetime);

	if (manifest.location !== undefined && typeof manifest.location !== "string") {
		throw new HttpError(400, "invalid_location", "location must be a string.");
	}

	if (manifest.location && manifest.location.length > 120) {
		throw new HttpError(400, "location_too_long", "location must be at most 120 characters.");
	}

	if (manifest.images !== undefined && !Array.isArray(manifest.images)) {
		throw new HttpError(400, "invalid_images", "images must be an array.");
	}
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

function validateImageCounts(files: File[], thumbs: File[], images: TimelineImage[], env: Env): void {
	const maxImages = readLimit(env.MAX_IMAGES, 16);

	if (files.length > maxImages) {
		throw new HttpError(413, "too_many_images", "Too many images.");
	}

	if (files.length !== thumbs.length) {
		throw new HttpError(400, "image_thumb_mismatch", "Every image must have one thumbnail.");
	}

	if (images.length !== files.length) {
		throw new HttpError(400, "manifest_image_mismatch", "manifest.images must match uploaded images.");
	}
}

function validateImageFiles(eventId: string, images: File[], thumbs: File[], env: Env): void {
	const maxImageBytes = readLimit(env.MAX_IMAGE_BYTES, 5 * 1024 * 1024);
	const expectedThumbs = new Set<string>();

	for (const file of images) {
		if (!file.name.match(new RegExp(`^${escapeRegExp(eventId)}-\\d+\\.webp$`))) {
			throw new HttpError(400, "invalid_image_name", `Invalid image filename: ${file.name}`);
		}

		if (file.type && file.type !== "image/webp") {
			throw new HttpError(400, "invalid_image_type", "Only image/webp uploads are accepted.");
		}

		if (file.size > maxImageBytes) {
			throw new HttpError(413, "image_too_large", `${file.name} exceeds the configured limit.`);
		}

		expectedThumbs.add(file.name.replace(/\.webp$/, "_thumb.webp"));
	}

	for (const file of thumbs) {
		if (!expectedThumbs.has(file.name)) {
			throw new HttpError(400, "invalid_thumb_name", `Invalid thumbnail filename: ${file.name}`);
		}

		if (file.type && file.type !== "image/webp") {
			throw new HttpError(400, "invalid_thumb_type", "Only image/webp thumbnails are accepted.");
		}

		if (file.size > maxImageBytes) {
			throw new HttpError(413, "thumb_too_large", `${file.name} exceeds the configured limit.`);
		}
	}
}

function buildPublishedImages(eventId: string, images: TimelineImage[]): PublishedImage[] {
	return images.map((image) => {
		if (!image.id.match(new RegExp(`^${escapeRegExp(eventId)}-\\d+$`))) {
			throw new HttpError(400, "invalid_image_id", `Invalid image id: ${image.id}`);
		}

		for (const key of ["width", "height", "thumbWidth", "thumbHeight"] as const) {
			if (!Number.isInteger(image[key]) || image[key] <= 0) {
				throw new HttpError(400, "invalid_image_dimensions", `${image.id} has invalid dimensions.`);
			}
		}

		return {
			id: image.id,
			src: `/images/timeline/${image.id}.webp`,
			thumb: `/images/timeline/${image.id}_thumb.webp`,
			alt: image.alt ?? "",
			width: image.width,
			height: image.height,
			thumbWidth: image.thumbWidth,
			thumbHeight: image.thumbHeight,
		};
	});
}

function normalizeEventId(value: unknown): string {
	if (value === undefined || value === null || value === "") {
		return generateEventId();
	}

	if (typeof value !== "string" || !ID_PATTERN.test(value)) {
		throw new HttpError(400, "invalid_event_id", "id must match [a-z0-9-] and be 6-32 characters.");
	}

	return value;
}

function generateEventId(): string {
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
	let id = "";

	for (const byte of bytes) {
		id += alphabet[byte % alphabet.length];
	}

	return id;
}

function parseTimelineDate(value: string): { year: string; month: string; yyyymmdd: string } {
	const match = ISO_WITH_ZONE.exec(value);
	if (!match) {
		throw new HttpError(400, "invalid_datetime", "datetime must be ISO 8601 with timezone.");
	}

	const [, year, month, day, hour, minute, second = "00", zone] = match;
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

	return { year, month, yyyymmdd: `${year}${month}${day}` };
}

function buildPaths(eventId: string, year: string, month: string): { manifest: string; content: string } {
	const base = `src/content/timeline/${year}/${month}`;
	return {
		manifest: `${base}/manifest.json`,
		content: `${base}/${eventId}.md`,
	};
}

function sortManifest(events: PublishedEvent[]): PublishedEvent[] {
	return [...events].sort((a, b) => b.datetime.localeCompare(a.datetime));
}

async function readContentField(form: FormData): Promise<string> {
	const content = form.get("content");

	if (typeof content === "string") {
		return content;
	}

	if (content instanceof File) {
		return await content.text();
	}

	const file = form.get("content.md");
	if (file instanceof File) {
		return await file.text();
	}

	throw new HttpError(400, "missing_content", "content is required.");
}

function getRequiredString(form: FormData, key: string): string {
	const value = form.get(key);
	if (typeof value !== "string") {
		throw new HttpError(400, `missing_${key}`, `${key} is required.`);
	}

	return value;
}

function getFileList(form: FormData, primary: string, fallback: string): File[] {
	const values = [...form.getAll(primary), ...form.getAll(fallback)];
	return values.filter((value): value is File => value instanceof File);
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

	const issuer = normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
	if (payload.iss !== issuer) {
		throw new HttpError(403, "invalid_access_issuer", "Cloudflare Access issuer mismatch.");
	}

	const certs = await getAccessCerts(env);
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

async function getAccessCerts(env: Env): Promise<AccessCerts> {
	const now = Date.now();
	if (accessCertsCache && accessCertsCache.expiresAt > now) {
		return accessCertsCache.certs;
	}

	const response = await fetch(`${normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN)}/cdn-cgi/access/certs`);
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
		"user-agent": "strailico-timeline-publisher",
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
			throw new HttpError(502, "github_read_failed", `GitHub read failed for ${path}.`);
		}

		return (await response.json()) as GithubContentResponse;
	}

	return {
		async exists(path: string): Promise<boolean> {
			return (await getContent(path)) !== null;
		},

		async getJson<T>(path: string, fallback: T): Promise<T> {
			const item = await getContent(path);
			if (!item?.content) {
				return fallback;
			}

			const text = decodeBase64ToText(item.content.replace(/\n/g, ""));
			return JSON.parse(text) as T;
		},

		async putJson(path: string, value: unknown, message: string): Promise<string> {
			const text = `${JSON.stringify(value, null, 2)}\n`;
			return await this.putText(path, text, message);
		},

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
	};
}

function normalizeTeamDomain(value: string): string {
	return value.replace(/\/+$/, "");
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
