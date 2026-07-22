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
      // Inject keys from .env / .env.local for local/dev. Prefer server-side AI in production.
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
        'process.env.APP_ENV': JSON.stringify(env.APP_ENV || mode),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
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
