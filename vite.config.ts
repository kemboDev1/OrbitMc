import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    plugins: [react()],
    base: isDev ? '/' : './', // Relative paths for Electron file:// protocol
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      outDir: 'dist',
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'react-vendor', test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]/ },
              { name: 'supabase-vendor', test: /[\\/]node_modules[\\/]@supabase[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
