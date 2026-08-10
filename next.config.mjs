import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const config = {
  // Only use static export for production builds
  ...(process.env.NODE_ENV === 'production' && {
    output: 'export',
    assetPrefix: './',
  }),

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

  webpack: (config, { isServer, dev }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      encoding: fileURLToPath(new URL('encoding', import.meta.url)),
    };

    // Static export uses `assetPrefix: './'` so HTML can load assets from a
    // relative base. Webpack workers resolve that relative to the worker
    // script under `/_next/static/chunks/`, which doubles the path
    // (`…/chunks/_next/static/chunks/…`), returns the SPA HTML shell
    // (MIME text/html), and `importScripts` blows up. Absolute worker
    // public path keeps BMT / stamp-signer workers loading correctly when
    // the app is served from the site root (v2.beeport.xyz).
    if (!isServer && !dev) {
      config.output.workerPublicPath = '/_next/';
    }

    // Development-specific optimizations
    if (dev) {
      // Improve file watching for better cache invalidation
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding
        ignored: /node_modules/, // Don't watch node_modules
      };

      // Ensure proper cache invalidation
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
      };
    }

    return config;
  },
};

export default config;
