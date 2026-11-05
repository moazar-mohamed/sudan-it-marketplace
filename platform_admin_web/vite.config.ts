import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // rules-tests need the Firestore emulator; run them with `npm run test:rules`.
  // A page test that renders a whole list can take over 5 s when many files run at once.
  test: { environment: 'node', testTimeout: 20000, exclude: ['**/node_modules/**', 'rules-tests/**'] },
});
