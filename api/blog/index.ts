/**
 * Explicit /api/blog handler — Vercel routes this reliably (optional catch-all can miss on some deploys).
 */
export { default } from '../../src/server/api/handlers/blog/index.js';
