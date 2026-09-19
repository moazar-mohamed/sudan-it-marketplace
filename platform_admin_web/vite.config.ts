import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // rules-tests need the Firestore emulator; run them with `npm run test:rules`.
  test: { environment: 'node', exclude: ['**/node_modules/**', 'rules-tests/**'] },
});
