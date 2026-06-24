import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeApiRequest } from '../src/server/api/router.js';

/** Raw body required for webhook signature verification. Other routes parse JSON in the router. */
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return routeApiRequest(req, res);
}
