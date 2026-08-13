import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: parseInt(String(process.env.PORT || 8080), 10),
        host: '0.0.0.0',
      },
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/tests/vitest.setup.ts'],
        include: ['src/tests/**/*.test.{ts,tsx}'],
        testTimeout: 15000,
      },
      plugins: [tailwindcss()],
      // Never ship Gemini keys in client production bundles — use /api/ai (server-only).
      // Local/dev may still inject for frozen client-side AI pages during sandbox work.
      define: {
        'process.env.API_KEY': JSON.stringify(
          mode === 'production' ? '' : env.GEMINI_API_KEY || env.API_KEY || ''
        ),
        'process.env.GEMINI_API_KEY': JSON.stringify(
          mode === 'production' ? '' : env.GEMINI_API_KEY || env.API_KEY || ''
        ),
        'process.env.APP_ENV': JSON.stringify(env.APP_ENV || mode),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              // React family first — never let another vendor chunk absorb React
              // (e.g. paths under framer-motion that also contain "/react/").
              if (
                id.includes('react-dom') ||
                id.includes('react-router') ||
                id.includes('react-is') ||
                id.includes(`${path.sep}scheduler${path.sep}`) ||
                id.includes('/scheduler/') ||
                /[/\\]react[/\\]/.test(id)
              ) {
                return 'react-vendor';
              }
              if (id.includes('firebase')) return 'firebase-vendor';
              // framer-motion / recharts / d3 stay with the lazy routes that import them.
            },
          },
          onwarn(warning, warn) {
            if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
              return;
            }
            warn(warning);
          },
        },
      }
    };
});
