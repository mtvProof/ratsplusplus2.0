// src/discordTools/MainResourcesCompsLimits.js
const Discord = require('discord.js');
const DiscordButtons = require('./discordButtons');

let getClient;
try { getClient = require('../utils/getClient'); }
catch { getClient = require('../util/getClient'); }

const {
  updateMainResourcesComps,
  RESOURCE_KEYS,
  COMPONENT_KEYS,
  BOOM_KEYS
} = require('./MainResourcesCompsBox');

/* ===============================================================
   Storage & defaults
   =============================================================== */
function ensureDefaults(guildId) {
  const client = getClient();
  const instance = client.getInstance(guildId) || {};
  instance.generalSettings = instance.generalSettings || {};
  const gs = instance.generalSettings;

  // Do NOT coerce false to true — only set when missing
  if (!gs.mainResourcesComps) {
    gs.mainResourcesComps = { enabled: true, limits: {} };
  }
  const mrc = gs.mainResourcesComps;
  mrc.limits = mrc.limits || {};

  for (const k of [...RESOURCE_KEYS, ...COMPONENT_KEYS, ...BOOM_KEYS]) {
    if (!(k in mrc.limits)) mrc.limits[k] = 0;
  }

  // persist
  const clientObj = getClient();
  clientObj.setInstance(guildId, instance);
  return mrc;
}

function getActiveServerId(instance) {
  if (!instance) return null;
  if (typeof instance.getActiveServerId === 'function') return instance.getActiveServerId();
  const keys = Object.keys(instance.serverList || {});
  return keys.length ? keys[0] : null;
}

/* ===============================================================
   Resolve the #informations channel and remove card
   =============================================================== */
function getInformationChannel(guildId) {
  const client = getClient();
  const instance = client.getInstance(guildId);
  const tryIds = [
    instance?.channelId?.informations,
    instance?.channelId?.information,
    instance?.channelId?.info
  ].filter(Boolean);

  for (const cid of tryIds) {
    const ch = require('../discordTools/discordTools').getTextChannelById(guildId, cid);
    if (ch) return ch;
  }
  return null;
}

async function removeMRCWidgetIfPresent(guildId) {
  const client = getClient();
  const instance = client.getInstance(guildId);
  const gs = instance?.generalSettings || {};
  const mrc = ensureDefaults(guildId);

  const channel = getInformationChannel(guildId);
  if (!channel) return false;

  // Try known stored ids first (cover common patterns)
  const possibleIds = [
    gs.mainResourcesCompsMessageId,
    mrc.messageId,
    gs?.mainResourcesComps?.messageId
  ].filter(Boolean);

  for (const mid of possibleIds) {
    try {
      const msg = await channel.messages.fetch(mid);
      await msg.delete().catch(() => {});
      // clear any remembered id
      if (gs.mainResourcesCompsMessageId === mid) gs.mainResourcesCompsMessageId = null;
      if (mrc.messageId === mid) mrc.messageId = null;
      client.setInstance(guildId, instance);
      return true;
    } catch (_) { /* fall through */ }
  }

  // Fallback: scan a bit for a bot-authored card that looks like MRC
  try {
    const recent = await channel.messages.fetch({ limit: 50 });
    const target = recent.find(m =>
      m.author?.id === client.user.id &&
      m.embeds?.[0]?.title &&
      /resources/i.test(m.embeds[0].title) &&
      /comp/i.test(m.embeds[0].title)
    );
    if (target) {
      await target.delete().catch(() => {});
      return true;
    }
  } catch (_) {}

  return false;
}

/* ===============================================================
   Settings row (in #bot-settings)
   =============================================================== */
function getSettingsButtonsRow(guildId) {
  const mrc = ensureDefaults(guildId);
  const on = !!mrc.enabled;

  return new Discord.ActionRowBuilder().addComponents(
    new Discord.ButtonBuilder()
      .setCustomId('mrc_limits_edit')
      .setStyle(Discord.ButtonStyle.Primary)
      .setLabel('Edit')
      .setEmoji('✏️'),
    new Discord.ButtonBuilder()
      .setCustomId('mrc_limits_toggle')
      .setStyle(on ? Discord.ButtonStyle.Success : Discord.ButtonStyle.Danger)
      .setLabel(on ? 'Enabled' : 'Disabled'),
    new Discord.ButtonBuilder()
      .setCustomId('mrc_limits_edit_json')
      .setStyle(Discord.ButtonStyle.Secondary)
      .setLabel('Edit JSON')
  );
}

/* ===============================================================
   Ephemeral editor UI
   =============================================================== */
function keysFor(cat) {
  if (cat === 'components') return COMPONENT_KEYS;
  if (cat === 'boom')       return BOOM_KEYS;
  return RESOURCE_KEYS;
}

function getEditorPayload(guildId, category = 'resources') {
  const mrc = ensureDefaults(guildId);
  const items = keysFor(category);

  const options = items.map(k => ({
    label: k.length > 100 ? k.slice(0, 97) + '…' : k,
    value: k,
    description: `Limit: ${Number(mrc.limits[k] || 0)}`
  }));

  const selector = new Discord.StringSelectMenuBuilder()
    .setCustomId('mrc_item_select')
    .setPlaceholder(
      `Select a ${category === 'components' ? 'Component' : category === 'boom' ? 'Boom item' : 'Resource'} to edit`
    )
    .addOptions(options);

  const rowSelect = new Discord.ActionRowBuilder().addComponents(selector);

  const rowTabs = new Discord.ActionRowBuilder().addComponents(
    new Discord.ButtonBuilder()
      .setCustomId('mrc_cat_resources')
      .setStyle(category === 'resources' ? Discord.ButtonStyle.Success : Discord.ButtonStyle.Secondary)
      .setLabel('Resources'),
    new Discord.ButtonBuilder()
      .setCustomId('mrc_cat_components')
      .setStyle(category === 'components' ? Discord.ButtonStyle.Success : Discord.ButtonStyle.Secondary)
      .setLabel('Components'),
    new Discord.ButtonBuilder()
      .setCustomId('mrc_cat_boom')
      .setStyle(category === 'boom' ? Discord.ButtonStyle.Success : Discord.ButtonStyle.Secondary)
      .setLabel('Boom'),
    new Discord.ButtonBuilder()
      .setCustomId('mrc_editor_close')
      .setStyle(Discord.ButtonStyle.Secondary)
      .setLabel('Close')
      .setEmoji('✖️')
  );

  const embed = new Discord.EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('Main Resource/Comps Limits')
    .setDescription('Pick an item to set its limit. The totals box shows 🟢 if total ≥ limit, 🔴 if under.')
    .addFields({
      name: 'Category',
      value: category === 'components' ? 'Components' : category === 'boom' ? 'Boom' : 'Resources',
      inline: true
    });

  return { embeds: [embed], components: [rowTabs, rowSelect], ephemeral: true };
}

/* ===============================================================
   Helpers
   =============================================================== */
async function safeUpdateSettingsMessage(interaction, guildId) {
  const rows = [
    getSettingsButtonsRow(guildId),
    // second row from your shared buttons helper
    DiscordButtons.getMainResourcesCompsLimitsButtons(guildId)
  ];

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.update({ components: rows });
      return;
    }
  } catch (_) {}

  try {
    await interaction.message.edit({ components: rows });
  } catch (_) {}
}

/* ===============================================================
   Interaction handlers: interactionCreate.js should route here
   =============================================================== */
async function handleButton(interaction) {
  if (!interaction.isButton()) return;

  const guildId = interaction.guildId;
  const client = getClient();
  const instance = client.getInstance(guildId);
  const serverId = getActiveServerId(instance);
  const id = interaction.customId;

  if (id === 'mrc_limits_toggle') {
    // ACK first, then mutate & render — avoids 10062
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }

    const mrc = ensureDefaults(guildId);
    mrc.enabled = !mrc.enabled;
    client.setInstance(guildId, instance);

    try {
      if (mrc.enabled) {
        // ENABLED -> (re)create/update the widget
        if (serverId) await updateMainResourcesComps(guildId, serverId);
      } else {
        // DISABLED -> remove any existing widget without calling the updater
        await removeMRCWidgetIfPresent(guildId);
      }
    } catch (e) {
      client.log && client.log('WARN', `MRC toggle side-effect failed: ${e.message}`);
    }

    await safeUpdateSettingsMessage(interaction, guildId);
    return;
  }

  if (id === 'mrc_limits_edit') {
    await interaction.reply(getEditorPayload(guildId, 'resources'));
    return;
  }

  if (id === 'mrc_limits_edit_json') {
    const mrc = ensureDefaults(guildId);
    const data = { resources: {}, components: {}, boom: {} };
    for (const k of RESOURCE_KEYS)  data.resources[k]  = Number(mrc.limits[k] || 0);
    for (const k of COMPONENT_KEYS) data.components[k] = Number(mrc.limits[k] || 0);
    for (const k of BOOM_KEYS)      data.boom[k]       = Number(mrc.limits[k] || 0);

    const json = JSON.stringify(data, null, 2).slice(0, 4000);

    const modal = new Discord.ModalBuilder()
      .setCustomId('mrc_limits_modal')
      .setTitle('Main Resource/Comps Limits (JSON)');

    const input = new Discord.TextInputBuilder()
      .setCustomId('limits_json')
      .setLabel('Edit limits as JSON (numbers only)')
      .setStyle(Discord.TextInputStyle.Paragraph)
      .setRequired(true)
      .setValue(json);

    modal.addComponents(new Discord.ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  if (id === 'mrc_cat_resources' || id === 'mrc_cat_components' || id === 'mrc_cat_boom') {
    const cat = id === 'mrc_cat_components' ? 'components' : (id === 'mrc_cat_boom' ? 'boom' : 'resources');
    await interaction.update(getEditorPayload(guildId, cat));
    return;
  }

  if (id === 'mrc_editor_close') {
    try { await interaction.update({ components: [], embeds: [] }); } catch {}
    return;
  }
}

async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'mrc_item_select') return;

  const guildId = interaction.guildId;
  const itemName = interaction.values?.[0];
  if (!itemName) {
    await interaction.reply({ content: 'No item selected.', ephemeral: true });
    return;
  }

  const mrc = ensureDefaults(guildId);
  const current = Number(mrc.limits[itemName] || 0);

  const modal = new Discord.ModalBuilder()
    .setCustomId(`mrc_limit_modal_single:${encodeURIComponent(itemName)}`)
    .setTitle(`Set limit: ${itemName}`);

  const input = new Discord.TextInputBuilder()
    .setCustomId('limit_value')
    .setLabel('Limit (non-negative integer)')
    .setStyle(Discord.TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(current));

  modal.addComponents(new Discord.ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleModal(interaction) {
  if (!interaction.isModalSubmit()) return;

  // ACK quickly
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  const guildId = interaction.guildId;
  const client = getClient();
  const instance = client.getInstance(guildId);
  const serverId = getActiveServerId(instance);

  try {
    if (interaction.customId === 'mrc_limits_modal') {
      const raw = interaction.fields.getTextInputValue('limits_json') || '{}';
      const parsed = JSON.parse(raw);

      const mrc = ensureDefaults(guildId);
      const norm = (o, k) => {
        const v = Number(o?.[k]);
        return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
      };

      for (const k of RESOURCE_KEYS)  mrc.limits[k] = norm(parsed?.resources,  k);
      for (const k of COMPONENT_KEYS) mrc.limits[k] = norm(parsed?.components, k);
      for (const k of BOOM_KEYS)      mrc.limits[k] = norm(parsed?.boom,       k);

      client.setInstance(guildId, instance);

      if (serverId && mrc.enabled) {
        try { await updateMainResourcesComps(guildId, serverId); }
        catch (e) { client.log && client.log('WARN', `updateMainResourcesComps failed: ${e.message}`); }
      }

      await interaction.editReply('Limits saved ✅').catch(() => {});
      return;
    }

    if (interaction.customId.startsWith('mrc_limit_modal_single:')) {
      const itemName = decodeURIComponent(interaction.customId.split(':')[1] || '');
      const raw = interaction.fields.getTextInputValue('limit_value') || '0';
      const num = Math.max(0, Math.floor(Number(raw)));

      const mrc = ensureDefaults(guildId);
      if (itemName in mrc.limits) {
        mrc.limits[itemName] = Number.isFinite(num) ? num : 0;
        client.setInstance(guildId, instance);

        if (serverId && mrc.enabled) {
          try { await updateMainResourcesComps(guildId, serverId); }
          catch (e) { client.log && client.log('WARN', `updateMainResourcesComps failed: ${e.message}`); }
        }

        await interaction.editReply(`Set **${itemName}** to **${mrc.limits[itemName]}** ✅`).catch(() => {});
      } else {
        await interaction.editReply(`Unknown item: ${itemName}`).catch(() => {});
      }
      return;
    }
  } catch (e) {
    await interaction.editReply(`Error: ${e.message}`).catch(() => {});
  }
}

module.exports = {
  ensureDefaults,
  getSettingsButtonsRow,
  handleButton,
  handleSelect,
  handleModal
};
