import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Proxy API calls during development to the remote backend to avoid CORS
        proxy: {
          // Only proxy real API calls (paths starting with "/api/") and avoid intercepting module files like "/api.ts"
          '/api/': {
            target: 'https://attendance-backend-u99p.onrender.com',
            changeOrigin: true,
            secure: false,
          }
        }
      },
      build: {
        sourcemap: true,
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
