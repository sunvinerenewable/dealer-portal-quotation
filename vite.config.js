import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { ensureEnvLoaded } from './api/_lib/db.js';

ensureEnvLoaded();

function apiDevPlugin() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        const [urlPath, queryString] = req.url.split('?');
        const query = {};
        if (queryString) {
          const params = new URLSearchParams(queryString);
          for (const [k, v] of params) query[k] = v;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            req.body = body ? JSON.parse(body) : {};
          } catch {
            req.body = {};
          }
          req.query = query;

          if (!res.status) {
            res.status = (code) => {
              res.statusCode = code;
              return res;
            };
          }
          if (!res.json) {
            res.json = (obj) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(obj));
              return res;
            };
          }
          if (!res.send) {
            res.send = (data) => {
              res.end(data);
              return res;
            };
          }

          try {
            let modulePath = null;
            if (urlPath.startsWith('/api/auth/')) {
              const action = urlPath.replace('/api/auth/', '').replace(/\.js$/, '');
              query.action = action;
              req.query = req.query || {};
              req.query.action = action;
              modulePath = '/api/auth/[action].js';
            } else if (urlPath.startsWith('/api/')) {
              const endpoint = urlPath.replace('/api/', '').replace(/\.js$/, '');
              modulePath = `/api/${endpoint}.js`;
            }

            if (modulePath) {
              const { default: handler } = await server.ssrLoadModule(modulePath);
              if (typeof handler === 'function') {
                return await handler(req, res);
              }
            }
          } catch (err) {
            console.error('[Vite dev API error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
            return;
          }

          next();
        });
      });
    }
  };
}

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'import.meta.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  plugins: [
    react(),
    apiDevPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        importScripts: ['/sw-push.js'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        globPatterns: ['**/*.{css,html,ico,png,webp,svg,woff,woff2}', '**/index*.js'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|mjs)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sunvine-dynamic-chunks',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      includeAssets: [
        'favicon.ico',
        'sw-push.js',
        'sunvine-logo.png',
        'sunvine-logo.webp',
        'sunvine-logo-darkmode.png',
        'sunvine-logo-darkmode.webp',
        'sunvine_logo_transparent.png',
        'sunvine_logo_transparent.webp',
        'sunvine_logo_white.png',
        'sunvine_logo_white.webp',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'fonts/material-symbols-outlined.woff2'
      ],
      manifest: {
        name: 'Sunvine Solar EPC Dealer Portal',
        short_name: 'Sunvine EPC',
        description: 'Sunvine Renewable Energy - Solar EPC Dealer & Admin Quotation Portal',
        theme_color: '#0F1B2E',
        background_color: '#0F1B2E',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        id: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-ocr': ['tesseract.js'],
          'vendor-pdf': ['html2pdf.js'],
          'vendor-lucide': ['lucide-react']
        }
      }
    }
  }
});
