// src/util/StreamDeckWebhook.js
const http = require('http');
const crypto = require('crypto');
const SmartSwitchGroupHandler = require('../handlers/smartSwitchGroupHandler');

let getClient;
try { getClient = require('../utils/getClient'); }
catch { getClient = require('../util/getClient'); }

function norm(s=''){ return String(s).toLowerCase().trim(); }
function asId(x){ return String(x ?? ''); }

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function text(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'text/plain' });
  res.end(String(body));
}


/* ------------------------------------------------------------------ */
/* Press via your real button handler (preferred)                      */
/* ------------------------------------------------------------------ */
async function pressGroupButtonViaHandler(client, guildId, serverId, groupId, turnOn) {
  const buttonHandler = require('../handlers/buttonHandler');

  const customId = `GroupTurn${turnOn ? 'On' : 'Off'}${JSON.stringify({ serverId, groupId })}`;

  // Minimal fake interaction with admin perms so handler allows it.
  const fake = {
    guildId,
    channelId: null,
    customId,
    isButton: () => true,
    user: { id: 'streamdeck', username: 'StreamDeck' },
    member: { permissions: { has: () => true } },
    deferUpdate: async () => {},
    update: async () => {},
    reply: async () => {},
    editReply: async () => {},
    message: { delete: async () => {} },
  };

  await buttonHandler(client, fake); // will throw if something fails
}

function text(res, code, str) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(String(str));
}

// Group is considered ON if any of its switches are ON (same logic you use for toggle)
function groupIsOn(instance, serverId, group) {
  const allSwitches = instance.serverList?.[serverId]?.switches || {};
  let ids = [];
  if (Array.isArray(group.switches)) ids = group.switches;
  else if (group.switches && typeof group.switches === 'object') ids = Object.keys(group.switches);
  else if (Array.isArray(group.switchIds)) ids = group.switchIds;

  for (const id of ids) {
    const sw = allSwitches[id];
    if (sw && sw.active === true) return true;
  }
  return false;
}

// Toggle a group directly (no fake interaction path)
async function pressGroupButtonDirect(client, guildId, serverId, groupId, turnOn) {
  const instance = client.getInstance(guildId);
  if (!instance) return { ok: false, error: 'Guild not found' };

  const server = instance.serverList?.[serverId];
  if (!server) return { ok: false, error: 'Server not found' };

  const group = server.switchGroups?.[groupId];
  if (!group) return { ok: false, error: 'Group not found' };

  const rustplus = client.rustplusInstances?.[guildId] || client.activeRustplusInstances?.[guildId];
  if (!rustplus || rustplus.serverId !== serverId) {
    return { ok: false, error: 'NOT_CONNECTED' };
  }

  try {
    if (instance.generalSettings?.smartSwitchNotifyInGameWhenChangedFromDiscord) {
      const name = group.name || group.title || `Group-${groupId}`;
      const status = turnOn ? client.intlGet(guildId, 'onCap') : client.intlGet(guildId, 'offCap');
      const msg = client.intlGet(guildId, 'userTurnedOnOffSmartSwitchGroupFromDiscord', {
        user: 'StreamDeck', name, status
      });
      try { await rustplus.sendInGameMessage(msg); } catch {}
    }

    await SmartSwitchGroupHandler.TurnOnOffGroup(
      client, rustplus, guildId, serverId, groupId, turnOn
    );
    return { ok: true };
  } catch (e) {
    client.log?.('ERROR', `StreamDeck direct toggle failed: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ===== totals for MRC (Resources / Components / Boom) =====
let MRC = {};
try { MRC = require('../discordTools/MainResourcesCompsBox'); } catch {}

const RESOURCE_KEYS = MRC.RESOURCE_KEYS || [
  'Wood','Stones','Metal Fragments','High Quality Metal','Leather','Diesel Fuel',
  'Sulfur','Cloth','Animal Fat','Charcoal','Explosives','Gun Powder','Scrap'
];
const COMPONENT_KEYS = MRC.COMPONENT_KEYS || [
  'Tech Trash','CCTV Camera','Targeting Computer','Metal Pipe','Rifle Body','Gears',
  'Semi Automatic Body','Road Signs','SMG Body','Sewing Kit','Rope','Metal Blade',
  'Tarp','Electric Fuse','Sheet Metal','Metal Spring'
];
const BOOM_KEYS = MRC.BOOM_KEYS || [
  'Rocket','High Velocity Rocket','Incendiary Rocket','C4','Satchel Charge',
  'MLRS Rocket','MLRS Aiming Module','Explosive 5.56 Rifle Ammo'
];

function titleCase(s){ return String(s||'').replace(/\w\S*/g,t=>t[0].toUpperCase()+t.slice(1)); }
function norm(s=''){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
const SYN = new Map([
  ['gunpowder','Gun Powder'],['semi automatic body','Semi Automatic Body'],
  ['semi-automatic body','Semi Automatic Body'],['smg body','SMG Body'],
  ['cctv','CCTV Camera'],['explosive 556 rifle ammo','Explosive 5.56 Rifle Ammo'],
  ['explosive 5 56 rifle ammo','Explosive 5.56 Rifle Ammo'],
  ['incen rocket','Incendiary Rocket'],['hv rocket','High Velocity Rocket'],
]);
function canonicalName(name){ const n=norm(name); return SYN.get(n) || titleCase(n); }

function bucketOf(item){
  const x = (list)=>list.find(k => norm(k)===norm(item));
  if (x(RESOURCE_KEYS))  return 'resources';
  if (x(COMPONENT_KEYS)) return 'components';
  if (x(BOOM_KEYS))      return 'boom';
  return null;
}



function buildStreamDeckCountUrl(client, guildId, bucket, item, format='txt') {
  const instance = getClient().getInstance(guildId);
  const sd = ensureStreamDeckConfig(instance);
  getClient().setInstance(guildId, instance);

  const base = (sd.base || '').replace(/\/+$/,'');
  const token = encodeURIComponent(sd.token);
  return `${base}/streamdeck/mrc?token=${token}&guild=${encodeURIComponent(guildId)}&bucket=${encodeURIComponent(bucket)}&item=${encodeURIComponent(item)}&format=${encodeURIComponent(format)}`;
}
/* ------------------------------------------------------------------ */
/* Config + URL builder                                                */
/* ------------------------------------------------------------------ */
function ensureStreamDeckConfig(instance) {
  instance.generalSettings = instance.generalSettings || {};
  const gs = instance.generalSettings;
  gs.streamdeck = gs.streamdeck || {};

  if (!gs.streamdeck.token) gs.streamdeck.token = crypto.randomBytes(12).toString('base64url');
  if (!gs.streamdeck.port)  gs.streamdeck.port  = Number(process.env.STREAMDECK_PORT || 8787);
  if (!gs.streamdeck.base)  gs.streamdeck.base  = process.env.STREAMDECK_PUBLIC_BASE || `http://localhost:${gs.streamdeck.port}`;
  return gs.streamdeck;
}

function buildStreamDeckStatusUrl(client, guildId, groupName, format = 'txt') {
  const instance = getClient().getInstance(guildId);
  const sd = ensureStreamDeckConfig(instance);
  getClient().setInstance(guildId, instance);

  const base  = (sd.base || '').replace(/\/+$/, '');
  const token = encodeURIComponent(sd.token);
  const gid   = encodeURIComponent(guildId);
  const grp   = encodeURIComponent(groupName || '');
  const fmt   = encodeURIComponent(format || 'txt');

  return `${base}/streamdeck/state?token=${token}&guild=${gid}&group=${grp}&format=${fmt}`;
}


function buildStreamDeckStatusUrl(client, guildId, groupName, format = 'txt') {
  const instance = client.getInstance(guildId);
  const sd = ensureStreamDeckConfig(instance);
  getClient().setInstance(guildId, instance);

  const base = (sd.base || '').replace(/\/+$/, '');
  const token = encodeURIComponent(sd.token);
  const gid = encodeURIComponent(guildId);
  const grp = encodeURIComponent(groupName || '');
  const fmt = encodeURIComponent(format);

  return `${base}/streamdeck/state?token=${token}&guild=${gid}&group=${grp}&format=${fmt}`;
}

// Build the action URL used by your Stream Deck toggle buttons
function buildStreamDeckUrl(client, guildId, groupName, action = 'toggle') {
  const instance = getClient().getInstance(guildId);
  const sd = ensureStreamDeckConfig(instance);
  getClient().setInstance(guildId, instance);

  const base  = (sd.base || '').replace(/\/+$/, ''); // trim trailing slash
  const token = encodeURIComponent(sd.token);
  const gid   = encodeURIComponent(guildId);
  const grp   = encodeURIComponent(groupName || '');
  const act   = encodeURIComponent(action || 'toggle');

  return `${base}/streamdeck?token=${token}&guild=${gid}&group=${grp}&action=${act}`;
}

// Build the status URL (returns ON/OFF as text by default)
function buildStreamDeckStatusUrl(client, guildId, groupName, format = 'txt') {
  const instance = getClient().getInstance(guildId);
  const sd = ensureStreamDeckConfig(instance);
  getClient().setInstance(guildId, instance);

  const base  = (sd.base || '').replace(/\/+$/, '');
  const token = encodeURIComponent(sd.token);
  const gid   = encodeURIComponent(guildId);
  const grp   = encodeURIComponent(groupName || '');
  const fmt   = encodeURIComponent(format || 'txt');

  return `${base}/streamdeck/state?token=${token}&guild=${gid}&group=${grp}&format=${fmt}`;
}

/* ------------------------------------------------------------------ */
/* HTTP server                                                         */
/* ------------------------------------------------------------------ */
function startStreamDeckWebhook(client) {
  const instances = client.instances || client._instances || {};
  const defaultGuildId = Object.keys(instances)[0] || null;

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return json(res, 405, { ok:false, error:'Method not allowed' });
    }

    const urlObj = new URL(req.url, 'http://localhost');
    const q = Object.fromEntries(urlObj.searchParams.entries());
    let body = '';

    if (req.method === 'POST') {
      await new Promise(resolve => {
        req.on('data', chunk => (body += chunk));
        req.on('end', resolve);
      });
      if (body) {
        try { Object.assign(q, JSON.parse(body)); }
        catch {
          try { for (const [k,v] of new URLSearchParams(body).entries()) q[k] = v; }
          catch {}
        }
      }
    }

    const guildId = q.guild || defaultGuildId;
    if (!guildId) return json(res, 400, { ok:false, error:'No guild supplied' });

    const instance = client.getInstance(guildId);
    if (!instance) return json(res, 404, { ok:false, error:'Guild not found' });

    const sd = ensureStreamDeckConfig(instance);
    getClient().setInstance(guildId, instance);

    const token = q.token || req.headers['x-token'];
    if (!token || token !== sd.token) return json(res, 401, { ok:false, error:'Invalid token' });

    if (urlObj.pathname === '/streamdeck/ping') {
      return json(res, 200, { ok:true, pong:true, guild:guildId, port: sd.port });
    }
    // --- STATUS ENDPOINT -------------------------------------------------
if (urlObj.pathname === '/streamdeck/state') {
  // Must be connected to a server (same guard as toggle)
  const rp = client.rustplusInstances?.[guildId] || client.activeRustplusInstances?.[guildId];
  if (!rp) return json(res, 409, { ok:false, error:'NOT_CONNECTED', hint:'Connect to a server in Discord first.' });
  const serverId = rp.serverId;

  const instance = client.getInstance(guildId);
  const groups = instance.serverList?.[serverId]?.switchGroups || {};

  const wanted = norm(q.group || '');
  if (!wanted) return json(res, 400, { ok:false, error:'Missing "group" param' });

  // find group by name (case-insensitive)
  let match = null;
  for (const g of Object.values(groups)) {
    const nm = (g?.name || g?.title || '').toString();
    if (norm(nm) === wanted) { match = g; break; }
  }
  if (!match) return json(res, 404, { ok:false, error:`Group "${q.group}" not found on active server` });

  // Peek at switches to compute status
  const allSwitches = instance.serverList?.[serverId]?.switches || {};
  let ids = [];
  if (Array.isArray(match.switches)) ids = match.switches;
  else if (match.switches && typeof match.switches === 'object') ids = Object.keys(match.switches);
  else if (Array.isArray(match.switchIds)) ids = match.switchIds;

  let anyActive = false;
  for (const id of ids) {
    const sw = allSwitches[id];
    if (sw && typeof sw.active === 'boolean' && sw.active) { anyActive = true; break; }
  }
  const stateText = anyActive ? 'ON' : 'OFF';

  // Plain text (for Stream Deck), or JSON
  const fmt = (q.format || 'txt').toLowerCase();
  if (fmt === 'txt') return text(res, 200, stateText);
  return json(res, 200, { ok:true, state: stateText });
}
// ---------------------------------------------------------------------
// /streamdeck/mrc -> total count for a single item (plain text by default)
if (urlObj.pathname === '/streamdeck/mrc') {
  const rp = client.rustplusInstances?.[guildId] || client.activeRustplusInstances?.[guildId];
  if (!rp) return json(res, 409, { ok:false, error:'NOT_CONNECTED', hint:'Connect to a server in Discord first.' });
  const serverId = rp.serverId;
  const instance = client.getInstance(guildId);
  const smMap = instance.serverList?.[serverId]?.storageMonitors || {};

  const itemQ = q.item || '';

  // Back-compat: some old links mistakenly used item=txt and put the actual name in "bucket"
  if (String(itemQ).toLowerCase() === 'txt' && q.bucket) {
    q.item = q.bucket;
  }

  if (!itemQ) return json(res, 400, { ok:false, error:'Missing "item" param' });

  // which buckets exist by name?
  const ids = { resources:[], components:[], boom:[] };
  for (const [id, mon] of Object.entries(smMap)) {
    const nm = norm(mon?.name || '');
    if (nm==='resources')  ids.resources.push(id);
    else if (nm==='components') ids.components.push(id);
    else if (nm==='boom')  ids.boom.push(id);
  }

  // live-only (connected) items
  const addFrom = (list, target) => {
    for (const id of list) {
      const live = rp.storageMonitors?.[id];
      if (!live || !Array.isArray(live.items) || Number(live.capacity)<=0) continue;
      for (const it of live.items) {
        let name = '';
        if (it.itemId !== undefined && it.itemId !== null) {
          try { name = client.items.getName(it.itemId) || ''; } catch {}
        }
        if (!name) name = it.name || it.displayName || it.title || it.shortname || '';
        const can = canonicalName(name);
        const qty = Number(it.quantity ?? it.amount ?? it.count ?? 0);
        target[can] = (target[can] || 0) + qty;
      }
    }
  };

  const totals = { resources:{}, components:{}, boom:{} };
  addFrom(ids.resources, totals.resources);
  addFrom(ids.components, totals.components);
  addFrom(ids.boom,      totals.boom);

  const wanted = canonicalName(itemQ);
  let bucket = bucketOf(wanted);
  // if unknown bucket, search all
  const value =
    (bucket ? totals[bucket][wanted] : (totals.resources[wanted]||totals.components[wanted]||totals.boom[wanted])) || 0;

  const fmt = (q.format||'txt').toLowerCase();
  if (fmt === 'json') return json(res, 200, { ok:true, item:wanted, bucket: bucket || 'any', value });
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(String(value));
  return;
}

    if (urlObj.pathname !== '/streamdeck') {
      return json(res, 404, { ok:false, error:'Not found' });
    }

    if (urlObj.pathname === '/streamdeck/state') {
  // validate token etc. already done above
  const rp = client.rustplusInstances?.[guildId] || client.activeRustplusInstances?.[guildId];
  if (!rp) return json(res, 409, { ok:false, error:'NOT_CONNECTED', hint:'Connect to a server in Discord first.' });

  const serverId = rp.serverId;
  const groups = instance.serverList?.[serverId]?.switchGroups || {};
  const wanted = norm(q.group || '');
  if (!wanted) return json(res, 400, { ok:false, error:'Missing "group" param' });

  let match = null, matchId = null;
  for (const [gid, g] of Object.entries(groups)) {
    const nm = (g?.name || g?.title || '').toString();
    if (norm(nm) === wanted) { matchId = gid; match = g; break; }
  }
  if (!match) return json(res, 404, { ok:false, error:`Group "${q.group}" not found on active server` });

  const isOn = groupIsOn(instance, serverId, match);
  const payload = { ok:true, guildId, serverId, groupId: matchId, groupName: match.name || match.title || 'unknown', state: isOn ? 'on' : 'off' };

  if (/(txt|text)/i.test(q.format || '')) {
    return text(res, 200, isOn ? 'ON' : 'OFF');   // perfect for button title
  }
  return json(res, 200, payload);
}


    // Require an active Rust+ instance; use its serverId
    const rp = client.rustplusInstances?.[guildId] || client.activeRustplusInstances?.[guildId];
    if (!rp) return json(res, 409, { ok:false, error:'NOT_CONNECTED', hint:'Connect to a server in Discord first.' });
    const serverId = rp.serverId;

    // Resolve group by name on the active server
    const groups = instance.serverList?.[serverId]?.switchGroups || {};
    const wanted = norm(q.group || '');
    if (!wanted) return json(res, 400, { ok:false, error:'Missing "group" param' });

    let matchId = null, match = null;
    for (const [gid, g] of Object.entries(groups)) {
      const nm = (g?.name || g?.title || '').toString();
      if (norm(nm) === wanted) { matchId = gid; match = g; break; }
    }
    if (!matchId) return json(res, 404, { ok:false, error:`Group "${q.group}" not found on active server` });

    // Decide action (default toggle)
    const action = norm(q.action || 'toggle');
    let turnOn;
    if (action === 'on') turnOn = true;
    else if (action === 'off') turnOn = false;
    else {
      // Peek at one switch to decide
      const allSwitches = instance.serverList?.[serverId]?.switches || {};
      let ids = [];
      if (Array.isArray(match.switches)) ids = match.switches;
      else if (match.switches && typeof match.switches === 'object') ids = Object.keys(match.switches);
      else if (Array.isArray(match.switchIds)) ids = match.switchIds;

      let anyActive = false;
      for (const id of ids) {
        const sw = allSwitches[id];
        if (sw && typeof sw.active === 'boolean' && sw.active) { anyActive = true; break; }
      }
      turnOn = !anyActive;
    }

    // Try the handler path first; if it throws, fall back to direct
const result = await pressGroupButtonDirect(client, guildId, serverId, matchId, turnOn);
if (!result.ok) {
  return json(res, 500, { ok:false, error: result.error || 'Failed to toggle group' });
}


    return json(res, 200, {
      ok: true,
      guildId,
      serverId,
      groupId: matchId,
      groupName: match?.name || match?.title || 'unknown',
      action: turnOn ? 'on' : 'off'
    });
  });

  const gid = defaultGuildId || null;
  if (!gid) {
    console.log('[StreamDeck] No guild instances yet; webhook not started.');
    return;
  }
  const inst = getClient().getInstance(gid);
  const sd = ensureStreamDeckConfig(inst);
  getClient().setInstance(gid, inst);

  server.listen(sd.port, () => {
    console.log(`[StreamDeck] Webhook listening on :${sd.port}`);
    console.log(`[StreamDeck] Token: ${sd.token}`);
    console.log(`[StreamDeck] Test: GET /streamdeck/ping?token=${sd.token}`);
  });
}

module.exports = {
  startStreamDeckWebhook,
  ensureStreamDeckConfig,
  buildStreamDeckUrl,
  buildStreamDeckStatusUrl,
  buildStreamDeckCountUrl
};
