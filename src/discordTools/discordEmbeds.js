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

const getClient = require('../util/getClient');
const Constants = require('../util/constants.js');
const DiscordTools = require('./discordTools.js');
const InstanceUtils = require('../util/instanceUtils.js');
const Timer = require('../util/timer');

/* ------------------------------ helpers ------------------------------ */
function isNonEmptyString(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

// Accept http/https and Discord's attachment:// scheme for images/thumbnails
function isUrlLike(x) {
  if (!isNonEmptyString(x)) return false;
  const s = x.trim();
  if (s.startsWith('attachment://')) return true;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// --- Playtime helpers ---
function formatPlaytimeShort(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d${h}h`;
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

function computeResetKey(rustplus) {
  const m = rustplus?.map;
  const seed = m?.seed ?? m?.worldSeed ?? '';
  const salt = m?.salt ?? m?.worldSalt ?? '';
  const size = m?.size ?? m?.width ?? '';
  return `${seed}:${salt}:${size}`;
}


// setURL must be http/https (Discord doesn't accept attachment:// for hyperlink URLs)
function toHttpUrlOrNull(x) {
  if (!isNonEmptyString(x)) return null;
  try {
    const u = new URL(x.trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.toString() : null;
  } catch {
    return null;
  }
}

/* ---------------------------- embed factory --------------------------- */
function getEmbed(options = {}) {
  const embed = new Discord.EmbedBuilder();

  if ('title' in options)       embed.setTitle(String(options.title));
  if ('color' in options)       embed.setColor(options.color);
  if ('description' in options) embed.setDescription(String(options.description));

  if (isUrlLike(options.thumbnail)) embed.setThumbnail(options.thumbnail);
  if (isUrlLike(options.image))     embed.setImage(options.image);

  const httpUrl = toHttpUrlOrNull(options.url);
  if (httpUrl) embed.setURL(httpUrl);

  if ('author' in options && options.author) {
    const a = options.author;
    const name = isNonEmptyString(a.name) ? a.name : undefined;
    const iconURL = isUrlLike(a.iconURL) ? a.iconURL : undefined;
    const url = toHttpUrlOrNull(a.url) || undefined;
    if (name || iconURL || url) embed.setAuthor({ name, iconURL, url });
  }

  if ('footer' in options && options.footer) {
    const f = options.footer;
    const text = isNonEmptyString(f.text) ? f.text : undefined;
    const iconURL = isUrlLike(f.iconURL) ? f.iconURL : undefined;
    if (text || iconURL) embed.setFooter({ text, iconURL });
  }

  if ('fields' in options && Array.isArray(options.fields)) {
    const fields = options.fields
      .filter(f => f && (isNonEmptyString(f.name) || isNonEmptyString(f.value)))
      .map(f => ({
        name:  String(f.name ?? '\u200b'),
        value: String(f.value ?? '\u200b'),
        inline: !!f.inline
      }));
    if (fields.length) embed.addFields(fields);
  }

  if ('timestamp' in options && options.timestamp) {
    embed.setTimestamp(options.timestamp === true ? new Date() : new Date(options.timestamp));
  }

  return embed;
}

/* ------------------------------ exports ------------------------------ */
module.exports = {
  getEmbed,

  getSmartSwitchEmbed: function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].switches[entityId];
    const grid = entity.location !== null ? ` (${entity.location})` : '';

    return getEmbed({
      title: `${entity.name}${grid}`,
      color: entity.active ? Constants.COLOR_ACTIVE : Constants.COLOR_INACTIVE,
      description: `**ID**: \`${entityId}\``,
      thumbnail: `attachment://${entity.image}`,
      footer: { text: `${entity.server}` },
      fields: [{
        name: getClient().intlGet(guildId, 'customCommand'),
        value: `\`${instance.generalSettings.prefix}${entity.command}\``,
        inline: true
      }],
      timestamp: true
    });
  },

  getServerEmbed: async function (guildId, serverId) {
    const instance = getClient().getInstance(guildId);
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    const server = instance.serverList[serverId];
    let hoster = getClient().intlGet(guildId, 'unknown');
    if (credentials.hasOwnProperty(server.steamId)) {
      const usr = await DiscordTools.getUserById(guildId, credentials[server.steamId].discord_user_id);
      hoster = usr.user.username;
    }

    let description = '';
    if (server.battlemetricsId !== null) {
      const bmId = server.battlemetricsId;
      const bmIdLink = `[${bmId}](${Constants.BATTLEMETRICS_SERVER_URL}${bmId})`;
      description += `__**${getClient().intlGet(guildId, 'battlemetricsId')}:**__ ${bmIdLink}\n`;

      const bmInstance = getClient().battlemetricsInstances[bmId];
      if (bmInstance) {
        description += `__**${getClient().intlGet(guildId, 'streamerMode')}:**__ `;
        description += (bmInstance.streamerMode ? getClient().intlGet(guildId, 'onCap') :
          getClient().intlGet(guildId, 'offCap')) + '\n';
      }
    }
    description += `\n${server.description}`;

    return getEmbed({
      title: `${server.title}`,
      color: Constants.COLOR_DEFAULT,
      description: description,
      thumbnail: `${server.img}`,
      fields: [{
        name: getClient().intlGet(guildId, 'connect'),
        value: `\`${server.connect === null ?
          getClient().intlGet(guildId, 'unavailable') : server.connect}\``,
        inline: true
      },
      {
        name: getClient().intlGet(guildId, 'hoster'),
        value: `\`${hoster} (${server.steamId})\``,
        inline: false
      }]
    });
  },

  getTrackerEmbed: function (guildId, trackerId) {
    const instance = getClient().getInstance(guildId);
    const tracker = instance.trackers[trackerId];
    const battlemetricsId = tracker.battlemetricsId;
    const bmInstance = getClient().battlemetricsInstances[battlemetricsId];

    const successful = bmInstance && bmInstance.lastUpdateSuccessful ? true : false;

    const battlemetricsLink = `[${battlemetricsId}](${Constants.BATTLEMETRICS_SERVER_URL}${battlemetricsId})`;
    const serverStatus = !successful ? Constants.NOT_FOUND_EMOJI :
      (bmInstance.server_status ? Constants.ONLINE_EMOJI : Constants.OFFLINE_EMOJI);

    let description = `__**Battlemetrics ID:**__ ${battlemetricsLink}\n`;
    description += `__**${getClient().intlGet(guildId, 'serverId')}:**__ ${tracker.serverId}\n`;
    description += `__**${getClient().intlGet(guildId, 'serverStatus')}:**__ ${serverStatus}\n`;
    description += `__**${getClient().intlGet(guildId, 'streamerMode')}:**__ `;
    description += (!bmInstance ? Constants.NOT_FOUND_EMOJI : (bmInstance.streamerMode ?
      getClient().intlGet(guildId, 'onCap') : getClient().intlGet(guildId, 'offCap'))) + '\n';
    description += `__**${getClient().intlGet(guildId, 'clanTag')}:**__ `;
    description += tracker.clanTag !== '' ? `\`${tracker.clanTag}\`` : '';

    let totalCharacters = description.length;
    let fieldIndex = 0;
    let playerName = [''], playerId = [''], playerStatus = [''];
    let playerNameCharacters = 0, playerIdCharacters = 0, playerStatusCharacters = 0;
    for (const player of tracker.players) {
      let name = `${player.name}`;

      const nameMaxLength = Constants.EMBED_FIELD_MAX_WIDTH_LENGTH_3;
      name = name.length <= nameMaxLength ? name : name.substring(0, nameMaxLength - 2) + '..';
      name += '\n';

      let id = '';
      let status = '';

      const steamIdLink = Constants.GET_STEAM_PROFILE_LINK(player.steamId);
      const bmIdLink = Constants.GET_BATTLEMETRICS_PROFILE_LINK(player.playerId);

      const isNewLine = (player.steamId !== null && player.playerId !== null) ? true : false;
      id += `${player.steamId !== null ? steamIdLink : ''}`;
      id += `${player.steamId !== null && player.playerId !== null ? ' /\n' : ''}`;
      id += `${player.playerId !== null ? bmIdLink : ''}`;
      id += `${player.steamId === null && player.playerId === null ?
        getClient().intlGet(guildId, 'empty') : ''}`;
      id += '\n';

      if (!bmInstance.players.hasOwnProperty(player.playerId) || !successful) {
        status += `${Constants.NOT_FOUND_EMOJI}\n`;
      }
      else {
        let time = null;
        if (bmInstance.players[player.playerId]['status']) {
          time = bmInstance.getOnlineTime(player.playerId);
          status += `${Constants.ONLINE_EMOJI}`;
        }
        else {
          time = bmInstance.getOfflineTime(player.playerId);
          status += `${Constants.OFFLINE_EMOJI}`;
        }
        status += time !== null ? ` [${time[1]}]\n` : '\n';
      }

      if (isNewLine) {
        name += '\n';
        status += '\n';
      }

      if (totalCharacters + (name.length + id.length + status.length) >= Constants.EMBED_MAX_TOTAL_CHARACTERS) {
        break;
      }

      if ((playerNameCharacters + name.length) > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
        (playerIdCharacters + id.length) > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
        (playerStatusCharacters + status.length) > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS) {
        fieldIndex += 1;

        playerName.push('');
        playerId.push('');
        playerStatus.push('');

        playerNameCharacters = 0;
        playerIdCharacters = 0;
        playerStatusCharacters = 0;
      }

      playerNameCharacters += name.length;
      playerIdCharacters += id.length;
      playerStatusCharacters += status.length;

      totalCharacters += name.length + id.length + status.length;

      playerName[fieldIndex] += name;
      playerId[fieldIndex] += id;
      playerStatus[fieldIndex] += status;
    }

    const fields = [];
    for (let i = 0; i < (fieldIndex + 1); i++) {
      fields.push({
        name: i === 0 ? `__${getClient().intlGet(guildId, 'name')}__\n\u200B` : '\u200B',
        value: playerName[i] !== '' ? playerName[i] : getClient().intlGet(guildId, 'empty'),
        inline: true
      });
      fields.push({
        name: i === 0 ? `__${getClient().intlGet(guildId, 'steamId')}__ /\n` +
          `__${getClient().intlGet(guildId, 'battlemetricsId')}__` : '\u200B',
        value: playerId[i] !== '' ? playerId[i] : getClient().intlGet(guildId, 'empty'),
        inline: true
      });
      fields.push({
        name: i === 0 ? `__${getClient().intlGet(guildId, 'status')}__\n\u200B` : '\u200B',
        value: playerStatus[i] !== '' ? playerStatus[i] : getClient().intlGet(guildId, 'empty'),
        inline: true
      });
    }

    return getEmbed({
      title: `${tracker.name}`,
      color: Constants.COLOR_DEFAULT,
      description: description,
      thumbnail: `${tracker.img}`,
      footer: { text: `${tracker.title}` },
      fields: fields,
      timestamp: true
    });
  },

  getSmartAlarmEmbed: function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];

    const notifOn = entity.notify !== false;
    const notifLabel = notifOn
      ? (getClient().intlGet(guildId, 'notifsOn') || 'NOTIFS ON')
      : (getClient().intlGet(guildId, 'notifsOff') || 'NOTIFS OFF');
    const notifBadge = notifOn ? '🟢' : '🔴';

    const grid = entity.location !== null ? ` (${entity.location})` : '';

    let description = `**ID**: \`${entityId}\`\n`;
    description += `**${getClient().intlGet(guildId, 'lastTrigger')}:** `;
    if (entity.lastTrigger !== null) {
      const lastTriggerDate = new Date(entity.lastTrigger * 1000);
      const timeSinceTriggerSeconds = Math.floor((new Date() - lastTriggerDate) / 1000);
      const time = Timer.secondsToFullScale(timeSinceTriggerSeconds);
      description += `${time}`;
    }

    return getEmbed({
      title: `${entity.name}${grid}`,
      color: entity.active ? Constants.COLOR_ACTIVE : Constants.COLOR_DEFAULT,
      description,
      thumbnail: `attachment://${entity.image}`,
      footer: { text: `${entity.server}` },
      fields: [
        { name: getClient().intlGet(guildId, 'notifications') || 'Notifications', value: `${notifBadge} ${notifLabel}`, inline: true },
        { name: getClient().intlGet(guildId, 'message'), value: `\`${entity.message}\``, inline: true },
        { name: getClient().intlGet(guildId, 'customCommand'), value: `\`${instance.generalSettings.prefix}${entity.command}\``, inline: false }
      ],
      timestamp: true
    });
  },

  getStorageMonitorEmbed: function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];
    const rustplus = getClient().rustplusInstances[guildId];
    const grid = entity.location !== null ? ` (${entity.location})` : '';

    let description = `**ID** \`${entityId}\``;

    if (!rustplus) {
      return getEmbed({
        title: `${entity.name}${grid}`,
        color: Constants.COLOR_DEFAULT,
        description: `${description}\n${getClient().intlGet(guildId, 'statusNotConnectedToServer')}`,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
        timestamp: true
      });
    }

    if (rustplus && rustplus.storageMonitors[entityId].capacity === 0) {
      return getEmbed({
        title: `${entity.name}${grid}`,
        color: Constants.COLOR_DEFAULT,
        description:
          `${description}\n${getClient().intlGet(guildId, 'statusNotElectronicallyConnected')}`,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
        timestamp: true
      });
    }

    description += `\n**${getClient().intlGet(guildId, 'type')}** ` +
      `\`${entity.type !== null ? getClient().intlGet(guildId, entity.type) :
        getClient().intlGet(guildId, 'unknown')}\``;

    const items = rustplus.storageMonitors[entityId].items;
    const expiry = rustplus.storageMonitors[entityId].expiry;
    const capacity = rustplus.storageMonitors[entityId].capacity;

    description += `\n**${getClient().intlGet(guildId, 'slots')}** `;
    description += `\`(${items.length}/${capacity})\``;

    if (entity.type === 'toolCupboard') {
      let seconds = 0;
      if (expiry !== 0) seconds = (new Date(expiry * 1000) - new Date()) / 1000;

      let upkeep = null;
      if (seconds === 0) {
        upkeep = `:warning:\`${getClient().intlGet(guildId, 'decayingCap')}\`:warning:`;
        instance.serverList[serverId].storageMonitors[entityId].upkeep =
          getClient().intlGet(guildId, 'decayingCap');
      } else {
        let upkeepTime = Timer.secondsToFullScale(seconds);
        upkeep = `\`${upkeepTime}\``;
        instance.serverList[serverId].storageMonitors[entityId].upkeep = `${upkeepTime}`;
      }
      description += `\n**${getClient().intlGet(guildId, 'upkeep')}** ${upkeep}`;
      getClient().setInstance(guildId, instance);
    }

    let itemName = '', itemQuantity = '', storageItems = {};
    for (const item of items) {
      if (storageItems.hasOwnProperty(item.itemId)) {
        storageItems[item.itemId] += item.quantity;
      } else {
        storageItems[item.itemId] = item.quantity;
      }
    }

    for (const [id, quantity] of Object.entries(storageItems)) {
      itemName += `\`${getClient().items.getName(id)}\`\n`;
      itemQuantity += `\`${quantity}\`\n`;
    }

    if (itemName === '') itemName = getClient().intlGet(guildId, 'empty');
    if (itemQuantity === '') itemQuantity = getClient().intlGet(guildId, 'empty');

    return getEmbed({
      title: `${entity.name}${grid}`,
      color: Constants.COLOR_DEFAULT,
      description: description,
      thumbnail: `attachment://${entity.image}`,
      footer: { text: `${entity.server}` },
      fields: [
        { name: getClient().intlGet(guildId, 'item'), value: itemName, inline: true },
        { name: getClient().intlGet(guildId, 'quantity'), value: itemQuantity, inline: true }
      ],
      timestamp: true
    });
  },

  getSmartSwitchGroupEmbed: function (guildId, serverId, groupId) {
    const instance = getClient().getInstance(guildId);
    const group = instance.serverList[serverId].switchGroups[groupId];

    let switchName = '', switchId = '', switchActive = '';
    for (const groupSwitchId of group.switches) {
      if (instance.serverList[serverId].switches.hasOwnProperty(groupSwitchId)) {
        const sw = instance.serverList[serverId].switches[groupSwitchId];
        const active = sw.active;
        switchName += `${sw.name}${sw.location !== null ? ` ${sw.location}` : ''}\n`;
        switchId += `${groupSwitchId}\n`;
        if (sw.reachable) {
          switchActive += `${(active) ? Constants.ONLINE_EMOJI : Constants.OFFLINE_EMOJI}\n`;
        } else {
          switchActive += `${Constants.NOT_FOUND_EMOJI}\n`;
        }
      } else {
        instance.serverList[serverId].switchGroups[groupId].switches =
          instance.serverList[serverId].switchGroups[groupId].switches.filter(e => e !== groupSwitchId);
      }
    }
    getClient().setInstance(guildId, instance);

    if (switchName === '') switchName = getClient().intlGet(guildId, 'none');
    if (switchId === '') switchId = getClient().intlGet(guildId, 'none');
    if (switchActive === '') switchActive = getClient().intlGet(guildId, 'none');

    return getEmbed({
      title: group.name,
      color: Constants.COLOR_DEFAULT,
      description: `**ID**: \`${groupId}\``,
      thumbnail: `attachment://${group.image}`,
      footer: { text: `${instance.serverList[serverId].title}` },
      fields: [
        {
          name: getClient().intlGet(guildId, 'customCommand'),
          value: `\`${instance.generalSettings.prefix}${group.command}\``,
          inline: false
        },
        { name: getClient().intlGet(guildId, 'switches'), value: switchName, inline: true },
        { name: 'ID', value: switchId, inline: true },
        { name: getClient().intlGet(guildId, 'status'), value: switchActive, inline: true }
      ],
      timestamp: true
    });
  },

  getNotFoundSmartDeviceEmbed: function (guildId, serverId, entityId, type) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId][type][entityId];
    const grid = entity.location !== null ? ` (${entity.location})` : '';

    return getEmbed({
      title: `${entity.name}${grid}`,
      color: Constants.COLOR_INACTIVE,
      description: `**ID**: \`${entityId}\`\n` +
        `${getClient().intlGet(guildId, 'statusNotFound')} ${Constants.NOT_FOUND_EMOJI}`,
      thumbnail: `attachment://${entity.image}`,
      footer: { text: `${entity.server}` }
    });
  },

  getStorageMonitorRecycleEmbed: function (guildId, serverId, entityId, items) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];
    const grid = entity.location !== null ? ` (${entity.location})` : '';

    let itemName = '', itemQuantity = '';
    for (const item of items['recycler']) {
      itemName += `\`${getClient().items.getName(item.itemId)}\`\n`;
      itemQuantity += `\`${item.quantity}\`\n`;
    }

    const embed = getEmbed({
      title: `${getClient().intlGet(guildId, 'resultRecycling')}:`,
      color: Constants.COLOR_DEFAULT,
      thumbnail: 'attachment://recycler.png',
      footer: { text: `${entity.server} | ${getClient().intlGet(guildId, 'messageDeletedIn30')}` },
      description: `**${getClient().intlGet(guildId, 'name')}** ` +
        `\`${entity.name}${grid}\`\n**ID** \`${entityId}\``
    });

    if (itemName === '') itemName = getClient().intlGet(guildId, 'empty');
    if (itemQuantity === '') itemQuantity = getClient().intlGet(guildId, 'empty');

    embed.addFields(
      { name: getClient().intlGet(guildId, 'item'), value: itemName, inline: true },
      { name: getClient().intlGet(guildId, 'quantity'), value: itemQuantity, inline: true }
    );

    return embed;
  },

  getDecayingNotificationEmbed: function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];
    const grid = entity.location !== null ? ` (${entity.location})` : '';

    return getEmbed({
      title: getClient().intlGet(guildId, 'isDecaying', { device: `${entity.name}${grid}` }),
      color: Constants.COLOR_INACTIVE,
      description: `**ID** \`${entityId}\``,
      thumbnail: `attachment://${entity.image}`,
      footer: { text: `${entity.server}` },
      timestamp: true
    });
  },

  getStorageMonitorDisconnectNotificationEmbed: function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];
    const grid = entity.location !== null ? ` (${entity.location})` : '';

    return getEmbed({
      title: getClient().intlGet(guildId, 'isNoLongerConnected', { device: `${entity.name}${grid}` }),
      color: Constants.COLOR_INACTIVE,
      description: `**ID** \`${entityId}\``,
      thumbnail: `attachment://${entity.image}`,
      footer: { text: `${entity.server}` },
      timestamp: true
    });
  },

  getStorageMonitorNotFoundEmbed: async function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const server = instance.serverList[serverId];
    const entity = server.storageMonitors[entityId];
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    const user = await DiscordTools.getUserById(guildId, credentials[server.steamId].discord_user_id);
    const grid = entity.location !== null ? ` (${entity.location})` : '';

    return getEmbed({
      title: getClient().intlGet(guildId, 'smartDeviceNotFound', {
        device: `${entity.name}${grid}`,
        user: user.user.username
      }),
      color: Constants.COLOR_INACTIVE,
      description: `**ID** \`${entityId}\``,
      thumbnail: `attachment://${entity.image}`,
      footer: { text: `${entity.server}` },
      timestamp: true
    });
  },

  getSmartSwitchNotFoundEmbed: async function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const server = instance.serverList[serverId];
    const entity = instance.serverList[serverId].switches[entityId];
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    const user = await DiscordTools.getUserById(guildId, credentials[server.steamId].discord_user_id);
    const grid = entity.location !== null ? ` (${entity.location})` : '';

    return getEmbed({
      title: getClient().intlGet(guildId, 'smartDeviceNotFound', {
        device: `${entity.name}${grid}`,
        user: user.user.username
      }),
      color: Constants.COLOR_INACTIVE,
      description: `**ID** \`${entityId}\``,
      thumbnail: `attachment://${entity.image}`,
      footer: { text: `${entity.server}` },
      timestamp: true
    });
  },

  getSmartAlarmNotFoundEmbed: async function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const server = instance.serverList[serverId];
    const entity = server.alarms[entityId];
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    const user = await DiscordTools.getUserById(guildId, credentials[server.steamId].discord_user_id);
    const grid = entity.location !== null ? ` (${entity.location})` : '';

    return getEmbed({
      title: getClient().intlGet(guildId, 'smartDeviceNotFound', {
        device: `${entity.name}${grid}`,
        user: user.user.username
      }),
      color: Constants.COLOR_INACTIVE,
      description: `**ID** \`${entityId}\``,
      thumbnail: `attachment://${entity.image}`,
      footer: { text: `${entity.server}` },
      timestamp: true
    });
  },

  getNewsEmbed: function (guildId, data) {
    return getEmbed({
      title: `${getClient().intlGet(guildId, 'newsCap')}: ${data.title}`,
      color: Constants.COLOR_DEFAULT,
      description: `${data.message}`,
      thumbnail: Constants.DEFAULT_SERVER_IMG,
      timestamp: true
    });
  },

  getTeamLoginEmbed: function (guildId, body, png) {
    return getEmbed({
      color: Constants.COLOR_ACTIVE,
      timestamp: true,
      footer: { text: body.name },
      author: {
        name: getClient().intlGet(guildId, 'userJustConnected', { name: body.targetName }),
        iconURL: (png !== null) ? png : Constants.DEFAULT_SERVER_IMG,
        url: `${Constants.STEAM_PROFILES_URL}${body.targetId}`
      }
    });
  },

  getPlayerDeathEmbed: function (data, body, png) {
    return getEmbed({
      color: Constants.COLOR_INACTIVE,
      thumbnail: png,
      title: data.title,
      timestamp: true,
      footer: { text: body.name },
      url: body.targetId !== '' ? `${Constants.STEAM_PROFILES_URL}${body.targetId}` : ''
    });
  },

  getAlarmRaidAlarmEmbed: function (data, body) {
    return getEmbed({
      color: Constants.COLOR_ACTIVE,
      timestamp: true,
      footer: { text: body.name },
      title: data.title,
      description: data.message,
      thumbnail: body.img && isUrlLike(body.img) ? body.img : 'attachment://rocket.png'
    });
  },

  getAlarmEmbed: function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];
    const grid = entity.location !== null ? ` (${entity.location})` : '';

    return getEmbed({
      color: Constants.COLOR_DEFAULT,
      thumbnail: `attachment://${entity.image}`,
      title: `${entity.name}${grid}`,
      footer: { text: entity.server },
      timestamp: true,
      fields: [
        { name: 'ID', value: `\`${entityId}\``, inline: true },
        { name: getClient().intlGet(guildId, 'message'), value: `\`${entity.message}\``, inline: true }
      ]
    });
  },

  getEventEmbed: function (guildId, serverId, text, image, color = Constants.COLOR_DEFAULT) {
    const instance = getClient().getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
      color: color,
      thumbnail: `attachment://${image}`,
      title: text,
      footer: { text: server.title, iconURL: server.img },
      timestamp: true
    });
  },

  getActionInfoEmbed: function (color, str, footer = null, ephemeral = true) {
    return {
      embeds: [getEmbed({
        color: color === 0 ? Constants.COLOR_DEFAULT : Constants.COLOR_INACTIVE,
        description: `\`\`\`diff\n${(color === 0) ? '+' : '-'} ${str}\n\`\`\``,
        footer: footer !== null ? { text: footer } : null
      })],
      ephemeral: ephemeral
    };
  },

  getServerChangedStateEmbed: function (guildId, serverId, state) {
    const instance = getClient().getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
      color: state ? Constants.COLOR_INACTIVE : Constants.COLOR_ACTIVE,
      title: state ?
        getClient().intlGet(guildId, 'serverJustOffline') :
        getClient().intlGet(guildId, 'serverJustOnline'),
      thumbnail: server.img,
      timestamp: true,
      footer: { text: server.title }
    });
  },

  getServerWipeDetectedEmbed: function (guildId, serverId) {
    const instance = getClient().getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
      color: Constants.COLOR_DEFAULT,
      title: getClient().intlGet(guildId, 'wipeDetected'),
      image: `attachment://${guildId}_map_full.png`,
      timestamp: true,
      footer: { text: server.title }
    });
  },

  getServerConnectionInvalidEmbed: function (guildId, serverId) {
    const instance = getClient().getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
      color: Constants.COLOR_INACTIVE,
      title: getClient().intlGet(guildId, 'serverInvalid'),
      thumbnail: server.img,
      timestamp: true,
      footer: { text: server.title }
    });
  },

  getActivityNotificationEmbed: function (guildId, serverId, color, text, steamId, png, title = null) {
    const instance = getClient().getInstance(guildId);
    const footerTitle = title !== null ? title : instance.serverList[serverId].title;
    return getEmbed({
      color: color,
      timestamp: true,
      footer: { text: footerTitle },
      author: {
        name: text,
        iconURL: (png !== null) ? png : Constants.DEFAULT_SERVER_IMG,
        url: `${Constants.STEAM_PROFILES_URL}${steamId}`
      }
    });
  },

  getUpdateServerInformationEmbed: function (rustplus) {
    const guildId = rustplus.guildId;
    const instance = getClient().getInstance(guildId);

    const time = rustplus.getCommandTime(true);
    const timeLeftTitle = getClient().intlGet(rustplus.guildId, 'timeTill', {
      event: rustplus.time.isDay() ? Constants.NIGHT_EMOJI : Constants.DAY_EMOJI
    });
    const playersFieldName = getClient().intlGet(guildId, 'players');
    const timeFieldName = getClient().intlGet(guildId, 'time');
    const wipeFieldName = getClient().intlGet(guildId, 'wipe');
    const mapSizeFieldName = getClient().intlGet(guildId, 'mapSize');
    const mapSeedFieldName = getClient().intlGet(guildId, 'mapSeed');
    const mapSaltFieldName = getClient().intlGet(guildId, 'mapSalt');
    const mapFieldName = getClient().intlGet(guildId, 'map');

    const embed = getEmbed({
      title: getClient().intlGet(guildId, 'serverInfo'),
      color: Constants.COLOR_DEFAULT,
      thumbnail: 'attachment://server_info_logo.png',
      footer: { text: instance.serverList[rustplus.serverId].title },
      fields: [
        { name: playersFieldName, value: `\`${rustplus.getCommandPop(true)}\``, inline: true },
        { name: timeFieldName, value: `\`${time[0]}\``, inline: true },
        { name: wipeFieldName, value: `\`${rustplus.getCommandWipe(true)}\``, inline: true }
      ],
      timestamp: true
    });

    if (time[1] !== null) {
      embed.addFields(
        { name: timeLeftTitle, value: `\`${time[1]}\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '\u200B', value: '\u200B', inline: true }
      );
    } else {
      embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
    }

    embed.addFields(
      { name: mapSizeFieldName, value: `\`${rustplus.info.mapSize}\``, inline: true },
      { name: mapSeedFieldName, value: `\`${rustplus.info.seed}\``, inline: true },
      { name: mapSaltFieldName, value: `\`${rustplus.info.salt}\``, inline: true },
      { name: mapFieldName, value: `\`${rustplus.info.map}\``, inline: true }
    );

    // --- TC upkeep summary (Tool Cupboard storage monitors) ---
    const tcUpkeepLines = [];

    const serverEntry = instance.serverList && instance.serverList[rustplus.serverId];
    if (serverEntry && serverEntry.storageMonitors) {
      const storageMonitors = serverEntry.storageMonitors;

      for (const entityId in storageMonitors) {
        const sm = storageMonitors[entityId];
        if (!sm || sm.type !== 'toolCupboard') continue;

        // Live storage monitor info from rustplus (for capacity & expiry)
        const rpSm = rustplus.storageMonitors
          ? rustplus.storageMonitors[entityId]
          : null;

        const name = sm.name || `TC ${entityId}`;

        // If not electronically connected, show that instead of a stale upkeep value
        if (!rpSm || rpSm.capacity === 0) {
          const notConnectedText = getClient().intlGet(
            guildId,
            'statusNotElectronicallyConnected'
          );
          tcUpkeepLines.push(
            `${Constants.OFFLINE_EMOJI} ${name} - ${notConnectedText}`
          );
          continue;
        }

        // Compute seconds remaining from expiry so we can decide green vs red
        const expiry = rpSm.expiry || 0;
        let seconds = 0;
        if (expiry !== 0) {
          seconds = (new Date(expiry * 1000) - new Date()) / 1000;
          if (seconds < 0) seconds = 0;
        }

        // Use the stored human-readable upkeep string if present, otherwise format from seconds
        let upkeepText = sm.upkeep;
        if (!upkeepText) {
          upkeepText = Timer.secondsToFullScale(seconds);
        }

        // Green dot if 1 day or more of upkeep, red dot if less than 1 day
        const dot =
          seconds >= 24 * 60 * 60 ? Constants.ONLINE_EMOJI : Constants.OFFLINE_EMOJI;

        // Example: ":green_circle: Main TC - 1d1h27m"
        tcUpkeepLines.push(`${dot} ${name} - ${upkeepText}`);
      }
    }

    if (tcUpkeepLines.length > 0) {
      embed.addFields({
        name: 'TC Upkeep',
        value: tcUpkeepLines.join('\n'),
        inline: false
      });
    }

    if (instance.serverList[rustplus.serverId].connect !== null) {
      embed.addFields({
        name: getClient().intlGet(guildId, 'connect'),
        value: `\`${instance.serverList[rustplus.serverId].connect}\``,
        inline: false
      });
    }

    return embed;
  },



  getUpdateEventInformationEmbed: function (rustplus) {
    const guildId = rustplus.guildId;
    const instance = getClient().getInstance(guildId);

    const cargoshipFieldName = getClient().intlGet(guildId, 'cargoship');
    const patrolHelicopterFieldName = getClient().intlGet(guildId, 'patrolHelicopter');
    const smallOilRigFieldName = getClient().intlGet(guildId, 'smallOilRig');
    const largeOilRigFieldName = getClient().intlGet(guildId, 'largeOilRig');
    const chinook47FieldName = getClient().intlGet(guildId, 'chinook47');
    const travelingVendorFieldName = getClient().intlGet(guildId, 'travelingVendor');

    const cargoShipMessage = rustplus.getCommandCargo(true);
    const patrolHelicopterMessage = rustplus.getCommandHeli(true);
    const smallOilMessage = rustplus.getCommandSmall(true);
    const largeOilMessage = rustplus.getCommandLarge(true);
    const ch47Message = rustplus.getCommandChinook(true);
    const travelingVendorMessage = rustplus.getCommandTravelingVendor(true);

    return getEmbed({
      title: getClient().intlGet(guildId, 'eventInfo'),
      color: Constants.COLOR_DEFAULT,
      thumbnail: 'attachment://event_info_logo.png',
      description: getClient().intlGet(guildId, 'inGameEventInfo'),
      footer: { text: instance.serverList[rustplus.serverId].title },
      fields: [
        { name: cargoshipFieldName, value: `\`${cargoShipMessage}\``, inline: true },
        { name: patrolHelicopterFieldName, value: `\`${patrolHelicopterMessage}\``, inline: true },
        { name: smallOilRigFieldName, value: `\`${smallOilMessage}\``, inline: true },
        { name: largeOilRigFieldName, value: `\`${largeOilMessage}\``, inline: true },
        { name: chinook47FieldName, value: `\`${ch47Message}\``, inline: true },
        { name: travelingVendorFieldName, value: `\`${travelingVendorMessage}\``, inline: true }
      ],
      timestamp: true
    });
  },

getUpdateTeamInformationEmbed: function (rustplus) {
  const guildId = rustplus.guildId;
  const instance = getClient().getInstance(guildId);
  const server = instance.serverList[rustplus.serverId];

  function formatShortSeconds(s) {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}


  // ---- Playtime state (per server) ----
  server.playtime = server.playtime || { totals: {}, onlineSince: {}, resetKey: null };

  // Reset on wipe by comparing map identity (seed/salt/size)
  const newKey = computeResetKey(rustplus);
  if (newKey && server.playtime.resetKey && server.playtime.resetKey !== newKey) {
    server.playtime.totals = {};
    server.playtime.onlineSince = {};
  }
  if (!server.playtime.resetKey || server.playtime.resetKey !== newKey) {
    server.playtime.resetKey = newKey || null;
  }

  const nowMs = Date.now();
  const totals = server.playtime.totals;
  const onlineSince = server.playtime.onlineSince;

  const title = getClient().intlGet(guildId, 'teamMemberInfo');
  const teamMemberFieldName = getClient().intlGet(guildId, 'teamMember');
  const statusFieldName = getClient().intlGet(guildId, 'status');
  const locationFieldName = getClient().intlGet(guildId, 'location');
  const footer = instance.serverList[rustplus.serverId].title;

  // (3 columns only)
  let totalCharacters =
    title.length + teamMemberFieldName.length + statusFieldName.length + locationFieldName.length + footer.length;

  let fieldIndex = 0;
  let teammateName = [''], teammateStatus = [''], teammateLocation = [''];
  let teammateNameCharacters = 0, teammateStatusCharacters = 0, teammateLocationCharacters = 0;

  for (const player of rustplus.team.players) {
    // Name column
    let name = player.name === ''
      ? '-'
      : `[${player.name}](${Constants.STEAM_PROFILES_URL}${player.steamId})`;
    name += (player.teamLeader) ? `${Constants.LEADER_EMOJI}\n` : '\n';

// Status column (session/offline stays here)
let status = '';
const steamId = String(player.steamId || '');
const isPaired = Object.keys(instance.serverListLite[rustplus.serverId]).includes(player.steamId);
const isOnline = !!player.isOnline;

// ensure playtime state entries exist
if (!(steamId in totals)) totals[steamId] = 0;
if (isOnline && !onlineSince[steamId]) {
  onlineSince[steamId] = nowMs; // session start
}
if (!isOnline && onlineSince[steamId]) {
  const delta = Math.max(0, Math.floor((nowMs - onlineSince[steamId]) / 1000));
  totals[steamId] += delta;
  delete onlineSince[steamId];
}

// emojis + session/afk/offline time
if (isOnline) {
  const isAfk = player.getAfkSeconds() >= Constants.AFK_TIME_SECONDS;
  const afkTime = player.getAfkTime('dhs'); // existing formatted AFK time

  status += (isAfk) ? Constants.AFK_EMOJI : Constants.ONLINE_EMOJI;
  status += (player.isAlive) ? ((isAfk) ? Constants.SLEEPING_EMOJI : Constants.ALIVE_EMOJI) : Constants.DEAD_EMOJI;
  status += isPaired ? Constants.PAIRED_EMOJI : '';

  // NEW: explicit online session timer
  let sessionSeconds = 0;
  if (onlineSince[steamId]) sessionSeconds = Math.max(0, Math.floor((nowMs - onlineSince[steamId]) / 1000));
  const sessionShort = formatShortSeconds(sessionSeconds);

  // Keep AFK time (if AFK) AND show session time distinctly
  // Examples:
  //  🟢💤 1h5m • ON: 2h40m
  //  🟢🙂 • ON: 35m
  if (isAfk) {
    status += ` ${afkTime} • ON: ${sessionShort}`;
  } else {
    status += ` • ON: ${sessionShort}`;
  }
} else {
  // offline branch (keep your original offline duration)
  const offlineTime = player.getOfflineTime('s'); // already formatted like "1h23m"
  status += Constants.OFFLINE_EMOJI;
  status += (player.isAlive) ? Constants.SLEEPING_EMOJI : Constants.DEAD_EMOJI;
  status += isPaired ? Constants.PAIRED_EMOJI : '';
  status += (offlineTime !== null) ? ` ${offlineTime}` : '';
}

// ---- Wipe TOTAL playtime (WT) appended at end of status line) ----
let shownSeconds = totals[steamId];
if (isOnline && onlineSince[steamId]) {
  shownSeconds += Math.max(0, Math.floor((nowMs - onlineSince[steamId]) / 1000));
}
const wipeTotalShort = formatPlaytimeShort(shownSeconds);

// ensure status ends with exactly one newline after appending WT
status = status.replace(/\n?$/, '');
status += ` • _T: ${wipeTotalShort}_\n`;
// Location column
    const location = (player.isOnline || player.isAlive) ? `${player.pos.string}\n` : '-\n';

    // Message-size guard
    if (totalCharacters + (name.length + status.length + location.length) >= Constants.EMBED_MAX_TOTAL_CHARACTERS) {
      break;
    }

    // Field-size guards (3 inline columns)
    if ((teammateNameCharacters + name.length) > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
        (teammateStatusCharacters + status.length) > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
        (teammateLocationCharacters + location.length) > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS) {

      fieldIndex += 1;
      teammateName.push('');
      teammateStatus.push('');
      teammateLocation.push('');

      teammateNameCharacters = 0;
      teammateStatusCharacters = 0;
      teammateLocationCharacters = 0;
    }

    teammateName[fieldIndex] += name;
    teammateStatus[fieldIndex] += status;
    teammateLocation[fieldIndex] += location;

    teammateNameCharacters += name.length;
    teammateStatusCharacters += status.length;
    teammateLocationCharacters += location.length;

    totalCharacters += name.length + status.length + location.length;
  }

  const fields = [];
  for (let i = 0; i < (fieldIndex + 1); i++) {
    fields.push({
      name: i === 0 ? teamMemberFieldName : '\u200B',
      value: teammateName[i] !== '' ? teammateName[i] : getClient().intlGet(guildId, 'empty'),
      inline: true
    });
    fields.push({
      name: i === 0 ? statusFieldName : '\u200B',
      value: teammateStatus[i] !== '' ? teammateStatus[i] : getClient().intlGet(guildId, 'empty'),
      inline: true
    });
    fields.push({
      name: i === 0 ? locationFieldName : '\u200B',
      value: teammateLocation[i] !== '' ? teammateLocation[i] : getClient().intlGet(guildId, 'empty'),
      inline: true
    });
  }

  // Persist playtime state
  getClient().setInstance(guildId, instance);

  // No thumbnail — we removed the attachment in send/edit too
  return getEmbed({
    title: title,
    color: Constants.COLOR_DEFAULT,
    footer: { text: footer },
    fields: fields,
    timestamp: true
  });
},



    getUpdateMarketWatchlistInformationEmbed: function (rustplus) {
    const instance = getClient().getInstance(rustplus.guildId);
    const watchItems = (instance.marketSubscriptionList && Array.isArray(instance.marketSubscriptionList.sell))
      ? instance.marketSubscriptionList.sell
      : [];

    const vmType = rustplus.mapMarkers.types.VendingMachine;
    // Prefer explicit markers if present, else fall back to the current snapshot container
    const vendingMachines = rustplus.mapMarkers.getMarkersOfType(
      vmType,
      rustplus.mapMarkers.vendingMachines ?? rustplus.mapMarkers.markers
    );

    const sections = [];

        // Convert world X/Y to Rust grid (A1..Z26)
    const mapSize =
      (rustplus.map && (rustplus.map.size || rustplus.map.width)) ||
      rustplus.mapSize ||
      4500; // safe fallback

    const cell = mapSize / 26;

    const toGrid = (x, y) => {
      const colIdx = Math.max(0, Math.min(25, Math.floor(x / cell)));
      const rowIdx = Math.max(0, Math.min(25, Math.floor((mapSize - y) / cell)));
      const colChar = String.fromCharCode(65 + colIdx); // 65 = 'A'
      return `${colChar}${rowIdx + 1}`;
    };


    for (const itemId of watchItems) {
      const itemName = getClient().items.getName(itemId);
      const listings = [];

      for (const vm of vendingMachines) {
        if (!vm.sellOrders) continue;

        for (const order of vm.sellOrders) {
          if (order.amountInStock === 0) continue;

          const orderItemId = String(order.itemId ?? '');
          if (orderItemId !== String(itemId)) continue;

          const currencyName = getClient().items.getName(String(order.currencyId ?? ''));
          const price = order.costPerItem;
          const qty = order.amountInStock;
          // Keep location simple and fast to read; avoids extra deps in this file
          const grid = toGrid(vm.x, vm.y);
          listings.push(`• (${grid})  ${qty} for ${price} ${currencyName}`);
        }
      }

      if (listings.length === 0) {
        sections.push(`**${itemName}** — _no active listings_`);
      } else {
        sections.push(`**${itemName}**\n${listings.join('\n')}`);
      }
    }

    const description =
      sections.length === 0
        ? '_Watchlist empty. Use `/market subscribe sell <name>` to add items._'
        : sections.join('\n\n');


return getEmbed({
  title: 'Market Watchlist',
  description,
  color: 16711680, // or Constants.COLOR_DEFAULT if that's your standard red
  footer: { text: `/market subscribe <buy/sell> <item>` },
  timestamp: true
});



  },


  getUpdateBattlemetricsOnlinePlayersInformationEmbed: function (rustplus, battlemetricsId) {
    const bmInstance = getClient().battlemetricsInstances[battlemetricsId];
    const guildId = rustplus.guildId;

    const playerIds = bmInstance.getOnlinePlayerIdsOrderedByTime();

    let totalCharacters = 0;
    let fieldCharacters = 0;

    const title = getClient().intlGet(guildId, 'battlemetricsOnlinePlayers');
    const footer = { text: bmInstance.server_name };

    totalCharacters += title.length;
    totalCharacters += bmInstance.server_name.length;
    totalCharacters += getClient().intlGet(guildId, 'andMorePlayers', { number: 100 }).length;
    totalCharacters += `${getClient().intlGet(guildId, 'players')}`.length;

    const fields = [''];
    let fieldIndex = 0;
    let isEmbedFull = false;
    let playerCounter = 0;
    for (const playerId of playerIds) {
      playerCounter += 1;

      const status = bmInstance.players[playerId]['status'];
      let time = status ? bmInstance.getOnlineTime(playerId) : bmInstance.getOfflineTime(playerId);
      time = time !== null ? time[1] : '';

      let playerStr = status ? Constants.ONLINE_EMOJI : Constants.OFFLINE_EMOJI;
      playerStr += ` [${time}] `;

      const nameMaxLength = Constants.EMBED_FIELD_MAX_WIDTH_LENGTH_3 - (3 + time.length);

      let name = bmInstance.players[playerId]['name'].replace('[', '(').replace(']', ')');
      name = name.length <= nameMaxLength ? name : name.substring(0, nameMaxLength - 2) + '..';

      playerStr += `[${name}](${Constants.BATTLEMETRICS_PROFILE_URL + `${playerId}`})\n`;

      if (totalCharacters + playerStr.length >= Constants.EMBED_MAX_TOTAL_CHARACTERS) {
        isEmbedFull = true;
        break;
      }

      if (fieldCharacters + playerStr.length >= Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS) {
        fieldCharacters = 0;
        fieldIndex += 1;
        fields.push('');
      }

      fields[fieldIndex] += playerStr;
      totalCharacters += playerStr.length;
      fieldCharacters += playerStr.length;
    }

    const embed = getEmbed({
      title: title,
      color: Constants.COLOR_DEFAULT,
      footer: footer,
      timestamp: true
    });

    if (isEmbedFull) {
      embed.setDescription(getClient().intlGet(guildId, 'andMorePlayers', {
        number: playerIds.length - playerCounter
      }));
    }

    let fieldCounter = 0;
    for (const field of fields) {
      embed.addFields({
        name: fieldCounter === 0 ? getClient().intlGet(guildId, 'players') : '\u200B',
        value: field === '' ? '\u200B' : field,
        inline: true
      });
      fieldCounter += 1;
    }

    return embed;
  },

  getDiscordCommandResponseEmbed: function (rustplus, response) {
    const instance = getClient().getInstance(rustplus.guildId);

    let string = '';
    if (Array.isArray(response)) {
      for (const str of response) {
        string += `${str}\n`;
      }
    } else {
      string = response;
    }

    return getEmbed({
      color: Constants.COLOR_DEFAULT,
      description: `**${string}**`,
      footer: { text: `${instance.serverList[rustplus.serverId].title}` }
    });
  },

  getCredentialsShowEmbed: async function (guildId) {
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    let names = '';
    let steamIds = '';
    let hoster = '';

    for (const credential in credentials) {
      if (credential === 'hoster') continue;

      const user = await DiscordTools.getUserById(guildId, credentials[credential].discord_user_id);
      names += `${user.user.username}\n`;
      steamIds += `${credential}\n`;
      hoster += `${credential === credentials.hoster ? `${Constants.LEADER_EMOJI}\n` : '\u200B\n'}`;
    }

    if (names === '') names = getClient().intlGet(guildId, 'empty');
    if (steamIds === '') steamIds = getClient().intlGet(guildId, 'empty');
    if (hoster === '') hoster = getClient().intlGet(guildId, 'empty');

    return getEmbed({
      color: Constants.COLOR_DEFAULT,
      title: getClient().intlGet(guildId, 'fcmCredentials'),
      fields: [
        { name: getClient().intlGet(guildId, 'name'), value: names, inline: true },
        { name: 'SteamID', value: steamIds, inline: true },
        { name: getClient().intlGet(guildId, 'hoster'), value: hoster, inline: true }
      ]
    });
  },

  getItemAvailableVendingMachineEmbed: function (guildId, serverId, str) {
    const instance = getClient().getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
      color: Constants.COLOR_DEFAULT,
      timestamp: true,
      footer: { text: server.title },
      author: { name: str }
    });
  },

  getUserSendEmbed: function (guildId, serverId, sender, str) {
    const instance = getClient().getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
      color: Constants.COLOR_DEFAULT,
      timestamp: true,
      footer: { text: server.title },
      description: `**${sender}**: ${str}`
    });
  },

  getHelpEmbed: function (guildId) {
    const repository = 'https://github.com/alexemanuelol/rustplusplus';
    const credentials = `${repository}/blob/master/docs/credentials.md`;
    const pairServer = `${repository}/blob/master/docs/pair_and_connect_to_server.md`;
    const commands = `${repository}/blob/master/docs/commands.md`;

    const description =
      `→ [${getClient().intlGet(guildId, 'commandsHelpHowToCredentials')}](${credentials})\n` +
      `→ [${getClient().intlGet(guildId, 'commandsHelpHowToPairServer')}](${pairServer})\n` +
      `→ [${getClient().intlGet(guildId, 'commandsHelpCommandList')}](${commands})`;

    return getEmbed({
      color: Constants.COLOR_DEFAULT,
      timestamp: true,
      title: `rustplusplus Help`,
      description: description
    });
  },

  getCctvEmbed: function (guildId, monument, cctvCodes, dynamic) {
    let code = '';
    for (const cctvCode of cctvCodes) code += `${cctvCode} \n`;
    if (dynamic) code += getClient().intlGet(guildId, 'asteriskCctvDesc');

    return getEmbed({
      color: Constants.COLOR_DEFAULT,
      timestamp: true,
      title: `${monument} CCTV ${getClient().intlGet(guildId, 'codes')}`,
      description: code
    });
  },

  getUptimeEmbed: function (guildId, uptime) {
    return getEmbed({
      color: Constants.COLOR_DEFAULT,
      timestamp: true,
      title: uptime
    });
  },

  getVoiceEmbed: function (guildId, state) {
    return getEmbed({
      color: Constants.COLOR_DEFAULT,
      timestamp: true,
      title: state
    });
  },

  getCraftEmbed: function (guildId, craftDetails, quantity) {
    let title = '';
    let description = '';

    if (quantity === 1) {
      title = `${craftDetails[1].name}`;
      description += `__**${getClient().intlGet(guildId, 'time')}:**__ ${craftDetails[2].timeString}`;
    } else {
      title = `${craftDetails[1].name} x${quantity}`;
      const time = Timer.secondsToFullScale(craftDetails[2].time * quantity, '', true);
      description += `__**${getClient().intlGet(guildId, 'time')}:**__ ${time}`;
    }

    let items = '', quantities = '';
    for (const item of craftDetails[2].ingredients) {
      const itemName = getClient().items.getName(item.id);
      items += `${itemName}\n`;
      quantities += `${item.quantity * quantity}\n`;
    }

    return getEmbed({
      title: title,
      description: description,
      color: Constants.COLOR_DEFAULT,
      timestamp: true,
      fields: [
        { name: getClient().intlGet(guildId, 'quantity'), value: items, inline: true },
        { name: getClient().intlGet(guildId, 'hoster'), value: quantities, inline: true }
      ]
    });
  },

  getResearchEmbed: function (guildId, researchDetails) {
    let typeString = '', scrapString = '';
    if (researchDetails[2].researchTable !== null) {
      typeString += `${getClient().intlGet(guildId, 'researchTable')}\n`;
      scrapString += `${researchDetails[2].researchTable}\n`;
    }
    if (researchDetails[2].workbench !== null) {
      typeString += `${getClient().items.getName(researchDetails[2].workbench.type)}\n`;
      const scrap = researchDetails[2].workbench.scrap;
      const totalScrap = researchDetails[2].workbench.totalScrap;
      scrapString += `${scrap} (${totalScrap})`;
    }

    return getEmbed({
      title: `${researchDetails[1].name}`,
      color: Constants.COLOR_DEFAULT,
      timestamp: true,
      fields: [
        { name: getClient().intlGet(guildId, 'type'), value: typeString, inline: true },
        { name: getClient().intlGet(guildId, 'scrap'), value: scrapString, inline: true }
      ]
    });
  },

  getRecycleEmbed: function (guildId, recycleDetails, quantity, recyclerType) {
    let title = quantity === 1 ? `${recycleDetails[1].name}` : `${recycleDetails[1].name} x${quantity}`;
    title += ` (${getClient().intlGet(guildId, recyclerType)})`;

    const recycleData = getClient().rustlabs.getRecycleDataFromArray([
      { itemId: recycleDetails[0], quantity: quantity, itemIsBlueprint: false }
    ]);

    let items0 = '', quantities0 = '';
    for (const item of recycleDetails[2][recyclerType]['yield']) {
      items0 += `${getClient().items.getName(item.id)}\n`;
      quantities0 += (item.probability !== 1) ? `${parseInt(item.probability * 100)}%\n` : `${item.quantity}\n`;
    }

    let items1 = '', quantities1 = '';
    for (const item of recycleData[recyclerType]) {
      items1 += `${getClient().items.getName(item.itemId)}\n`;
      quantities1 += `${item.quantity}\n`;
    }

    return getEmbed({
      title: title,
      color: Constants.COLOR_DEFAULT,
      timestamp: true,
      fields: [
        { name: getClient().intlGet(guildId, 'yield'), value: items0, inline: true },
        { name: '\u200B', value: quantities0, inline: true },
        { name: '\u200B', value: '\u200B', inline: false },
        { name: getClient().intlGet(guildId, 'calculated'), value: items1, inline: true },
        { name: '\u200B', value: quantities1, inline: true }
      ]
    });
  },

  getBattlemetricsEventEmbed: function (guildId, battlemetricsId, title, description, fields = null) {
    const instance = getClient().getInstance(guildId);
    const bmInstance = getClient().battlemetricsInstances[battlemetricsId];

    const serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;

    let thumbnail = '';
    if (instance.serverList.hasOwnProperty(serverId)) {
      thumbnail = instance.serverList[serverId].img;
    }
    const embed = getEmbed({
      title: title,
      color: Constants.COLOR_DEFAULT,
      timestamp: true,
      thumbnail: thumbnail,
      footer: { text: bmInstance.server_name }
    });

    if (fields !== null) embed.addFields(fields);
    if (description !== '') embed.setDescription(description);

    return embed;
  },

  getItemEmbed: function (guildId, itemName, itemId, type) {
    const title = `${itemName} (${itemId})`;

    const fields = [];
    const embed = getEmbed({
      title: title,
      color: Constants.COLOR_DEFAULT,
      timestamp: true
    });

    const decayDetails = type === 'items' ? getClient().rustlabs.getDecayDetailsById(itemId) :
      getClient().rustlabs.getDecayDetailsByName(itemId);
    if (decayDetails !== null) {
      const details = decayDetails[3];
      const hp = details.hpString;
      if (hp !== null) {
        fields.push({ name: getClient().intlGet(guildId, 'hp'), value: hp, inline: true });
      }

      let decayString = '';
      const decay = details.decayString;
      if (decay !== null) decayString += `${decay}\n`;

      const decayOutside = details.decayOutsideString;
      if (decayOutside !== null) decayString += `${getClient().intlGet(guildId, 'outside')}: ${decayOutside}\n`;

      const decayInside = details.decayInsideString;
      if (decayInside !== null) decayString += `${getClient().intlGet(guildId, 'inside')}: ${decayInside}\n`;

      const decayUnderwater = details.decayUnderwaterString;
      if (decayUnderwater !== null) decayString += `${getClient().intlGet(guildId, 'underwater')}: ${decayUnderwater}\n`;

      if (decayString !== '') {
        fields.push({ name: getClient().intlGet(guildId, 'decay'), value: decayString, inline: true });
      }
    }

    const despawnDetails = type === 'items' ? getClient().rustlabs.getDespawnDetailsById(itemId) : null;
    if (despawnDetails !== null) {
      const details = despawnDetails[2];
      fields.push({ name: getClient().intlGet(guildId, 'despawnTime'), value: details.timeString, inline: true });
    }

    const stackDetails = type === 'items' ? getClient().rustlabs.getStackDetailsById(itemId) : null;
    if (stackDetails !== null) {
      const details = stackDetails[2];
      fields.push({ name: getClient().intlGet(guildId, 'stackSize'), value: details.quantity, inline: true });
    }

    const upkeepDetails = type === 'items' ? getClient().rustlabs.getUpkeepDetailsById(itemId) :
      getClient().rustlabs.getUpkeepDetailsByName(itemId);
    if (upkeepDetails !== null) {
      const details = upkeepDetails[3];
      let upkeepString = '';
      for (const item of details) {
        const name = getClient().items.getName(item.id);
        const quantity = item.quantity;
        upkeepString += `${quantity} ${name}\n`;
      }
      fields.push({ name: getClient().intlGet(guildId, 'upkeep'), value: upkeepString, inline: true });
    }

    const craftDetails = type === 'items' ? getClient().rustlabs.getCraftDetailsById(itemId) : null;
    if (craftDetails !== null) {
      const details = craftDetails[2];
      let workbenchString = '';
      if (details.workbench !== null) {
        const workbenchShortname = getClient().items.getShortName(details.workbench);
        switch (workbenchShortname) {
          case 'workbench1': workbenchString = ' (T1)'; break;
          case 'workbench2': workbenchString = ' (T2)'; break;
          case 'workbench3': workbenchString = ' (T3)'; break;
        }
      }

      let craftString = '';
      for (const ingredient of details.ingredients) {
        const amount = `${ingredient.quantity}x`;
        const name = getClient().items.getName(ingredient.id);
        craftString += `${amount} ${name}\n`;
      }

      if (craftString !== '') {
        fields.push({
          name: getClient().intlGet(guildId, 'craft') + workbenchString,
          value: craftString,
          inline: true
        });
      }
    }

    const recycleDetails = type === 'items' ? getClient().rustlabs.getRecycleDetailsById(itemId) : null;
    if (recycleDetails !== null) {
      const details = recycleDetails[2]['recycler']['yield'];

      let recycleString = '';
      for (const recycleItem of details) {
        const name = getClient().items.getName(recycleItem.id);
        const quantityProbability = recycleItem.probability !== 1 ?
          `${parseInt(recycleItem.probability * 100)}%` :
          `${recycleItem.quantity}x`;
        recycleString += `${quantityProbability} ${name}\n`;
      }

      if (recycleString !== '') {
        fields.push({
          name: getClient().intlGet(guildId, 'recycle'),
          value: recycleString,
          inline: true
        });
      }
    }

    const researchDetails = type === 'items' ? getClient().rustlabs.getResearchDetailsById(itemId) : null;
    if (researchDetails !== null) {
      const details = researchDetails[2];
      let workbenchString = '';
      if (details.workbench !== null) {
        const workbenchShortname = getClient().items.getShortName(details.workbench.type);
        switch (workbenchShortname) {
          case 'workbench1': workbenchString = 'T1: '; break;
          case 'workbench2': workbenchString = 'T2: '; break;
          case 'workbench3': workbenchString = 'T3: '; break;
        }
        workbenchString += `${details.workbench.scrap} (${details.workbench.totalScrap})\n`;
      }

      let researchTableString = '';
      if (details.researchTable !== null) {
        researchTableString = `${getClient().intlGet(guildId, 'researchTable')}: ${details.researchTable}\n`;
      }

      const researchString = `${workbenchString}${researchTableString}`;
      if (researchString !== '') {
        fields.push({
          name: getClient().intlGet(guildId, 'research'),
          value: researchString,
          inline: true
        });
      }
    }

    if (fields.length !== 0) {
      embed.setFields(...fields);
    }

    return embed;
  }
};
