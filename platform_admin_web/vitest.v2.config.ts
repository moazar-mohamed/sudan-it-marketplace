import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vite.config';

/*
 * The whole unit suite with the redesign forced on: every page test then proves that the
 * operations of the current pages are still there in the new look. Run: npm run test:v2
 */
export default mergeConfig(base, defineConfig({ define: { 'import.meta.env.VITE_FORCE_UI': JSON.stringify('v2') } }));
