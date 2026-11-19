import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // The libraries change rarely: a new site version keeps them in the browser's cache.
        advancedChunks: {
          groups: [
            // Performance Monitoring loads after the page, in its own file.
            { name: 'firebase-performance', test: /node_modules[\\/]@firebase[\\/]performance/, priority: 1 },
            { name: 'firebase', test: /node_modules[\\/]@?firebase/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  server: { port: 5197 },
});
