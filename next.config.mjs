import { fileURLToPath } from 'url';

/** @type {import('next').NextConfig} */
const config = {
  output: 'export', // Ensures a static export is generated
  assetPrefix: './',

  // Optional: Change links `/me` -> `/me/` and emit `/me.html` -> `/me/index.html`
  // trailingSlash: true,

  // Optional: Prevent automatic `/me` -> `/me/`, instead preserve `href`
  // skipTrailingSlashRedirect: true,

  // Optional: Change the output directory `out` -> `dist`
  // distDir: 'dist',

  images: {
    unoptimized: true,
  },

  // TODO remove and fix once for production
  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  webpack: config => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      encoding: fileURLToPath(new URL('encoding', import.meta.url)),
    };
    return config;
  },
};

export default config;
