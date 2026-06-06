/** Direct /api/openai handler — reliable on Vercel (catch-all route param is unreliable). */
export { default } from '../src/server/api/handlers/openai.js';
