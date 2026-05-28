import { defineConfig } from 'astro/config';

const site = process.env.FOLIA_SITE_URL ?? 'https://cat-xierluo.github.io';
const base = process.env.FOLIA_BASE_PATH ?? '/Folia';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
});
