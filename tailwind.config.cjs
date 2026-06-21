/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue,mjs}"],
	darkMode: "class",
	theme: {
		extend: {
			fontFamily: {
				sans: [
					"HarmonyOS Sans",
					"HarmonyOS Sans SC",
					"HarmonyOS Sans TC",
					"sans-serif",
					...defaultTheme.fontFamily.sans,
				],
				serif: [
					"Linden Hill",
					"Noto Serif SC",
					"Noto Serif TC",
					"Noto Serif JP",
					"Noto Serif KR",
					"serif",
					...defaultTheme.fontFamily.serif,
				],
			},
		},
	},
	plugins: [require("@tailwindcss/typography")],
};
