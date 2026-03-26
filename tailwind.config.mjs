/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				background: 'rgb(var(--bg-base) / <alpha-value>)',
				surface: 'rgb(var(--bg-surface) / <alpha-value>)',
				surfaceHover: 'rgb(var(--bg-surface-hover) / <alpha-value>)',
				primary: 'rgb(var(--primary) / <alpha-value>)',
				primaryHover: 'rgb(var(--primary-hover) / <alpha-value>)',
				textMain: 'rgb(var(--text-main) / <alpha-value>)',
				textMuted: 'rgb(var(--text-muted) / <alpha-value>)',
				borderSubtle: 'rgb(var(--border-subtle) / <alpha-value>)',
			},
			fontFamily: {
				sans: ['"DM Sans"', 'sans-serif'],
				heading: ['"Outfit"', 'sans-serif'],
			},
			boxShadow: {
				'glass': '0 4px 30px rgba(0, 0, 0, 0.05)',
				'glass-dark': '0 4px 30px rgba(0, 0, 0, 0.2)',
				'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
			},
			animation: {
				'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				'fade-in': 'fadeIn 0.5s ease-out forwards',
			},
			keyframes: {
				fadeInUp: {
					'0%': { opacity: '0', transform: 'translateY(12px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				}
			}
		},
	},
	plugins: [],
}
