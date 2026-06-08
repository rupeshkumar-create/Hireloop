/**
 * GET/PATCH/DELETE /api/admin/users — flat handler avoids catch-all routing on Vercel.
 * Rewritten from /api/admin/users in vercel.json.
 */
export { default } from '../src/server/api/handlers/admin/users.js';
