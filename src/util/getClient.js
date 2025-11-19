// src/util/getClient.js
// Robust resolver for the bot singleton across export styles & circular loads.
let cached = null;
let warned = false;

function pickClient(mod) {
  if (!mod) return null;

  // Try likely candidates
  const candidates = [
    mod.client,
    mod.default,
    mod,
    // scan other exported properties just in case
    ...Object.values(mod)
  ];

  for (const c of candidates) {
    if (c && typeof c.getInstance === 'function' && typeof c.intlGet === 'function') {
      return c;
    }
  }
  return null;
}

module.exports = function getClient() {
  if (cached) return cached;

  // Try the primary export
  try {
    const botMod = require('../structures/DiscordBot.js'); // path from /src/util/
    const picked = pickClient(botMod);
    if (picked) {
      cached = picked;
      return cached;
    }
  } catch (_) {/* ignore */ }

  // Fallbacks: some builds expose the running bot via index.(ts|js)
  for (const p of ['../../index.ts', '../../index.js']) {
    try {
      const idx = require(p);
      const picked = pickClient(idx);
      if (picked) {
        cached = picked;
        return cached;
      }
    } catch (_) {/* ignore */}
  }

  // Last chance: if DiscordBot is still initializing, avoid noisy spam
  if (!warned) {
    try {
      const mod = require('../structures/DiscordBot.js');
      if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
        console.error('getClient(): DiscordBot.js export keys =', Object.keys(mod || {}));
      }
    } catch (_) {}
    warned = true;
  }

  throw new Error('DiscordBot client not resolved yet');
};
