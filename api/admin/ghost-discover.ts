/**
 * Explicit /api/admin/ghost-discover handler — avoids catch-all routing gaps on production.
 */
export { default } from '../../src/server/api/handlers/admin/ghostDiscover.js';
