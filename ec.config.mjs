import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { pluginCustomCopyButton } from "./src/plugins/expressive-code/custom-copy-button.ts";
import { pluginLanguageBadge } from "./src/plugins/expressive-code/language-badge.ts";

export default {
	themes: ["github-dark", "github-dark"],
	plugins: [
		pluginCollapsibleSections(),
		pluginLineNumbers(),
		pluginLanguageBadge(),
		pluginCustomCopyButton(),
	],
	defaultProps: {
		wrap: true,
		overridesByLang: {
			shellsession: {
				showLineNumbers: false,
			},
		},
	},
	styleOverrides: {
		codeBackground: "var(--codeblock-bg)",
		borderRadius: "0.75rem",
		borderColor: "none",
		codeFontSize: "0.875rem",
		codeFontFamily:
			"'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
		codeLineHeight: "1.5rem",
		frames: {
			editorBackground: "var(--codeblock-bg)",
			terminalBackground: "var(--codeblock-bg)",
			terminalTitlebarBackground: "var(--codeblock-topbar-bg)",
			editorTabBarBackground: "var(--codeblock-topbar-bg)",
			editorActiveTabBackground: "none",
			editorActiveTabIndicatorBottomColor: "var(--primary)",
			editorActiveTabIndicatorTopColor: "none",
			editorTabBarBorderBottomColor: "var(--codeblock-topbar-bg)",
			terminalTitlebarBorderBottomColor: "none",
		},
		textMarkers: {
			delHue: 0,
			insHue: 180,
			markHue: 250,
		},
	},
	frames: {
		showCopyToClipboardButton: false,
	},
};
