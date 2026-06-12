/**
 * GET /api/blog — list posts (and ?slug= for a single post).
 * Explicit handler: Vercel optional catch-all does not reliably serve /api/blog.
 */
export { default } from '../../src/server/api/handlers/blog/index.js';
