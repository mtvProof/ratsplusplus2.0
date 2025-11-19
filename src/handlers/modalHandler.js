/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus
*/

const Discord = require('discord.js');
const Path = require('path');

const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
const DiscordButtons = require('../discordTools/discordButtons.js');
const DiscordMessages = require('../discordTools/discordMessages.js');
const DiscordTools = require('../discordTools/discordTools.js');

const Battlemetrics = require('../structures/Battlemetrics');
const Constants = require('../util/constants.js');
const Keywords = require('../util/keywords.js');
const Scrape = require('../util/scrape.js');

const getClient = require('../util/getClient');

// ---- MRC (Main Resources & Components) support ----
const {
  updateMainResourcesComps,
  RESOURCE_KEYS,
  COMPONENT_KEYS,
  BOOM_KEYS
} = require('../discordTools/MainResourcesCompsBox');

const {
  ensureDefaults: ensureMrcDefaults
} = require('../discordTools/MainResourcesCompsLimits');

// Helpers
function getActiveServerId(instance) {
  if (!instance) return null;
  if (typeof instance.getActiveServerId === 'function') return instance.getActiveServerId();
  const keys = Object.keys(instance.serverList || {});
  return keys.length ? keys[0] : null;
}

async function safeReply(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(content ?? '\u200b');
    } else {
      await interaction.reply({ content: content ?? '\u200b', ephemeral: true });
    }
  } catch (_) { /* ignore */ }
}
function safeParse(str) {
  try { return JSON.parse(str); }
  catch { return null; }
}

module.exports = async (client, interaction) => {
  if (!interaction || !interaction.isModalSubmit()) return;

  const instance = client.getInstance(interaction.guildId);
  const guildId = interaction.guildId;

  const verifyId = Math.floor(100000 + Math.random() * 900000);
  client.logInteraction(interaction, verifyId, 'userModal');

  // Fast ACK for ALL modals to avoid 10062 (Unknown interaction)
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (_) {
      // If deferring somehow fails, we still continue; any subsequent editReply
      // will be guarded by safeReply().
    }
  }

  // Blacklist check
  if (instance.blacklist['discordIds'].includes(interaction.user.id) &&
      !interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
    client.log(
      client.intlGet(null, 'infoCap'),
      client.intlGet(null, 'userPartOfBlacklist', {
        id: `${verifyId}`,
        user: `${interaction.user.username} (${interaction.user.id})`
      })
    );
    await safeReply(interaction, client.intlGet(guildId, 'noPermission') || 'You do not have permission.');
    return;
  }

  // ====== Main Resources & Components (MRC) modals ======
  try {
    if (interaction.customId === 'mrc_limits_modal') {
      const raw = interaction.fields.getTextInputValue('limits_json') || '{}';
      const parsed = JSON.parse(raw);

      const mrc = ensureMrcDefaults(guildId);
      const norm = (o, k) => {
        const v = Number(o?.[k]);
        return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
      };

      for (const k of RESOURCE_KEYS)  mrc.limits[k] = norm(parsed?.resources,  k);
      for (const k of COMPONENT_KEYS) mrc.limits[k] = norm(parsed?.components, k);
      for (const k of BOOM_KEYS)      mrc.limits[k] = norm(parsed?.boom,       k);

      client.setInstance(guildId, instance);

      const serverId = getActiveServerId(instance);
      if (serverId && mrc.enabled) {
        try { await updateMainResourcesComps(guildId, serverId); }
        catch (e) { client.log && client.log('WARN', `updateMainResourcesComps failed: ${e.message}`); }
      }

      await safeReply(interaction, 'Limits saved ✅');
      return;
    }

    if (interaction.customId.startsWith('mrc_limit_modal_single:')) {
      const itemName = decodeURIComponent(interaction.customId.split(':')[1] || '');
      const raw = interaction.fields.getTextInputValue('limit_value') || '0';
      const num = Math.max(0, Math.floor(Number(raw)));

      const mrc = ensureMrcDefaults(guildId);
      if (itemName in mrc.limits) {
        mrc.limits[itemName] = Number.isFinite(num) ? num : 0;
        client.setInstance(guildId, instance);

        const serverId = getActiveServerId(instance);
        if (serverId && mrc.enabled) {
          try { await updateMainResourcesComps(guildId, serverId); }
          catch (e) { client.log && client.log('WARN', `updateMainResourcesComps failed: ${e.message}`); }
        }

        await safeReply(interaction, `Set **${itemName}** to **${mrc.limits[itemName]}** ✅`);
      } else {
        await safeReply(interaction, `Unknown item: ${itemName}`);
      }
      return;
    }
  } catch (e) {
    await safeReply(interaction, `Error: ${e.message}`);
    return;
  }

  // ====== CustomTimersEdit ======
  if (interaction.customId.startsWith('CustomTimersEdit')) {
const ids = safeParse(interaction.customId.replace('CustomTimersEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const server = instance.serverList[ids.serverId];
    const cargoShipEgressTime = parseInt(interaction.fields.getTextInputValue('CargoShipEgressTime'));
    const oilRigCrateUnlockTime = parseInt(interaction.fields.getTextInputValue('OilRigCrateUnlockTime'));

    if (!server) {
      await safeReply(interaction, 'Server not found.');
      return;
    }

    if (cargoShipEgressTime && ((cargoShipEgressTime * 1000) !== server.cargoShipEgressTimeMs)) {
      server.cargoShipEgressTimeMs = cargoShipEgressTime * 1000;
    }
    if (oilRigCrateUnlockTime && ((oilRigCrateUnlockTime * 1000) !== server.oilRigLockedCrateUnlockTimeMs)) {
      server.oilRigLockedCrateUnlockTimeMs = oilRigCrateUnlockTime * 1000;
    }
    client.setInstance(guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${server.cargoShipEgressTimeMs}, ${server.oilRigLockedCrateUnlockTimeMs}`
    }));

    await safeReply(interaction, 'Custom timers updated ✅');
    return;
  }

  // ====== ServerEdit ======
  else if (interaction.customId.startsWith('ServerEdit')) {
const ids = safeParse(interaction.customId.replace('ServerEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const server = instance.serverList[ids.serverId];
    const battlemetricsId = interaction.fields.getTextInputValue('ServerBattlemetricsId');

    if (!server) {
      await safeReply(interaction, 'Server not found.');
      return;
    }

    if (battlemetricsId !== server.battlemetricsId) {
      if (battlemetricsId === '') {
        server.battlemetricsId = null;
      } else if (client.battlemetricsInstances.hasOwnProperty(battlemetricsId)) {
        const bmInstance = client.battlemetricsInstances[battlemetricsId];
        server.battlemetricsId = battlemetricsId;
        server.connect = `connect ${bmInstance.server_ip}:${bmInstance.server_port}`;
      } else {
        const bmInstance = new Battlemetrics(battlemetricsId);
        await bmInstance.setup();
        if (bmInstance.lastUpdateSuccessful) {
          client.battlemetricsInstances[battlemetricsId] = bmInstance;
          server.battlemetricsId = battlemetricsId;
          server.connect = `connect ${bmInstance.server_ip}:${bmInstance.server_port}`;
        }
      }
    }
    client.setInstance(guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${server.battlemetricsId}`
    }));

    await DiscordMessages.sendServerMessage(interaction.guildId, ids.serverId);
    client.battlemetricsIntervalCounter = 0;

    await safeReply(interaction, 'Server updated ✅');
    return;
  }

  // ====== SmartSwitchEdit ======
  else if (interaction.customId.startsWith('SmartSwitchEdit')) {
const ids = safeParse(interaction.customId.replace('SmartSwitchEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const server = instance.serverList[ids.serverId];
    const smartSwitchName = interaction.fields.getTextInputValue('SmartSwitchName');
    const smartSwitchCommand = interaction.fields.getTextInputValue('SmartSwitchCommand');
    let smartSwitchProximity = null;
    try {
      smartSwitchProximity = parseInt(interaction.fields.getTextInputValue('SmartSwitchProximity'));
    } catch { smartSwitchProximity = null; }

    if (!server || !server.switches.hasOwnProperty(ids.entityId)) {
      await safeReply(interaction, 'Switch not found.');
      return;
    }

    server.switches[ids.entityId].name = smartSwitchName;

    if (smartSwitchCommand !== server.switches[ids.entityId].command &&
        !Keywords.getListOfUsedKeywords(client, guildId, ids.serverId).includes(smartSwitchCommand)) {
      server.switches[ids.entityId].command = smartSwitchCommand;
    }

    if (smartSwitchProximity !== null && smartSwitchProximity >= 0) {
      server.switches[ids.entityId].proximity = smartSwitchProximity;
    }
    client.setInstance(guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${smartSwitchName}, ${server.switches[ids.entityId].command}`
    }));

    await DiscordMessages.sendSmartSwitchMessage(guildId, ids.serverId, ids.entityId);
    await safeReply(interaction, 'Smart switch updated ✅');
    return;
  }

  // ====== BaseCodeEditModal ======
  else if (interaction.customId === 'BaseCodeEditModal') {
    if (!instance.generalSettings) instance.generalSettings = {};

    const code = (interaction.fields.getTextInputValue('BaseCodeInput') || '').trim();

    const buildContent = (codeText) => ({
      embeds: [DiscordEmbeds.getEmbed({
        color: Constants.COLOR_SETTINGS,
        title: client.intlGet(guildId, 'baseCodesHeader'),
        description: codeText,
        thumbnail: `attachment://settings_logo.png`
      })],
      components: [DiscordButtons.getBaseCodeButtons(
        guildId,
        instance.generalSettings.codeCommandEnabled !== false
      )],
      files: [new Discord.AttachmentBuilder(
        Path.join(__dirname, '..', 'resources/images/settings_logo.png')
      )]
    });

    const codeText = (code.length === 0)
      ? `*${client.intlGet(guildId, 'baseCodeNotSet')}*`
      : `**${client.intlGet(guildId, 'baseCodeCurrent')}:** \`${code}\``;

    if (code.length !== 0 && !/^\d{4}$/.test(code)) {
      await safeReply(interaction, 'Please enter exactly 4 digits (or leave blank to clear).');
      return;
    }

    instance.generalSettings.baseCode = code.length === 0 ? '' : code;
    client.setInstance(guildId, instance);

    const channel = DiscordTools.getTextChannelById(guildId, instance.channelId.settings);
    let edited = false;

    if (channel && instance.generalSettings.baseCodeMessageId) {
      try {
        const msg = await channel.messages.fetch(instance.generalSettings.baseCodeMessageId);
        await msg.edit(buildContent(codeText));
        edited = true;
      } catch (_) { /* fall through */ }
    }

    if (!edited && channel) {
      try {
        const recent = await channel.messages.fetch({ limit: 50 });
        const target = recent.find(m =>
          m.author.id === client.user.id &&
          m.embeds?.[0]?.title === client.intlGet(guildId, 'baseCodesHeader')
        );
        if (target) {
          await target.edit(buildContent(codeText));
          instance.generalSettings.baseCodeMessageId = target.id;
          client.setInstance(guildId, instance);
          edited = true;
        }
      } catch (_) { /* ignore */ }
    }

    if (!edited && channel) {
      const newMsg = await client.messageSend(channel, buildContent(codeText));
      instance.generalSettings.baseCodeMessageId = newMsg.id;
      client.setInstance(guildId, instance);
    }

    await safeReply(
      interaction,
      code.length === 0
        ? (client.intlGet(guildId, 'baseCodeCleared') || 'Base code cleared.')
        : (client.intlGet(guildId, 'baseCodeSaved', { code }) || `Base code saved: \`${code}\``)
    );
    return;
  }

  // ====== GroupEdit ======
  else if (interaction.customId.startsWith('GroupEdit')) {
const ids = safeParse(interaction.customId.replace('GroupEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const server = instance.serverList[ids.serverId];
    const groupName = interaction.fields.getTextInputValue('GroupName');
    const groupCommand = interaction.fields.getTextInputValue('GroupCommand');

    if (!server || !server.switchGroups.hasOwnProperty(ids.groupId)) {
      await safeReply(interaction, 'Group not found.');
      return;
    }

    server.switchGroups[ids.groupId].name = groupName;

    if (groupCommand !== server.switchGroups[ids.groupId].command &&
        !Keywords.getListOfUsedKeywords(client, interaction.guildId, ids.serverId).includes(groupCommand)) {
      server.switchGroups[ids.groupId].command = groupCommand;
    }
    client.setInstance(guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${groupName}, ${server.switchGroups[ids.groupId].command}`
    }));

    await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    await safeReply(interaction, 'Group updated ✅');
    return;
  }

  // ====== GroupAddSwitch ======
  else if (interaction.customId.startsWith('GroupAddSwitch')) {
const ids = safeParse(interaction.customId.replace('GroupAddSwitch', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const server = instance.serverList[ids.serverId];
    const switchId = interaction.fields.getTextInputValue('GroupAddSwitchId');

    if (!server || !server.switchGroups.hasOwnProperty(ids.groupId)) {
      await safeReply(interaction, 'Group not found.');
      return;
    }

    if (!Object.keys(server.switches).includes(switchId) ||
        server.switchGroups[ids.groupId].switches.includes(switchId)) {
      await safeReply(interaction, 'Invalid or duplicate switch id.');
      return;
    }

    server.switchGroups[ids.groupId].switches.push(switchId);
    client.setInstance(interaction.guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${switchId}`
    }));

    await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    await safeReply(interaction, 'Switch added to group ✅');
    return;
  }

  // ====== GroupRemoveSwitch ======
  else if (interaction.customId.startsWith('GroupRemoveSwitch')) {
const ids = safeParse(interaction.customId.replace('GroupRemoveSwitch', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const server = instance.serverList[ids.serverId];
    const switchId = interaction.fields.getTextInputValue('GroupRemoveSwitchId');

    if (!server || !server.switchGroups.hasOwnProperty(ids.groupId)) {
      await safeReply(interaction, 'Group not found.');
      return;
    }

    server.switchGroups[ids.groupId].switches =
      server.switchGroups[ids.groupId].switches.filter(e => e !== switchId);
    client.setInstance(interaction.guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${switchId}`
    }));

    await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    await safeReply(interaction, 'Switch removed from group ✅');
    return;
  }

  // ====== SmartAlarmEdit ======
  else if (interaction.customId.startsWith('SmartAlarmEdit')) {
const ids = safeParse(interaction.customId.replace('SmartAlarmEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const server = instance.serverList[ids.serverId];
    const smartAlarmName = interaction.fields.getTextInputValue('SmartAlarmName');
    const smartAlarmMessage = interaction.fields.getTextInputValue('SmartAlarmMessage');
    const smartAlarmCommand = interaction.fields.getTextInputValue('SmartAlarmCommand');

    if (!server || !server.alarms.hasOwnProperty(ids.entityId)) {
      await safeReply(interaction, 'Smart alarm not found.');
      return;
    }

    server.alarms[ids.entityId].name = smartAlarmName;
    server.alarms[ids.entityId].message = smartAlarmMessage;

    if (smartAlarmCommand !== server.alarms[ids.entityId].command &&
        !Keywords.getListOfUsedKeywords(client, guildId, ids.serverId).includes(smartAlarmCommand)) {
      server.alarms[ids.entityId].command = smartAlarmCommand;
    }
    client.setInstance(guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${smartAlarmName}, ${smartAlarmMessage}, ${server.alarms[ids.entityId].command}`
    }));

    await DiscordMessages.sendSmartAlarmMessage(interaction.guildId, ids.serverId, ids.entityId);
    await safeReply(interaction, 'Smart alarm updated ✅');
    return;
  }

  // ====== StorageMonitorEdit ======
  else if (interaction.customId.startsWith('StorageMonitorEdit')) {
const ids = safeParse(interaction.customId.replace('StorageMonitorEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const server = instance.serverList[ids.serverId];
    const storageMonitorName = interaction.fields.getTextInputValue('StorageMonitorName');

    if (!server || !server.storageMonitors.hasOwnProperty(ids.entityId)) {
      await safeReply(interaction, 'Storage monitor not found.');
      return;
    }

    server.storageMonitors[ids.entityId].name = storageMonitorName;
    client.setInstance(interaction.guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${storageMonitorName}`
    }));

    await DiscordMessages.sendStorageMonitorMessage(interaction.guildId, ids.serverId, ids.entityId);
    await safeReply(interaction, 'Storage monitor updated ✅');
    return;
  }

  // ====== TrackerEdit ======
  else if (interaction.customId.startsWith('TrackerEdit')) {
const ids = safeParse(interaction.customId.replace('TrackerEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const tracker = instance.trackers[ids.trackerId];
    const trackerName = interaction.fields.getTextInputValue('TrackerName');
    const trackerBattlemetricsId = interaction.fields.getTextInputValue('TrackerBattlemetricsId');
    const trackerClanTag = interaction.fields.getTextInputValue('TrackerClanTag');

    if (!tracker) {
      await safeReply(interaction, 'Tracker not found.');
      return;
    }

    tracker.name = trackerName;
    if (trackerClanTag !== tracker.clanTag) {
      tracker.clanTag = trackerClanTag;
      client.battlemetricsIntervalCounter = 0;
    }

    if (trackerBattlemetricsId !== tracker.battlemetricsId) {
      if (client.battlemetricsInstances.hasOwnProperty(trackerBattlemetricsId)) {
        const bmInstance = client.battlemetricsInstances[trackerBattlemetricsId];
        tracker.battlemetricsId = trackerBattlemetricsId;
        tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
        tracker.img = Constants.DEFAULT_SERVER_IMG;
        tracker.title = bmInstance.server_name;
      } else {
        const bmInstance = new Battlemetrics(trackerBattlemetricsId);
        await bmInstance.setup();
        if (bmInstance.lastUpdateSuccessful) {
          client.battlemetricsInstances[trackerBattlemetricsId] = bmInstance;
          tracker.battlemetricsId = trackerBattlemetricsId;
          tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
          tracker.img = Constants.DEFAULT_SERVER_IMG;
          tracker.title = bmInstance.server_name;
        }
      }
    }
    client.setInstance(guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${trackerName}, ${tracker.battlemetricsId}, ${tracker.clanTag}`
    }));

    await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
    await safeReply(interaction, 'Tracker updated ✅');
    return;
  }

  // ====== TrackerAddPlayer ======
  else if (interaction.customId.startsWith('TrackerAddPlayer')) {
const ids = safeParse(interaction.customId.replace('TrackerAddPlayer', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const tracker = instance.trackers[ids.trackerId];
    const id = interaction.fields.getTextInputValue('TrackerAddPlayerId');

    if (!tracker) {
      await safeReply(interaction, 'Tracker not found.');
      return;
    }

    const isSteamId64 = id.length === Constants.STEAMID64_LENGTH;
    const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];

    if ((isSteamId64 && tracker.players.some(e => e.steamId === id)) ||
        (!isSteamId64 && tracker.players.some(e => e.playerId === id && e.steamId === null))) {
      await safeReply(interaction, 'Player already in list.');
      return;
    }

    let name = null;
    let steamId = null;
    let playerId = null;

    if (isSteamId64) {
      steamId = id;
      name = await Scrape.scrapeSteamProfileName(client, id);

      if (name && bmInstance) {
        playerId = Object.keys(bmInstance.players).find(e => bmInstance.players[e]['name'] === name);
        if (!playerId) playerId = null;
      }
    } else {
      playerId = id;
      if (bmInstance && bmInstance.players.hasOwnProperty(id)) {
        name = bmInstance.players[id]['name'];
      } else {
        name = '-';
      }
    }

    tracker.players.push({ name, steamId, playerId });
    client.setInstance(interaction.guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${id}`
    }));

    await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
    await safeReply(interaction, 'Player added ✅');
    return;
  }

  // ====== TrackerRemovePlayer ======
  else if (interaction.customId.startsWith('TrackerRemovePlayer')) {
const ids = safeParse(interaction.customId.replace('TrackerRemovePlayer', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
    const tracker = instance.trackers[ids.trackerId];
    const id = interaction.fields.getTextInputValue('TrackerRemovePlayerId');

    if (!tracker) {
      await safeReply(interaction, 'Tracker not found.');
      return;
    }

    const isSteamId64 = id.length === Constants.STEAMID64_LENGTH;

    if (isSteamId64) {
      tracker.players = tracker.players.filter(e => e.steamId !== id);
    } else {
      tracker.players = tracker.players.filter(e => e.playerId !== id || e.steamId !== null);
    }
    client.setInstance(interaction.guildId, instance);

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
      id: `${verifyId}`,
      value: `${id}`
    }));

    await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
    await safeReply(interaction, 'Player removed ✅');
    return;
  }

  // Fallback: no branch matched
  await safeReply(interaction, 'Done.');
};
