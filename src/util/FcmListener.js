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
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

const Battlemetrics   = require('../structures/Battlemetrics');
const Constants       = require('../util/constants.js');
const DiscordButtons  = require('../discordTools/discordButtons.js'); // kept for parity with original
const DiscordEmbeds   = require('../discordTools/discordEmbeds.js');
const DiscordMessages = require('../discordTools/discordMessages.js');
const DiscordTools    = require('../discordTools/discordTools.js');
const InstanceUtils   = require('../util/instanceUtils.js');
const Map             = require('../util/map.js');
const Scrape          = require('../util/scrape.js');

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Robust URL check (accept only http/https)
function isValidUrl(x) {
  if (typeof x !== 'string') return false;
  const s = x.trim();
  if (s === '') return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Safe Discord send so a bad payload never crashes the bot
async function safeDiscordSend(guildId, content, channelId) {
  try {
    await DiscordMessages.sendMessage(guildId, content, null, channelId);
    return true;
  } catch (err) {
    console.error('[FCM] DiscordMessages.sendMessage failed:', err?.message || err);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Main export                                                        */
/* ------------------------------------------------------------------ */

module.exports = async (client, guild) => {
  const credentials = InstanceUtils.readCredentialsFile(guild.id);
  const hoster = credentials.hoster;

  if (Object.keys(credentials).length === 1) {
    client.log(
      client.intlGet(null, 'warningCap'),
      client.intlGet(null, 'credentialsNotRegisteredForGuild', { id: guild.id })
    );
    return;
  }

  if (!hoster) {
    client.log(
      client.intlGet(null, 'warningCap'),
      client.intlGet(guild.id, 'credentialsHosterNotSetForGuild', { id: guild.id })
    );
    return;
  }

  // Ensure containers exist
  client.fcmListeners               = client.fcmListeners || {};
  client.fcmListenersLite           = client.fcmListenersLite || {};
  client.fcmListenersLite[guild.id] = client.fcmListenersLite[guild.id] || {};

  /* Destroy previous instance of fcm listeners (host + lite hoster) */
  if (client.fcmListeners[guild.id]) {
    try { client.fcmListeners[guild.id].destroy(); } catch {}
    delete client.fcmListeners[guild.id];
  }
  if (client.fcmListenersLite[guild.id]?.[hoster]) {
    try { client.fcmListenersLite[guild.id][hoster].destroy(); } catch {}
    delete client.fcmListenersLite[guild.id][hoster];
  }

  client.log(
    client.intlGet(null, 'infoCap'),
    client.intlGet(null, 'fcmListenerStartHost', { guildId: guild.id, steamId: hoster })
  );

  const discordUserId = credentials[hoster].discord_user_id;
  const androidId     = credentials[hoster].gcm.android_id;
  const securityToken = credentials[hoster].gcm.security_token;

  client.fcmListeners[guild.id] = new PushReceiverClient(androidId, securityToken, []);

  client.fcmListeners[guild.id].on('ON_DATA_RECEIVED', (data) => {
    try {
      const appData = data?.appData;
      if (!appData) {
        client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, appData could not be found.`);
        return;
      }

      const title     = appData.find(item => item.key === 'title')?.value ?? '';
      const message   = appData.find(item => item.key === 'message')?.value ?? '';
      const channelId = appData.find(item => item.key === 'channelId')?.value ?? '';

      if (!channelId) {
        client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, channelId could not be found.`);
        return;
      }

      const bodyStr = appData.find(item => item.key === 'body')?.value;
      if (!bodyStr) {
        client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, body could not be found.`);
        return;
      }

      let body;
      try {
        body = JSON.parse(bodyStr);
      } catch (e) {
        client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, body JSON parse failed: ${e.message}`);
        return;
      }

      // Some 'alarm' pushes may lack type (e.g. external raid-alarm); others should have it.
      if (!body.type && channelId !== 'alarm') {
        client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, body type could not be found.`);
        return;
      }

      switch (channelId) {
        case 'pairing': {
          switch (body.type) {
            case 'server': {
              client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, pairing: server`);
              pairingServer(client, guild, title, message, body);
              break;
            }
            case 'entity': {
              switch (body.entityName) {
                case 'Smart Switch': {
                  client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, pairing: entity: Switch`);
                  pairingEntitySwitch(client, guild, title, message, body);
                  break;
                }
                case 'Smart Alarm': {
                  client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, pairing: entity: Smart Alarm`);
                  pairingEntitySmartAlarm(client, guild, title, message, body);
                  break;
                }
                case 'Storage Monitor': {
                  client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, pairing: entity: Storage Monitor`);
                  pairingEntityStorageMonitor(client, guild, title, message, body);
                  break;
                }
                default: {
                  client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, pairing: entity: other\n${JSON.stringify(data)}`);
                  break;
                }
              }
              break;
            }
            default: {
              client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, pairing: other\n${JSON.stringify(data)}`);
              break;
            }
          }
          break;
        }

        case 'alarm': {
          switch (body.type) {
            case 'alarm': {
              client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, alarm: alarm`);
              alarmAlarm(client, guild, title, message, body);
              break;
            }
            default: {
              if (title === "You're getting raided!") {
                // custom alarm from uMod raid-alarm plugin
                client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, alarm: raid-alarm plugin`);
                alarmRaidAlarm(client, guild, title, message, body);
                break;
              }
              client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, alarm: other\n${JSON.stringify(data)}`);
              break;
            }
          }
          break;
        }

        case 'player': {
          switch (body.type) {
            case 'death': {
              client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, player: death`);
              playerDeath(client, guild, title, message, body, discordUserId);
              break;
            }
            default: {
              client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, player: other\n${JSON.stringify(data)}`);
              break;
            }
          }
          break;
        }

        case 'team': {
          switch (body.type) {
            case 'login': {
              client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, team: login`);
              teamLogin(client, guild, title, message, body);
              break;
            }
            default: {
              client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, team: other\n${JSON.stringify(data)}`);
              break;
            }
          }
          break;
        }

        // case 'news': { ... } // unchanged / commented in original

        default: {
          client.log('FCM Host', `GuildID: ${guild.id}, SteamID: ${hoster}, other\n${JSON.stringify(data)}`);
          break;
        }
      }
    } catch (e) {
      client.log('WARN', `FCM Host: onDataMessage error: ${e.message}`);
    }
  });

  // Connect after handlers are attached
  client.fcmListeners[guild.id].connect();
};

/* ------------------------------------------------------------------ */
/* Pairing handlers                                                   */
/* ------------------------------------------------------------------ */

async function pairingServer(client, guild, title, message, body) {
  const instance = client.getInstance(guild.id);
  const serverId = `${body.ip}-${body.port}`;
  const server = instance.serverList[serverId];

  let messageObj = undefined;
  if (server) {
    try {
      messageObj = await DiscordTools.getMessageById(guild.id, instance.channelId.servers, server.messageId);
    } catch {}
  }

  let battlemetricsId = null;
  const bmInstance = new Battlemetrics(null, title);
  await bmInstance.setup();
  if (bmInstance.lastUpdateSuccessful) {
    battlemetricsId = bmInstance.id;
    if (!client.battlemetricsInstances.hasOwnProperty(bmInstance.id)) {
      client.battlemetricsInstances[bmInstance.id] = bmInstance;
    }
  }

  instance.serverList[serverId] = {
    title: title,
    serverIp: body.ip,
    appPort: body.port,
    steamId: body.playerId,
    playerToken: body.playerToken,
    description: (body.desc || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t'),
    img: isValidUrl(body.img) ? body.img.replace(/ /g, '%20') : Constants.DEFAULT_SERVER_IMG,
    url: isValidUrl(body.url) ? body.url.replace(/ /g, '%20') : Constants.DEFAULT_SERVER_URL,
    notes: server ? server.notes : {},
    switches: server ? server.switches : {},
    alarms: server ? server.alarms : {},
    storageMonitors: server ? server.storageMonitors : {},
    markers: server ? server.markers : {},
    switchGroups: server ? server.switchGroups : {},
    messageId: (messageObj !== undefined) ? messageObj.id : null,
    battlemetricsId: battlemetricsId,
    connect: (!bmInstance.lastUpdateSuccessful) ? null :
      `connect ${bmInstance.server_ip}:${bmInstance.server_port}`,
    cargoShipEgressTimeMs: server ? server.cargoShipEgressTimeMs : Constants.DEFAULT_CARGO_SHIP_EGRESS_TIME_MS,
    oilRigLockedCrateUnlockTimeMs: server ? server.oilRigLockedCrateUnlockTimeMs : Constants.DEFAULT_OIL_RIG_LOCKED_CRATE_UNLOCK_TIME_MS,
    timeTillDay: server ? server.timeTillDay : null,
    timeTillNight: server ? server.timeTillNight : null
  };

  if (!instance.serverListLite.hasOwnProperty(serverId)) instance.serverListLite[serverId] = {};

  instance.serverListLite[serverId][body.playerId] = {
    serverIp: body.ip,
    appPort: body.port,
    steamId: body.playerId,
    playerToken: body.playerToken
  };
  client.setInstance(guild.id, instance);

  try {
    await DiscordMessages.sendServerMessage(guild.id, serverId, null);
  } catch (err) {
    console.error('[FCM] sendServerMessage failed:', err?.message || err);
  }
}

async function pairingEntitySwitch(client, guild, title, message, body) {
  const instance = client.getInstance(guild.id);
  const serverId = `${body.ip}-${body.port}`;
  if (!instance.serverList.hasOwnProperty(serverId)) return;
  const switches = instance.serverList[serverId].switches;

  const entityExist = switches.hasOwnProperty(body.entityId);
  instance.serverList[serverId].switches[body.entityId] = {
    active:     entityExist ? switches[body.entityId].active     : false,
    reachable:  entityExist ? switches[body.entityId].reachable  : true,
    name:       entityExist ? switches[body.entityId].name       : client.intlGet(guild.id, 'smartSwitch'),
    command:    entityExist ? switches[body.entityId].command    : body.entityId,
    image:      entityExist ? switches[body.entityId].image      : 'smart_switch.png',
    autoDayNightOnOff: entityExist ? switches[body.entityId].autoDayNightOnOff : 0,
    location:   entityExist ? switches[body.entityId].location   : null,
    x:          entityExist ? switches[body.entityId].x          : null,
    y:          entityExist ? switches[body.entityId].y          : null,
    server:     entityExist ? switches[body.entityId].server     : body.name,
    proximity:  entityExist ? switches[body.entityId].proximity  : Constants.PROXIMITY_SETTING_DEFAULT_METERS,
    messageId:  entityExist ? switches[body.entityId].messageId  : null
  };
  client.setInstance(guild.id, instance);

  const rustplus = client.rustplusInstances[guild.id];
  if (rustplus && serverId === rustplus.serverId) {
    try {
      const info = await rustplus.getEntityInfoAsync(body.entityId);
      // Treat responses that are invalid or missing payload as unreachable.
      if (!(await rustplus.isResponseValid(info)) || !info?.entityInfo?.payload) {
        instance.serverList[serverId].switches[body.entityId].reachable = false;
        if (!info?.entityInfo?.payload) {
          rustplus.log(client.intlGet(null, 'warningCap'),
            client.intlGet(null, 'responseMissingPayload', { id: body.entityId }));
        }
      }

      const teamInfo = await rustplus.getTeamInfoAsync();
      if (await rustplus.isResponseValid(teamInfo)) {
        const player = teamInfo.teamInfo.members.find(e => e.steamId.toString() === rustplus.playerId);
        if (player) {
          const location = Map.getPos(player.x, player.y, rustplus.info.correctedMapSize, rustplus);
          instance.serverList[serverId].switches[body.entityId].location = location.location;
          instance.serverList[serverId].switches[body.entityId].x = location.x;
          instance.serverList[serverId].switches[body.entityId].y = location.y;
        }
      }

      if (instance.serverList[serverId].switches[body.entityId].reachable && info?.entityInfo?.payload) {
        instance.serverList[serverId].switches[body.entityId].active = info.entityInfo.payload.value;
      }
      client.setInstance(guild.id, instance);

      try {
        await DiscordMessages.sendSmartSwitchMessage(guild.id, serverId, body.entityId);
      } catch (err) {
        console.error('[FCM] sendSmartSwitchMessage failed:', err?.message || err);
      }
    } catch (err) {
      console.error('[FCM] pairingEntitySwitch rustplus interaction failed:', err?.message || err);
    }
  }
}

async function pairingEntitySmartAlarm(client, guild, title, message, body) {
  const instance = client.getInstance(guild.id);
  const serverId = `${body.ip}-${body.port}`;
  if (!instance.serverList.hasOwnProperty(serverId)) return;
  const alarms = instance.serverList[serverId].alarms;

  const entityExist = alarms.hasOwnProperty(body.entityId);
  instance.serverList[serverId].alarms[body.entityId] = {
    active:      entityExist ? alarms[body.entityId].active      : false,
    reachable:   entityExist ? alarms[body.entityId].reachable   : true,
    everyone:    entityExist ? alarms[body.entityId].everyone    : false,
    name:        entityExist ? alarms[body.entityId].name        : client.intlGet(guild.id, 'smartAlarm'),
    message:     entityExist ? alarms[body.entityId].message     : client.intlGet(guild.id, 'baseIsUnderAttack'),
    lastTrigger: entityExist ? alarms[body.entityId].lastTrigger : null,
    command:     entityExist ? alarms[body.entityId].command     : body.entityId,
    id:          entityExist ? alarms[body.entityId].id          : body.entityId,
    image:       entityExist ? alarms[body.entityId].image       : 'smart_alarm.png',
    location:    entityExist ? alarms[body.entityId].location    : null,
    server:      entityExist ? alarms[body.entityId].server      : body.name,
    messageId:   entityExist ? alarms[body.entityId].messageId   : null,
    // ensure these exist; default ON unless explicitly disabled elsewhere
    notify:      entityExist ? alarms[body.entityId].notify      : true,
    inGame:      entityExist ? alarms[body.entityId].inGame      : true
  };
  client.setInstance(guild.id, instance);

  const rustplus = client.rustplusInstances[guild.id];
  if (rustplus && serverId === rustplus.serverId) {
    try {
      const info = await rustplus.getEntityInfoAsync(body.entityId);
      // Treat responses that are invalid or missing payload as unreachable.
      if (!(await rustplus.isResponseValid(info)) || !info?.entityInfo?.payload) {
        instance.serverList[serverId].alarms[body.entityId].reachable = false;
        if (!info?.entityInfo?.payload) {
          rustplus.log(client.intlGet(null, 'warningCap'),
            client.intlGet(null, 'responseMissingPayload', { id: body.entityId }));
        }
      }

      const teamInfo = await rustplus.getTeamInfoAsync();
      if (await rustplus.isResponseValid(teamInfo)) {
        const player = teamInfo.teamInfo.members.find(e => e.steamId.toString() === rustplus.playerId);
        if (player) {
          const location = Map.getPos(player.x, player.y, rustplus.info.correctedMapSize, rustplus);
          instance.serverList[serverId].alarms[body.entityId].location = location.location;
        }
      }

      if (instance.serverList[serverId].alarms[body.entityId].reachable && info?.entityInfo?.payload) {
        instance.serverList[serverId].alarms[body.entityId].active = info.entityInfo.payload.value;
      }
      client.setInstance(guild.id, instance);
    } catch (err) {
      console.error('[FCM] pairingEntitySmartAlarm rustplus interaction failed:', err?.message || err);
    }
  }

  try {
    await DiscordMessages.sendSmartAlarmMessage(guild.id, serverId, body.entityId);
  } catch (err) {
    console.error('[FCM] sendSmartAlarmMessage failed:', err?.message || err);
  }
}

async function pairingEntityStorageMonitor(client, guild, title, message, body) {
  const instance = client.getInstance(guild.id);
  const serverId = `${body.ip}-${body.port}`;
  if (!instance.serverList.hasOwnProperty(serverId)) return;
  const storageMonitors = instance.serverList[serverId].storageMonitors;

  const entityExist = storageMonitors.hasOwnProperty(body.entityId);
  instance.serverList[serverId].storageMonitors[body.entityId] = {
    name:       entityExist ? storageMonitors[body.entityId].name       : client.intlGet(guild.id, 'storageMonitor'),
    reachable:  entityExist ? storageMonitors[body.entityId].reachable  : true,
    id:         entityExist ? storageMonitors[body.entityId].id         : body.entityId,
    type:       entityExist ? storageMonitors[body.entityId].type       : null,
    decaying:   entityExist ? storageMonitors[body.entityId].decaying   : false,
    upkeep:     entityExist ? storageMonitors[body.entityId].upkeep     : null,
    everyone:   entityExist ? storageMonitors[body.entityId].everyone   : false,
    inGame:     entityExist ? storageMonitors[body.entityId].inGame     : true,
    image:      entityExist ? storageMonitors[body.entityId].image      : 'storage_monitor.png',
    location:   entityExist ? storageMonitors[body.entityId].location   : null,
    server:     entityExist ? storageMonitors[body.entityId].server     : body.name,
    messageId:  entityExist ? storageMonitors[body.entityId].messageId  : null
  };
  client.setInstance(guild.id, instance);

  const rustplus = client.rustplusInstances[guild.id];
  if (rustplus && serverId === rustplus.serverId) {
    try {
      const info = await rustplus.getEntityInfoAsync(body.entityId);
      // Treat responses that are invalid or missing payload as unreachable.
      if (!(await rustplus.isResponseValid(info)) || !info?.entityInfo?.payload) {
        instance.serverList[serverId].storageMonitors[body.entityId].reachable = false;
        if (!info?.entityInfo?.payload) {
          rustplus.log(client.intlGet(null, 'warningCap'),
            client.intlGet(null, 'responseMissingPayload', { id: body.entityId }));
        }
      }

      const teamInfo = await rustplus.getTeamInfoAsync();
      if (await rustplus.isResponseValid(teamInfo)) {
        const player = teamInfo.teamInfo.members.find(e => e.steamId.toString() === rustplus.playerId);
        if (player) {
          const location = Map.getPos(player.x, player.y, rustplus.info.correctedMapSize, rustplus);
          instance.serverList[serverId].storageMonitors[body.entityId].location = location.location;
        }
      }

      if (instance.serverList[serverId].storageMonitors[body.entityId].reachable && info?.entityInfo?.payload) {
        if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_TOOL_CUPBOARD_CAPACITY) {
          instance.serverList[serverId].storageMonitors[body.entityId].type  = 'toolCupboard';
          instance.serverList[serverId].storageMonitors[body.entityId].image = 'tool_cupboard.png';
          if (info.entityInfo.payload.protectionExpiry === 0) {
            instance.serverList[serverId].storageMonitors[body.entityId].decaying = true;
          }
        }
        else if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_VENDING_MACHINE_CAPACITY) {
          instance.serverList[serverId].storageMonitors[body.entityId].type  = 'vendingMachine';
          instance.serverList[serverId].storageMonitors[body.entityId].image = 'vending_machine.png';
        }
        else if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_LARGE_WOOD_BOX_CAPACITY) {
          instance.serverList[serverId].storageMonitors[body.entityId].type  = 'largeWoodBox';
          instance.serverList[serverId].storageMonitors[body.entityId].image = 'large_wood_box.png';
        }

        // cache live payload for messages
        rustplus.storageMonitors[body.entityId] = {
          items:         info.entityInfo.payload.items,
          expiry:        info.entityInfo.payload.protectionExpiry,
          capacity:      info.entityInfo.payload.capacity,
          hasProtection: info.entityInfo.payload.hasProtection
        };
      }
      client.setInstance(guild.id, instance);

      try {
        await DiscordMessages.sendStorageMonitorMessage(guild.id, serverId, body.entityId);
      } catch (err) {
        console.error('[FCM] sendStorageMonitorMessage failed:', err?.message || err);
      }
    } catch (err) {
      console.error('[FCM] pairingEntityStorageMonitor rustplus interaction failed:', err?.message || err);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Alarm handlers                                                     */
/* ------------------------------------------------------------------ */

// Smart Alarm from FCM (used when not connected to this server via rustplus)
async function alarmAlarm(client, guild, title, message, body) {
  // See original comment: FCM alarm is unreliable; only notify when not connected to this server.
  const instance = client.getInstance(guild.id);
  const serverId = `${body.ip}-${body.port}`;
  const entityId = body.entityId;
  const server   = instance.serverList[serverId];
  const rustplus = client.rustplusInstances[guild.id];
  // Debug: log gating info to help find why alarms don't reach Discord
  try {
    client.log('DEBUG', `FCM Host alarm: guild=${guild.id} serverId=${serverId} entityId=${entityId}`);
    client.log('DEBUG', `FCM Host alarm: serverExists=${!!server} alarmsExist=${!!(server && server.alarms)} alarmExists=${!!(server && server.alarms && server.alarms[entityId])}`);
    client.log('DEBUG', `FCM Host alarm: fcmAlarmNotificationEnabled=${!!(instance && instance.generalSettings && instance.generalSettings.fcmAlarmNotificationEnabled)}`);
    client.log('DEBUG', `FCM Host alarm: rustplusConnected=${!!rustplus} rustplusServerId=${rustplus ? rustplus.serverId : 'N/A'}`);
  } catch (e) {
    client.log('DEBUG', 'FCM Host alarm: debug stringify failed');
  }

  if (!server || !server.alarms || !server.alarms[entityId]) {
    client.log('DEBUG', `FCM Host alarm: early return - server/alarm not found (serverExists=${!!server})`);
    return;
  }

  const alarm = server.alarms[entityId];

  const notConnectedToThisServer = (!rustplus || rustplus.serverId !== serverId);
  if (notConnectedToThisServer && instance.generalSettings.fcmAlarmNotificationEnabled) {
    // Record trigger time
    alarm.lastTrigger = Math.floor(Date.now() / 1000);
    client.setInstance(guild.id, instance);

    // Post to Discord only if this alarm's notifications are ON
    client.log('DEBUG', `FCM Host alarm: alarm.notify=${alarm.notify}`);
    if (alarm.notify !== false) {
      try {
        await DiscordMessages.sendSmartAlarmTriggerMessage(guild.id, serverId, entityId);
        client.log('DEBUG', `FCM Host alarm: sendSmartAlarmTriggerMessage invoked for entity ${entityId}`);
      } catch (err) {
        console.error('[FCM] sendSmartAlarmTriggerMessage failed:', err?.message || err);
        client.log('DEBUG', `FCM Host alarm: send failed: ${err?.message || err}`);
      }
    } else {
      client.log('DEBUG', `FCM Host alarm: notifications disabled for entity ${entityId}`);
    }

    client.log(client.intlGet(null, 'infoCap'), `${title}: ${message}`);
  } else {
    client.log('DEBUG', `FCM Host alarm: not sending - either connected to server or fcm disabled`);
  }
}

// Custom raid alarm (uMod plugin) – send both to Discord and, if connected, in-game
async function alarmRaidAlarm(client, guild, title, message, body) {
  const instance = client.getInstance(guild.id);
  const serverId = `${body.ip}-${body.port}`;
  const rustplus = client.rustplusInstances[guild.id];

  if (!instance.serverList.hasOwnProperty(serverId)) return;

  const files = [];
  if (!isValidUrl(body.img || '')) {
    files.push(new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/rocket.png')));
  }

  const content = {
    embeds: [DiscordEmbeds.getAlarmRaidAlarmEmbed({ title, message }, body)],
    content: '@everyone',
    files
  };

  // Always notify Discord activity channel
  await safeDiscordSend(guild.id, content, instance.channelId.activity);

  // In-game notification only if connected to that server
  if (rustplus && serverId === rustplus.serverId) {
    try {
      await rustplus.sendInGameMessage(`${title}: ${message}`);
    } catch (e) {
      console.warn('[FCM] in-game message (raid) failed:', e?.message || e);
    }
  }

  client.log(client.intlGet(null, 'infoCap'), `${title} ${message}`);
}

/* ------------------------------------------------------------------ */
/* Other handlers                                                     */
/* ------------------------------------------------------------------ */

async function playerDeath(client, guild, title, message, body, discordUserId) {
  const user = await DiscordTools.getUserById(guild.id, discordUserId);

  let png = null;
  try {
    if (body.targetId) {
      png = await Scrape.scrapeSteamProfilePicture(client, body.targetId);
    }
  } catch {}
  if (!png) png = isValidUrl(body.img) ? body.img : Constants.DEFAULT_SERVER_IMG;

  const content = {
    embeds: [DiscordEmbeds.getPlayerDeathEmbed({ title }, body, png)]
  };

  if (user) {
    try {
      await client.messageSend(user, content);
    } catch (err) {
      console.error('[FCM] messageSend (playerDeath) failed:', err?.message || err);
    }
  }
}

async function teamLogin(client, guild, title, message, body) {
  const instance = client.getInstance(guild.id);

  let avatar = null;
  try {
    avatar = await Scrape.scrapeSteamProfilePicture(client, body.targetId);
  } catch {}

  const content = {
    embeds: [DiscordEmbeds.getTeamLoginEmbed(guild.id, body, avatar)]
  };

  const rustplus = client.rustplusInstances[guild.id];
  const serverId = `${body.ip}-${body.port}`;

  if (!rustplus || (rustplus && (serverId !== rustplus.serverId))) {
    await safeDiscordSend(guild.id, content, instance.channelId.activity);
    client.log(
      client.intlGet(null, 'infoCap'),
      client.intlGet(null, 'playerJustConnectedTo', { name: body.targetName, server: body.name })
    );
  }
}

// async function newsNews(client, guild, full, data, body) {
//   const instance = client.getInstance(guild.id);
//   const content = {
//     embeds: [DiscordEmbeds.getNewsEmbed(guild.id, data)],
//     components: [DiscordButtons.getNewsButton(guild.id, body, isValidUrl(body.url))]
//   };
//   await DiscordMessages.sendMessage(guild.id, content, null, instance.channelId.activity);
// }
