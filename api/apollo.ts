/**
 * Explicit /api/apollo handler — avoids catch-all routing gaps on Vercel and local dev.
 */
export { default } from '../src/server/api/handlers/apollo.js';
