/**
 * POST /api/admin/bootstrap — flat handler avoids catch-all routing on Vercel.
 */
export { default } from '../src/server/api/handlers/admin/bootstrap.js';
