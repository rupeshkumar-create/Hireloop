/**
 * Explicit /api/admin/content-growth handler — avoids SPA rewrite swallowing admin API on production.
 */
export { default } from '../../src/server/api/handlers/admin/contentGrowth.js';
