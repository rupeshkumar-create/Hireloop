/**
 * POST /api/admin/ghost-discover — flat handler avoids catch-all routing on Vercel.
 */
export { default } from '../src/server/api/handlers/admin/ghostDiscover.js';
