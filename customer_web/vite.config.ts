import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Every build has its own id: an open tab compares it with version.json to know
// that a newer site is out.
const buildId = Date.now().toString(36);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'site-version',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: buildId }) });
      },
    },
  ],
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId) },
  build: {
    rolldownOptions: {
      output: {
        // The libraries change rarely: a new site version keeps them in the browser's cache.
        advancedChunks: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/]@?firebase/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  server: { port: 5190 },
});
