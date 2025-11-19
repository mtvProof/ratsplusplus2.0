// src/discordTools/MainResourcesCompsBox.js
const Discord = require('discord.js');

// Robust getClient import (utils vs util)
let getClient;
try { getClient = require('../utils/getClient'); }
catch { getClient = require('../util/getClient'); }

// Robust Constants import
let Constants;
try { Constants = require('../util/constants'); }
catch { Constants = require('../util/constants.js'); }

/* ------------------------------------------------------------------ */
/* Config: items tracked                                               */
/* ------------------------------------------------------------------ */
const RESOURCE_KEYS = [
  'Wood',
  'Stones',
  'Metal Fragments',
  'High Quality Metal',
  'Leather',
  'Diesel Fuel',
  'Sulfur',
  'Cloth',
  'Animal Fat',
  'Charcoal',
  'Explosives',
  'Gun Powder',
  'Scrap',
  'Low Grade Fuel'
];

const COMPONENT_KEYS = [
  'Tech Trash',
  'CCTV Camera',
  'Targeting Computer',
  'Metal Pipe',
  'Rifle Body',
  'Gears',
  'Semi Automatic Body',
  'Road Signs',
  'SMG Body',
  'Sewing Kit',
  'Rope',
  'Metal Blade',
  'Tarp',
  'Electric Fuse',
  'Sheet Metal',
  'Metal Spring'
];

// NEW: Boom keys
const BOOM_KEYS = [
  'Rocket',
  'C4',
  'Satchel Charge',
  'High Velocity Rocket',
  'Incendiary Rocket',
  'MLRS Aiming Module',
  'MLRS Rocket',
  'Explosive 5.56 Rifle Ammo',
  'Explosive 556 Rifle Ammo',
  'Explosive 5 56 Rifle Ammo'
];

// NEW: Teas & Pies keys (canonical names from corrosionhour list)
const TEA_KEYS = [
  // Anti-Rad
  'Basic Anti Rad Tea',
  'Advanced Anti Rad Tea',
  'Pure Anti Rad Tea',

  // Cooling
  'Basic Cooling Tea',
  'Advanced Cooling Tea',
  'Pure Cooling Tea',

  // Crafting Quality
  'Basic Crafting Quality Tea',
  'Advanced Crafting Quality Tea',
  'Pure Crafting Quality Tea',

  // Harvesting
  'Basic Harvesting Tea',
  'Advanced Harvesting Tea',
  'Pure Harvesting Tea',

  // Healing
  'Basic Healing Tea',
  'Advanced Healing Tea',
  'Pure Healing Tea',

  // Max Health
  'Basic Max Health Tea',
  'Advanced Max Health Tea',
  'Pure Max Health Tea',

  // Ore
  'Basic Ore Tea',
  'Advanced Ore Tea',
  'Pure Ore Tea',

// Rad Removal (has dot in display, but canonical name removes it)
  'Basic Rad Removal Tea',
  'Rad Removal Tea',
  'Advanced Rad Removal Tea',
  'Pure Rad Removal Tea',


  // Scrap
  'Basic Scrap Tea',
  'Advanced Scrap Tea',
  'Pure Scrap Tea',

  // Warming
  'Basic Warming Tea',
  'Advanced Warming Tea',
  'Pure Warming Tea',

  // Wood
  'Basic Wood Tea',
  'Advanced Wood Tea',
  'Pure Wood Tea',

  // Special tea
  'Super Serum',

  // Pies
  'Apple Pie',
  'Bear Pie',
  'Big Cat Pie',
  'Chicken Pie',
  'Crocodile Pie',
  'Fish Pie',
  'Hunters Pie',
  'Pork Pie',
  'Pumpkin Pie',
  'Survivor S Pie'
];


// --- Watchlist of box names to include in Main Resources & Comps totals ---
const WATCHED_BOX_NAMES = new Set(['resources', 'components', 'boom', 'bunker']);
function isWatchedBox(name) {
  return !!name && WATCHED_BOX_NAMES.has(String(name).trim().toLowerCase());
}


// Fast membership lookups for routing Bunker item names
const RESOURCE_SET  = new Set(RESOURCE_KEYS);
const COMPONENT_SET = new Set(COMPONENT_KEYS);
const BOOM_SET      = new Set(BOOM_KEYS);
const TEA_SET       = new Set(TEA_KEYS);



/* ------------------------------------------------------------------ */
/* Normalization / synonyms                                            */
/* ------------------------------------------------------------------ */
const SYN = new Map([
  ['gunpowder','Gun Powder'],
  ['semi-automatic body','Semi Automatic Body'],
  ['semi automatic body','Semi Automatic Body'],
  ['road sign','Road Signs'],
  ['road signs','Road Signs'],
  ['hq metal','High Quality Metal'],
  ['high quality metal','High Quality Metal'],
  ['high quality metal ore','High Quality Metal Ore'],
  ['scrap','Scrap'],
  ['smg body','SMG Body'],
  ['cctv camera','CCTV Camera'],
  ['cctv','CCTV Camera'],
  ['lgf','Low Grade Fuel'],
  ['lowgradefuel','Low Grade Fuel'],
  ['low grade fuel','Low Grade Fuel'],
  ['low-grade fuel','Low Grade Fuel'],

  // Boom synonyms
  ['c4','C4'],
  ['timed explosive charge','C4'],
  ['rocket','Rocket'],
  ['rocket ammo','Rocket'],
]);

// Short labels to keep each row on one line (edit to taste)
const DISPLAY_ALIAS = {
  'Metal Fragments': 'Frags',
  'High Quality Metal': 'HQM',
  'Diesel Fuel': 'Diesel',
  'Gun Powder': 'GP',
  'Semi Automatic Body': 'Semi Bodies',
  'Metal Blade': 'Blades',
  'Electric Fuse': 'Fuses',
  'Metal Spring': 'Springs',
  'CCTV Camera': 'Cameras',
  'Targeting Computer': 'Laptops',
  'Low Grade Fuel': 'Low Grade',

  // Boom
   'High Velocity Rocket': 'HV Rockets',
   'Timed Explosive Charge': 'C4',
   'Rocket': 'Rockets',
   'Incendiary Rocket': 'Incen Rockets',
   'MLRS Aiming Module': 'MLRS Modules',
   'Explosive 5 56 Rifle Ammo': 'Explo Ammo',
   'Explosive 556 Rifle Ammo': 'Explo Ammo',
};

const GREEN = '🟢';
const RED   = '🔴';
const NO_CONNECTED = '`No connected boxes`';

// number formatter
const COMPACT_NUMBERS = false;
const fmtNum = (n) => COMPACT_NUMBERS
  ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n)||0)
  : Number(n).toLocaleString();

function norm(s=''){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
function titleCase(s){ return s.replace(/\w\S*/g,t=>t[0].toUpperCase()+t.slice(1)); }
function canonicalName(name=''){ const n = norm(name); return SYN.get(n) || titleCase(n); }

/* ------------------------------------------------------------------ */
/* Settings: ensure defaults                                           */
/* ------------------------------------------------------------------ */
function ensureMrc(instance) {
  instance.generalSettings = instance.generalSettings || {};
  const gs = instance.generalSettings;
  if (!gs.mainResourcesComps) {
    gs.mainResourcesComps = { enabled: true, limits: {} };
  }
  const limits = gs.mainResourcesComps.limits;
  for (const k of [...RESOURCE_KEYS, ...COMPONENT_KEYS, ...BOOM_KEYS, ...TEA_KEYS]) {
    if (!(k in limits)) limits[k] = 0;
  }
  return gs.mainResourcesComps;
}


/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */
function formatLinesWithLimits(totalsObj, orderKeys, limitsMap){
  const lines = [];
  for (const k of orderKeys){
    const label = DISPLAY_ALIAS[k] || k;
    const total = Number(totalsObj[k] || 0);
    const lim = Number(limitsMap?.[k] ?? 0);
    if (total > 0 || lim > 0) {
      const ok = total >= lim;
      const dot = ok ? GREEN : RED;
      const limSuffix = lim > 0 ? `/${fmtNum(lim)}` : '';
      lines.push(`${dot} ${label}: ${fmtNum(total)}${limSuffix}`);
    }
  }
  return lines.length ? '```\n' + lines.join('\n') + '\n```' : '`—`';
}

function hasAnyTotals(obj){
  for (const k in obj) { if ((obj[k] || 0) > 0) return true; }
  return false;
}


/* ------------------------------------------------------------------ */
/* Channel resolver (prefer stored ID, then search by name)            */
/* ------------------------------------------------------------------ */
async function getInformationsChannel(client, guildId, preferredNames = ['information','informations','info']) {
  const instance = client.getInstance(guildId);
  let guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;

  // First priority: use the stored channel ID from instance.channelId.information
  const savedId = instance.channelId?.information || instance.channelId?.informations;
  if (savedId) {
    const saved = client.channels.cache.get(savedId) || await guild.channels.fetch(savedId).catch(() => null);
    if (saved && saved.type === Discord.ChannelType.GuildText) return saved;
  }

  // Fallback: search by channel name
  let ch = guild.channels.cache.find(
    c => c?.type === Discord.ChannelType.GuildText && preferredNames.includes(norm(c.name))
  );
  if (!ch) {
    let all = null;
    try { all = await guild.channels.fetch(); } catch {}
    if (all) ch = all.find(c => c?.type === Discord.ChannelType.GuildText && preferredNames.includes(norm(c.name)));
  }
  if (ch) {
    instance.channelId = instance.channelId || {};
    instance.channelId.information = ch.id; // store here for reuse
    client.setInstance(guildId, instance);
    return ch;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Minimal embed builder                                               */
/* ------------------------------------------------------------------ */
function buildEmbed(opts = {}){
  const e = new Discord.EmbedBuilder();
  if (opts.title) e.setTitle(opts.title);
  if (opts.color) e.setColor(opts.color);
  if (opts.description) e.setDescription(opts.description);
  if (opts.thumbnail) e.setThumbnail(opts.thumbnail);
  if (opts.image) e.setImage(opts.image);
  if (opts.url) e.setURL(opts.url);
  if (opts.author) e.setAuthor(opts.author);
  if (opts.footer) e.setFooter(opts.footer);
  if (opts.fields && Array.isArray(opts.fields)) e.addFields(opts.fields);
  if (opts.timestamp) e.setTimestamp(new Date());
  return e;
}

/* ------------------------------------------------------------------ */
/* Debounce / rate-limit wrapper                                       */
/* ------------------------------------------------------------------ */
const UPDATE_STATE = new Map(); // key: `${guildId}:${serverId}` -> { timer, running, last }
const MIN_INTERVAL_MS = 3000;   // don't PATCH more than every ~3s
const DEBOUNCE_MS     = 1500;   // coalesce bursts into one run

module.exports.updateMainResourcesComps = async function updateMainResourcesComps(guildId, serverId){
  const k = `${guildId}:${serverId}`;
  const state = UPDATE_STATE.get(k) || { timer: null, running: false, last: 0 };
  const now = Date.now();

  if (state.running || (now - state.last < MIN_INTERVAL_MS)) {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(async () => {
      const s = UPDATE_STATE.get(k) || { timer: null, running: false, last: 0 };
      s.timer = null;
      s.running = true;
      UPDATE_STATE.set(k, s);
      try { await doUpdate(guildId, serverId); } catch {}
      s.last = Date.now();
      s.running = false;
      UPDATE_STATE.set(k, s);
    }, DEBOUNCE_MS);
    UPDATE_STATE.set(k, state);
    return;
  }

  state.running = true;
  UPDATE_STATE.set(k, state);
  try { await doUpdate(guildId, serverId); } catch {}
  state.last = Date.now();
  state.running = false;
  UPDATE_STATE.set(k, state);
};

// Force an immediate update (bypass debounce). Useful when re-enabling.
module.exports.updateMainResourcesCompsNow = async function updateMainResourcesCompsNow(guildId, serverId) {
  const k = `${guildId}:${serverId}`;
  const state = UPDATE_STATE.get(k) || { timer: null, running: false, last: 0 };
  if (state.timer) { clearTimeout(state.timer); state.timer = null; }
  if (state.running) return;
  state.running = true;
  UPDATE_STATE.set(k, state);
  try { await doUpdate(guildId, serverId); } catch {}
  state.last = Date.now();
  state.running = false;
  UPDATE_STATE.set(k, state);
};

/* ------------------------------------------------------------------ */
/* Actual updater                                                      */
/* ------------------------------------------------------------------ */
async function doUpdate(guildId, serverId){
  const client = getClient();
  const instance = client.getInstance(guildId);
  const server = instance?.serverList?.[serverId];
  if (!server) return;

  const mrc = ensureMrc(instance);
  const key = 'mainResourcesCompsMessageId';

  // If disabled → delete existing box and bail
  if (!mrc.enabled) {
    const infoChannel = await getInformationsChannel(client, guildId);
    if (infoChannel && server[key]) {
      try {
        const msg = await infoChannel.messages.fetch(server[key]).catch(() => null);
        if (msg) await msg.delete().catch(()=>{});
      } catch {}
    }
    delete server[key];
    client.setInstance(guildId, instance);
    return;
  }

  // Live Rust+ map
  const rp = client.rustplusInstances?.[guildId];

  // Identify monitors by bucket
  const smMap = server.storageMonitors || server.storagemonitors || {};
  const resIds   = [];
  const compIds  = [];
  const boomIds  = [];
  const teasIds  = [];
  const bunkerIds= [];

  for (const [entityId, mon] of Object.entries(smMap)) {
    if (!mon?.name) continue;
    const bucket = norm(mon.name);
    if (bucket === 'resources')      resIds.push(entityId);
    else if (bucket === 'components') compIds.push(entityId);
    else if (bucket === 'boom')       boomIds.push(entityId);
    else if (bucket === 'teas')       teasIds.push(entityId);
    else if (bucket === 'bunker')     bunkerIds.push(entityId);
  }


  // A monitor is "connected" if live data exists and capacity > 0 and items array present
  const isConnected = (id) => {
    const live = rp?.storageMonitors?.[id];
    return !!(live && Number(live.capacity) > 0 && Array.isArray(live.items));
  };

  const resConnected  = resIds.filter(isConnected);
  const compConnected = compIds.filter(isConnected);
  const boomConnected = boomIds.filter(isConnected);
  const teasConnected = teasIds.filter(isConnected);
  const bunkerConnected = bunkerIds.filter(isConnected);

  // Main loot room boxes (Resources, Components, Boom, Teas combined)
  const mainLootConnected = Array.from(new Set([
    ...resConnected, ...compConnected, ...boomConnected, ...teasConnected
  ]));


  // Tally from live data only
  const totals = {
    resources: Object.fromEntries(RESOURCE_KEYS.map(k => [k, 0])),
    components: Object.fromEntries(COMPONENT_KEYS.map(k => [k, 0])),
    boom:       Object.fromEntries(BOOM_KEYS.map(k => [k, 0])),
    teas:       Object.fromEntries(TEA_KEYS.map(k => [k, 0])),
  };


  const addFrom = (ids, target) => {
    for (const id of ids) {
      const live = rp.storageMonitors[id];
      for (const it of live.items) {
        let display = '';
        if (it.itemId !== undefined && it.itemId !== null){
          try { display = client.items.getName(it.itemId) || ''; } catch { display = ''; }
        } else {
          display = it.name || it.displayName || it.title || it.shortname || '';
        }
        const can = canonicalName(display);
        const qty = Number(it.quantity ?? it.amount ?? it.qty ?? it.count ?? 0);
        if (can in target) target[can] += qty;
      }
    }
  };

  // Route items from main loot room boxes into the correct category totals by name
  const addFromToAll = (ids, totalsAll) => {
    for (const id of ids) {
      const live = rp.storageMonitors[id];
      for (const it of live.items) {
        let display = '';
        if (it.itemId !== undefined && it.itemId !== null){
          try { display = client.items.getName(it.itemId) || ''; } catch { display = ''; }
        } else {
          display = it.name || it.displayName || it.title || it.shortname || '';
        }
        const can = canonicalName(display);
        const qty = Number(it.quantity ?? it.amount ?? it.qty ?? it.count ?? 0);

        if (RESOURCE_SET.has(can))       totalsAll.resources[can]  += qty;
        else if (COMPONENT_SET.has(can)) totalsAll.components[can] += qty;
        else if (BOOM_SET.has(can))      totalsAll.boom[can]       += qty;
        else if (TEA_SET.has(can))       totalsAll.teas[can]       += qty;
        // else: ignore items that aren't tracked
      }
    }
  };

  // Collect totals from main loot room (Resources, Components, Teas boxes)
  if (mainLootConnected.length) addFromToAll(mainLootConnected, totals);

  // Format bunker contents - combine all bunker items into one total
  const formatBunkerContents = () => {
    if (bunkerConnected.length === 0) return NO_CONNECTED;
    
    const allItems = {};
    for (const bunkerId of bunkerConnected) {
      const live = rp.storageMonitors[bunkerId];
      for (const it of live.items) {
        let display = '';
        if (it.itemId !== undefined && it.itemId !== null){
          try { display = client.items.getName(it.itemId) || ''; } catch { display = ''; }
        } else {
          display = it.name || it.displayName || it.title || it.shortname || '';
        }
        const itemName = display || 'Unknown';
        const qty = Number(it.quantity ?? it.amount ?? it.qty ?? it.count ?? 0);
        allItems[itemName] = (allItems[itemName] || 0) + qty;
      }
    }
    
    if (Object.keys(allItems).length === 0) return '`Empty`';
    
    const itemsList = [];
    for (const [name, qty] of Object.entries(allItems).sort((a, b) => a[0].localeCompare(b[0]))) {
      const shortName = DISPLAY_ALIAS[name] || name;
      itemsList.push(`${shortName}: ${fmtNum(qty)}`);
    }
    
    return '```\n' + itemsList.join('\n') + '\n```';
  };

  // Build embed – prefer totals if present; otherwise show NO_CONNECTED
  const resHas  = hasAnyTotals(totals.resources);
  const compHas = hasAnyTotals(totals.components);
  const boomHas = hasAnyTotals(totals.boom);
  const teasHas = hasAnyTotals(totals.teas);

  const hasMainLoot = mainLootConnected.length > 0;

  const resourcesField = hasMainLoot && resHas
    ? formatLinesWithLimits(totals.resources, RESOURCE_KEYS, mrc.limits)
    : (hasMainLoot ? '`—`' : NO_CONNECTED);

  const componentsField = hasMainLoot && compHas
    ? formatLinesWithLimits(totals.components, COMPONENT_KEYS, mrc.limits)
    : (hasMainLoot ? '`—`' : NO_CONNECTED);

  const boomField = hasMainLoot && boomHas
    ? formatLinesWithLimits(totals.boom, BOOM_KEYS, mrc.limits)
    : (hasMainLoot ? '`—`' : NO_CONNECTED);

  const teasField = hasMainLoot && teasHas
    ? formatLinesWithLimits(totals.teas, TEA_KEYS, mrc.limits)
    : (hasMainLoot ? '`—`' : NO_CONNECTED);

  const bunkersField = formatBunkerContents();

  const embed = buildEmbed({
    title: 'Main Loot Room & Bunkers',
    color: Constants.COLOR_DEFAULT,
    fields: [
      { name: 'Resources (Main Loot)',  value: resourcesField,  inline: true },
      { name: 'Components (Main Loot)', value: componentsField, inline: true },
      { name: 'Boom (Main Loot)',       value: boomField,       inline: false },
      { name: 'Teas (Main Loot)',       value: teasField,       inline: false },
      { name: 'Bunkers',                value: bunkersField,    inline: false },
    ],
    timestamp: true
  });


  // Upsert box (reuse existing; de-dupe older ones we posted)
  const infoChannel = await getInformationsChannel(client, guildId);
  if (!infoChannel) {
    client.log?.('WARN', 'MainResourcesComps: information channel not found; aborting upsert');
    return;
  }

  let target = null;
  if (server[key]) {
    target = await infoChannel.messages.fetch(server[key]).catch(() => null);
  }

  if (!target) {
    try {
      const recent = await infoChannel.messages.fetch({ limit: 50 });
      const mine = recent.filter(m =>
        m.author?.id === client.user?.id &&
        Array.isArray(m.embeds) &&
        m.embeds[0]?.title === 'Main Resources & Comps'
      );
      if (mine.size > 0) {
        const sorted = [...mine.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
        target = sorted[0];
        server[key] = target.id;
        client.setInstance(guildId, instance);
        for (const msg of sorted.slice(1)) msg.delete().catch(() => {});
      }
    } catch {}
  }

  try {
    if (target) {
      await target.edit({ embeds: [embed] });
    } else {
      const sent = await infoChannel.send({ embeds: [embed] });
      server[key] = sent.id;
      client.setInstance(guildId, instance);
    }
  } catch (e) {
    client.log?.('ERROR', `MainResourcesComps upsert failed: ${e.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */
module.exports.RESOURCE_KEYS = RESOURCE_KEYS;
module.exports.COMPONENT_KEYS = COMPONENT_KEYS;
module.exports.BOOM_KEYS = BOOM_KEYS;
module.exports.TEA_KEYS = TEA_KEYS;

