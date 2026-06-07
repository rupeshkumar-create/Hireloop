/**
 * Explicit /api/admin/bootstrap handler — avoids catch-all routing gaps on production.
 */
export { default } from '../../src/server/api/handlers/admin/bootstrap.js';
