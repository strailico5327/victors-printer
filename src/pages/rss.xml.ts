import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import { getSortedPosts } from "@utils/content-utils";
import { formatDateTimeForDisplay } from "@utils/date-utils";
import { url } from "@utils/url-utils";
import type { APIContext } from "astro";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { siteConfig } from "@/config";

const parser = new MarkdownIt();

function stripInvalidXmlChars(str: string): string {
	return str.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: https://www.w3.org/TR/xml/#charsets
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
		"",
	);
}

export async function GET(context: APIContext) {
	const blog = await getSortedPosts();
	const timeline = (await getCollection("timeline")).filter((event) => {
		return import.meta.env.PROD ? event.data.draft !== true : true;
	});
	const items = [
		...blog.map((post) => {
			const content =
				typeof post.body === "string" ? post.body : String(post.body || "");
			const cleanedContent = stripInvalidXmlChars(content);
			return {
				title: post.data.title,
				pubDate: post.data.published,
				description: post.data.description || "",
				link: url(`/posts/${post.slug}/`),
				content: sanitizeHtml(parser.render(cleanedContent), {
					allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
				}),
			};
		}),
		...timeline.map((event) => {
			const content =
				typeof event.body === "string" ? event.body : String(event.body || "");
			const cleanedContent = stripInvalidXmlChars(content);
			return {
				title: `Timeline: ${formatDateTimeForDisplay(event.data.published, event.id)}`,
				pubDate: event.data.published,
				description: event.data.location || "",
				link: url("/timeline/"),
				content: sanitizeHtml(parser.render(cleanedContent), {
					allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
				}),
			};
		}),
	].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

	return rss({
		title: siteConfig.title,
		description: siteConfig.subtitle || "No description",
		site: context.site ?? "https://fuwari.vercel.app",
		items,
		customData: `<language>${siteConfig.lang}</language>`,
	});
}
