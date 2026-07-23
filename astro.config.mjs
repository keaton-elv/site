// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import { essayMarkdown } from './src/lib/essay-markdown.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://keatonelvins.com',
  // in the repo so assets/ (the encoded-variant cache) can be committed —
  // cloudflare's box would spend ~30min encoding cold and time out
  cacheDir: './.astro-cache',
  integrations: [sitemap()],
  prefetch: {
    prefetchAll: true,
  },
  image: {
    layout: 'constrained',
    responsiveStyles: true,
    // widened past astro's default ladder — see AGENTS.md → images & video
    breakpoints: [
      640, 750, 828, 960, 1080, 1280, 1440, 1668, 1920, 2048, 2560, 3200, 3840,
    ],
  },
  markdown: {
    processor: satteri({
      features: { directive: true },
      mdastPlugins: [essayMarkdown],
    }),
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'ETBook',
      cssVariable: '--font-serif',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: [
          { src: ['./src/fonts/ETBook-Roman.woff2'], weight: 400, style: 'normal' },
          { src: ['./src/fonts/ETBook-Italic.woff2'], weight: 400, style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'PP Neue Montreal Mono',
      cssVariable: '--font-mono',
      fallbacks: ['ui-monospace', 'monospace'],
      options: {
        variants: [
          { src: ['./src/fonts/PPNeueMontrealMono-Book.woff2'], weight: 400, style: 'normal' },
          { src: ['./src/fonts/PPNeueMontrealMono-RegularItalic.woff2'], weight: 400, style: 'italic' },
          { src: ['./src/fonts/PPNeueMontrealMono-Medium.woff2'], weight: 500, style: 'normal' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'PP Neue Montreal',
      cssVariable: '--font-sans',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          { src: ['./src/fonts/PPNeueMontrealText-Book.woff2'], weight: 400, style: 'normal' },
          { src: ['./src/fonts/PPNeueMontreal-Semibold.woff2'], weight: 600, style: 'normal' },
          { src: ['./src/fonts/PPNeueMontreal-Hairline.woff2'], weight: 100, style: 'normal' },
        ],
      },
    },
  ],
});
