/**
 * Explicit /api/admin/users handler — Vercel optional catch-all can miss sub-routes on some deploys.
 */
export { default } from '../../src/server/api/handlers/admin/users.js';
