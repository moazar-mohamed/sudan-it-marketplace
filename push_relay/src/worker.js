// Cloudflare Workers entry point. Secrets/vars come from wrangler.toml and
// `wrangler secret put SERVICE_ACCOUNT_JSON`.
import { createRelay } from './relay.js';

let relay;

export default {
  async fetch(request, env) {
    relay ??= createRelay(env, { log: (line) => console.log(line) });
    return relay(request);
  },

  // Every hour (wrangler.toml [triggers]): the 24-hour dollar rate reminders.
  async scheduled(event, env, ctx) {
    relay ??= createRelay(env, { log: (line) => console.log(line) });
    ctx.waitUntil(relay.remindUsdRates());
  },
};
