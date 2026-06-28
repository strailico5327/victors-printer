import { defineCollection, z } from "astro:content";
import type { BaseSchema, CollectionConfig } from "astro/content/config";

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

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});
const specCollection = defineCollection({
	schema: z.object({}),
});
const timelineCollection = defineCollection({
	schema: z.object({
		type: z.literal("event"),
		id: z.string().regex(/^\d{10}-[a-z0-9]{8}$/),
		published: z.date(),
		draft: z.boolean().optional().default(false),
		location: z.string().optional().default(""),
	}),
});
export const collections: Record<string, CollectionConfig<BaseSchema>> = {
	posts: postsCollection,
	spec: specCollection,
	timeline: timelineCollection,
};
