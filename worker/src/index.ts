// Cloudflare Worker entry point. The logic lives in relay.ts so it can be tested and run locally with Node.
import { handleRelay, type RelayEnv } from './relay.ts';

export default {
  fetch: (request: Request, env: RelayEnv) => handleRelay(request, env),
};
