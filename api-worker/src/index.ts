type Env = {
	LASTFM_API_KEY?: string;
	LASTFM_USER?: string;
	PUBLIC_SITE_ORIGIN?: string;
};

type LastFmTrack = {
	name?: string;
	artist?: {
		"#text"?: string;
	};
	url?: string;
	"@attr"?: {
		nowplaying?: string;
	};
};

const DEFAULT_PUBLIC_SITE_ORIGIN = "https://strailico.me";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return withCors(new Response(null, { status: 204 }), request, env);
		}

		if (url.pathname === "/health" && request.method === "GET") {
			return json({ ok: true }, 200, request, env, 60);
		}

		if (url.pathname === "/now-playing" && (request.method === "GET" || request.method === "HEAD")) {
			return withCors(await handleNowPlaying(env, request.method), request, env);
		}

		return json({ ok: false, error: "not_found" }, 404, request, env);
	},
};

async function handleNowPlaying(env: Env, method: string): Promise<Response> {
	if (method === "HEAD") {
		return new Response(null, { status: 204, headers: publicJsonHeaders(30) });
	}

	const apiKey = env.LASTFM_API_KEY?.trim();
	if (!apiKey) {
		return new Response(JSON.stringify({ ok: false, error: "lastfm_api_key_missing" }), {
			status: 503,
			headers: publicJsonHeaders(30),
		});
	}

	const params = new URLSearchParams({
		method: "user.getrecenttracks",
		user: env.LASTFM_USER?.trim() || "strailynx",
		api_key: apiKey,
		format: "json",
		limit: "1",
	});
	const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
		headers: { accept: "application/json" },
	});

	if (!response.ok) {
		return new Response(JSON.stringify({ ok: false, error: "lastfm_unavailable" }), {
			status: 502,
			headers: publicJsonHeaders(30),
		});
	}

	const data = (await response.json()) as {
		recenttracks?: {
			track?: LastFmTrack[];
		};
	};
	const track = data.recenttracks?.track?.[0];
	const nowPlaying = track?.["@attr"]?.nowplaying === "true";

	return new Response(JSON.stringify({ ok: true, track: nowPlaying ? normalizeLastFmTrack(track) : null }), {
		status: 200,
		headers: publicJsonHeaders(30),
	});
}

function normalizeLastFmTrack(track: LastFmTrack): {
	title: string;
	artist: string;
	url: string;
	nowPlaying: true;
} {
	return {
		title: track.name ?? "Unknown track",
		artist: track.artist?.["#text"] ?? "Unknown artist",
		url: track.url ?? "https://www.last.fm/user/strailynx",
		nowPlaying: true,
	};
}

function json(body: unknown, status = 200, request?: Request, env?: Env, cacheSeconds = 0): Response {
	return withCors(new Response(JSON.stringify(body), {
		status,
		headers: publicJsonHeaders(cacheSeconds),
	}), request, env);
}

function publicJsonHeaders(maxAgeSeconds: number): Headers {
	return new Headers({
		"content-type": "application/json; charset=utf-8",
		"cache-control": maxAgeSeconds > 0 ? `public, max-age=${maxAgeSeconds}` : "no-store",
	});
}

function withCors(response: Response, request?: Request, env?: Env): Response {
	const origin = request?.headers.get("origin");
	if (!origin) {
		return response;
	}

	const allowedOrigin = env?.PUBLIC_SITE_ORIGIN?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN;
	if (origin !== allowedOrigin && !isLocalOrigin(origin)) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set("access-control-allow-origin", origin);
	headers.set("access-control-allow-methods", "GET,HEAD,OPTIONS");
	headers.set("access-control-allow-headers", "content-type");
	headers.set("access-control-max-age", "86400");
	headers.append("vary", "Origin");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function isLocalOrigin(origin: string): boolean {
	try {
		const url = new URL(origin);
		return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
	} catch {
		return false;
	}
}
