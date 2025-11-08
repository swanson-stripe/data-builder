import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Monaco', '"Cascadia Mono"', '"Segoe UI Mono"', '"Roboto Mono"', '"Courier New"', 'monospace'],
      },
      fontWeight: {
        normal: '400',
        medium: '600',
        semibold: '600',
      },
      colors: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        link: 'var(--text-link)',
        inverse: 'var(--text-inverse)',
      },
      backgroundColor: {
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        elevated: 'var(--bg-elevated)',
        surface: 'var(--bg-surface)',
        hover: 'var(--bg-hover)',
        active: 'var(--bg-active)',
        selected: 'var(--bg-selected)',
      },
      borderColor: {
        default: 'var(--border-default)',
        subtle: 'var(--border-subtle)',
        medium: 'var(--border-medium)',
        focus: 'var(--border-focus)',
      },
    },
  },
};

export default config;
