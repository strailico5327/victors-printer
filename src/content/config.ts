import { defineCollection, z } from "astro:content";
import type { BaseSchema, CollectionConfig } from "astro/content/config";

const unknownTimelineDateTime = /^(\d{4})-(\d{2})-(\d{2})Txx:xx(?::(?:\d{2}|xx))?(?:Z|[+-]\d{2}:\d{2})?$/;

function coercePublishedDate(value: unknown): unknown {
	if (value instanceof Date) {
		return value;
	}
	if (typeof value !== "string") {
		return value;
	}
	const unknownTime = value.trim().match(unknownTimelineDateTime);
	if (unknownTime) {
		const [, year, month, day] = unknownTime;
		return new Date(Number(year), Number(month) - 1, Number(day));
	}
	return value;
}

const publishedDate = z.preprocess(coercePublishedDate, z.date());

const postsCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		proseStyle: z.enum(["literary"]).optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),
		indev: z.boolean().optional().default(false),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}).refine((data) => !(data.draft && data.indev), {
		message: "Post frontmatter cannot set both draft and indev to true.",
		path: ["indev"],
	}),
});
const specCollection = defineCollection({
	schema: z.object({
		title: z.string().optional(),
		published: z.date().optional(),
	}).strict(),
});
const nothingCollection = defineCollection({
	schema: z.object({
		type: z.literal("thought"),
		id: z.string().regex(/^(?:\d{6}|\d{8})(?:\d{4}|x{4})-[a-z0-9]{8}$/),
		published: publishedDate,
		draft: z.boolean().optional().default(false),
	}),
});
const timelineCollection = defineCollection({
	schema: z.object({
		type: z.literal("event"),
		id: z.string().regex(/^\d{6}(?:\d{4}|x{4})-[a-z0-9]{8}$/),
		published: publishedDate,
		draft: z.boolean().optional().default(false),
		location: z.string().optional().default(""),
		tag: z.string(),
	}),
});
export const collections: Record<string, CollectionConfig<BaseSchema>> = {
	posts: postsCollection,
	spec: specCollection,
	nothing: nothingCollection,
	timeline: timelineCollection,
};
