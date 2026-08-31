import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredPort = Number(env.STAFF_WEB_PORT ?? '5174');
  const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 5174;

  return {
    plugins: [react()],
    preview: {
      host: '0.0.0.0',
      port: Number(env.STAFF_WEB_PREVIEW_PORT ?? '4174'),
    },
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      proxy: {
        '/api': {
          changeOrigin: true,
          target: env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
        },
      },
    },
  };
});
