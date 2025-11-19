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

const { updateMainResourcesComps } = require('./MainResourcesCompsBox');
const Discord = require('discord.js');
const Path = require('path');
const fs = require('fs');

const Constants = require('../util/constants.js');
const getClient = require('../util/getClient');
const DiscordButtons = require('./discordButtons.js');
const DiscordEmbeds = require('./discordEmbeds.js');
const DiscordSelectMenus = require('./discordSelectMenus.js');
const DiscordTools = require('./discordTools.js');
const Scrape = require('../util/scrape.js');

module.exports = {
  // Safer send: edits when possible; if the target message no longer exists,
  // silently sends a new one and returns it.
  sendMessage: async function (guildId, content, messageId, channelId, interaction = null) {
    const client = getClient();

    // If responding to an interaction, use the wrappers and return early.
    if (interaction) {
      try {
        // Let your helper decide whether to reply or editReply.
        return await client.interactionUpdate(interaction, content);
      } catch (e) {
        client.log('ERROR', `sendMessage(interaction) failed: ${e.message}`);
        return null;
      }
    }

    // Resolve the channel
    const channel =
      DiscordTools.getTextChannelById(guildId, channelId) ||
      (await client.channels.fetch?.(channelId).catch(() => null));

    if (!channel) {
      client.log(
        client.intlGet(null, 'errorCap'),
        client.intlGet(null, 'couldNotGetChannelWithId', { id: channelId }),
        'error'
      );
      return null;
    }

    // Try to fetch existing message if we have an ID
    let existing = null;
    if (messageId !== null && messageId !== undefined) {
      try {
        existing =
          (await DiscordTools.getMessageById(guildId, channelId, messageId)) ||
          (await channel.messages?.fetch?.(messageId).catch(() => null));
      } catch {
        existing = null;
      }
    }

    // If we have the message, try to edit it; on Unknown Message, fall back to send
    if (existing) {
      try {
        if (typeof client.messageEdit === 'function') {
          if (client.messageEdit.length >= 3) {
            return await client.messageEdit(channelId, existing.id, content);
          } else {
            return await client.messageEdit(existing, content);
          }
        }
        // direct edit as fallback
        return await existing.edit(content);
      } catch (e) {
        // 10008 = Unknown Message (deleted) → fall through to send new
        if (e && e.code === 10008) {
          client.log('WARN', `sendMessage: stale messageId ${messageId}, sending new`);
        } else {
          // Log detailed info to help diagnose failures (permissions, missing access, rate limit, etc.)
          try {
            client.log('ERROR', `sendMessage: edit failed guild=${guildId} channel=${channelId} messageId=${messageId} code=${e?.code ?? 'n/a'} httpStatus=${e?.httpStatus ?? 'n/a'} msg=${e?.message ?? e}`);
          } catch (_) {
            console.error('[discordMessages] sendMessage: edit failed', e);
          }
        }
      }
    }

    // Send a new message
    try {
      return await client.messageSend(channel, content);
    } catch (e) {
      // Detect common permission/missing access errors and log more context
      const code = e?.code ?? 'n/a';
      const httpStatus = e?.httpStatus ?? 'n/a';
      if (code === 50013 || code === 50001) {
        // 50013 = Missing Permissions, 50001 = Missing Access
        client.log('WARN', `sendMessage: missing permission/access guild=${guildId} channel=${channelId} code=${code} httpStatus=${httpStatus} msg=${e?.message ?? e}`);
      } else {
        client.log('ERROR', `sendMessage: send failed guild=${guildId} channel=${channelId} code=${code} httpStatus=${httpStatus} msg=${e?.message ?? e}`);
      }
      // Also output to console for immediate logs
      try { console.error('[discordMessages] sendMessage: send failed', { guildId, channelId, code, httpStatus, message: e?.message ?? e }); } catch (_) {}
      return null;
    }
  },

  sendServerMessage: async function (guildId, serverId, state = null, interaction = null) {
    const instance = getClient().getInstance(guildId);
    const server = instance.serverList[serverId];

    const content = {
      embeds: [await DiscordEmbeds.getServerEmbed(guildId, serverId)],
      components: DiscordButtons.getServerButtons(guildId, serverId, state)
    };

    const message = await module.exports.sendMessage(
      guildId,
      content,
      server.messageId,
      instance.channelId.servers,
      interaction
    );

    if (!interaction && message && message.id) {
      instance.serverList[serverId].messageId = message.id;
      getClient().setInstance(guildId, instance);
    } else if (!message && !interaction) {
      // clear stale id so we recover next time
      instance.serverList[serverId].messageId = undefined;
      getClient().setInstance(guildId, instance);
    }
  },

  sendTrackerMessage: async function (guildId, trackerId, interaction = null) {
    const instance = getClient().getInstance(guildId);
    const tracker = instance.trackers[trackerId];

    const content = {
      embeds: [DiscordEmbeds.getTrackerEmbed(guildId, trackerId)],
      components: DiscordButtons.getTrackerButtons(guildId, trackerId)
    };

    const message = await module.exports.sendMessage(
      guildId,
      content,
      tracker.messageId,
      instance.channelId.trackers,
      interaction
    );

    if (!interaction && message && message.id) {
      instance.trackers[trackerId].messageId = message.id;
      getClient().setInstance(guildId, instance);
    } else if (!message && !interaction) {
      instance.trackers[trackerId].messageId = undefined;
      getClient().setInstance(guildId, instance);
    }
  },

  sendSmartSwitchMessage: async function (guildId, serverId, entityId, interaction = null) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].switches[entityId];

    const content = {
      embeds: [
        entity.reachable
          ? DiscordEmbeds.getSmartSwitchEmbed(guildId, serverId, entityId)
          : DiscordEmbeds.getNotFoundSmartDeviceEmbed(guildId, serverId, entityId, 'switches')
      ],
      components: [
        DiscordSelectMenus.getSmartSwitchSelectMenu(guildId, serverId, entityId),
        DiscordButtons.getSmartSwitchButtons(guildId, serverId, entityId)
      ],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`)
        )
      ]
    };

    const message = await module.exports.sendMessage(
      guildId,
      content,
      entity.messageId,
      instance.channelId.switches,
      interaction
    );

    if (!interaction && message && message.id) {
      instance.serverList[serverId].switches[entityId].messageId = message.id;
      getClient().setInstance(guildId, instance);
    } else if (!message && !interaction) {
      instance.serverList[serverId].switches[entityId].messageId = undefined;
      getClient().setInstance(guildId, instance);
    }
  },

  sendSmartAlarmMessage: async function (guildId, serverId, entityId, interaction = null) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];

    const content = {
      embeds: [
        entity.reachable
          ? DiscordEmbeds.getSmartAlarmEmbed(guildId, serverId, entityId)
          : DiscordEmbeds.getNotFoundSmartDeviceEmbed(guildId, serverId, entityId, 'alarms')
      ],
      components: [DiscordButtons.getSmartAlarmButtons(guildId, serverId, entityId)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`)
        )
      ]
    };

    const message = await module.exports.sendMessage(
      guildId,
      content,
      entity.messageId,
      instance.channelId.alarms,
      interaction
    );

    if (!interaction && message && message.id) {
      instance.serverList[serverId].alarms[entityId].messageId = message.id;
      getClient().setInstance(guildId, instance);
    } else if (!message && !interaction) {
      instance.serverList[serverId].alarms[entityId].messageId = undefined;
      getClient().setInstance(guildId, instance);
    }
  },

  sendStorageMonitorMessage: async function (guildId, serverId, entityId, interaction = null) {
    let instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];

    // Normalize & validate the image file FIRST
    let img = entity.image || 'storage_monitor.png';
    if (!img.toLowerCase().endsWith('.png')) img = `${img}.png`;
    const imgPath = Path.join(__dirname, '..', `resources/images/electrics/${img}`);
    if (!fs.existsSync(imgPath)) {
      img = 'storage_monitor.png';
    }
    if (entity.image !== img) {
      instance.serverList[serverId].storageMonitors[entityId].image = img;
      getClient().setInstance(guildId, instance);
    }

    const content = {
      embeds: [
        entity.reachable
          ? DiscordEmbeds.getStorageMonitorEmbed(guildId, serverId, entityId)
          : DiscordEmbeds.getNotFoundSmartDeviceEmbed(guildId, serverId, entityId, 'storageMonitors')
      ],
      components: [
        entity.type === 'toolCupboard'
          ? DiscordButtons.getStorageMonitorToolCupboardButtons(guildId, serverId, entityId)
          : DiscordButtons.getStorageMonitorContainerButton(guildId, serverId, entityId)
      ],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/electrics/${img}`)
        )
      ]
    };

    // (re)read instance in case another path updated it
    instance = getClient().getInstance(guildId);

    const message = await module.exports.sendMessage(
      guildId,
      content,
      entity.messageId,
      instance.channelId.storageMonitors,
      interaction
    );

    if (!interaction && message && message.id) {
      instance.serverList[serverId].storageMonitors[entityId].messageId = message.id;
      getClient().setInstance(guildId, instance);
    } else if (!message && !interaction) {
      instance.serverList[serverId].storageMonitors[entityId].messageId = undefined;
      getClient().setInstance(guildId, instance);
    }

    // 🔄 Update the “Main Resources & Comps” box
    try {
      await updateMainResourcesComps(guildId, serverId);
    } catch (e) {
      getClient().log('WARN', `updateMainResourcesComps failed: ${e.message}`);
    }
  },

  sendSmartSwitchGroupMessage: async function (guildId, serverId, groupId, interaction = null) {
    const instance = getClient().getInstance(guildId);
    const group = instance.serverList[serverId].switchGroups[groupId];

    const content = {
      embeds: [DiscordEmbeds.getSmartSwitchGroupEmbed(guildId, serverId, groupId)],
      components: DiscordButtons.getSmartSwitchGroupButtons(guildId, serverId, groupId),
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/electrics/${group.image}`)
        )
      ]
    };

    const message = await module.exports.sendMessage(
      guildId,
      content,
      group.messageId,
      instance.channelId.switchGroups,
      interaction
    );

    if (!interaction && message && message.id) {
      instance.serverList[serverId].switchGroups[groupId].messageId = message.id;
      getClient().setInstance(guildId, instance);
    } else if (!message && !interaction) {
      instance.serverList[serverId].switchGroups[groupId].messageId = undefined;
      getClient().setInstance(guildId, instance);
    }
  },

  sendStorageMonitorRecycleMessage: async function (guildId, serverId, entityId, items) {
    const instance = getClient().getInstance(guildId);

    const content = {
      embeds: [DiscordEmbeds.getStorageMonitorRecycleEmbed(guildId, serverId, entityId, items)],
      components: [DiscordButtons.getRecycleDeleteButton()],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', 'resources/images/electrics/recycler.png')
        )
      ]
    };

    return await module.exports.sendMessage(
      guildId,
      content,
      null,
      instance.channelId.storageMonitors
    );
  },

  sendDecayingNotificationMessage: async function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];

    const content = {
      embeds: [DiscordEmbeds.getDecayingNotificationEmbed(guildId, serverId, entityId)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`)
        )
      ],
      content: entity.everyone ? '@everyone' : ''
    };

    const targetChannelId = instance.channelId.importantAlerts || instance.channelId.activity;
    await module.exports.sendMessage(guildId, content, null, targetChannelId);
  },

  sendStorageMonitorDisconnectNotificationMessage: async function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];

    const content = {
      embeds: [DiscordEmbeds.getStorageMonitorDisconnectNotificationEmbed(guildId, serverId, entityId)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`)
        )
      ],
      content: entity.everyone ? '@everyone' : ''
    };

await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
try { await updateMainResourcesComps(guildId, serverId); } catch (_) {}
  },

  sendStorageMonitorNotFoundMessage: async function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];

    const content = {
      embeds: [await DiscordEmbeds.getStorageMonitorNotFoundEmbed(guildId, serverId, entityId)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`)
        )
      ],
      content: entity.everyone ? '@everyone' : ''
    };

await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
try { await updateMainResourcesComps(guildId, serverId); } catch (_) {}
  },

  sendSmartSwitchNotFoundMessage: async function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].switches[entityId];

    const content = {
      embeds: [await DiscordEmbeds.getSmartSwitchNotFoundEmbed(guildId, serverId, entityId)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`)
        )
      ]
    };

    await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
  },

  sendSmartAlarmNotFoundMessage: async function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];

    if (!entity || entity.notify === false) return;

    const content = {
      embeds: [await DiscordEmbeds.getSmartAlarmNotFoundEmbed(guildId, serverId, entityId)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`)
        )
      ],
      content: entity.everyone ? '@everyone' : ''
    };

    await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
  },

  sendSmartAlarmTriggerMessage: async function (guildId, serverId, entityId) {
    const instance = getClient().getInstance(guildId);
    const alarm = instance.serverList[serverId].alarms[entityId];

    if (alarm && alarm.notify === false) return;

    const content = {
      embeds: [await DiscordEmbeds.getAlarmEmbed(guildId, serverId, entityId)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/electrics/${alarm.image}`)
        )
      ],
      content: alarm.everyone ? '@everyone' : ''
    };

    const targetChannelId = instance.channelId.importantAlerts || instance.channelId.activity;
    await module.exports.sendMessage(guildId, content, null, targetChannelId);
  },

  sendServerChangeStateMessage: async function (guildId, serverId, state) {
    const instance = getClient().getInstance(guildId);

    const content = {
      embeds: [DiscordEmbeds.getServerChangedStateEmbed(guildId, serverId, state)]
    };

    await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
  },

  sendServerWipeDetectedMessage: async function (guildId, serverId) {
    const instance = getClient().getInstance(guildId);

    const content = {
      embeds: [DiscordEmbeds.getServerWipeDetectedEmbed(guildId, serverId)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', '..', `maps/${guildId}_map_full.png`)
        )
      ],
      content: instance.generalSettings.mapWipeNotifyEveryone ? '@everyone' : ''
    };

    await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
  },

  sendServerConnectionInvalidMessage: async function (guildId, serverId) {
    const instance = getClient().getInstance(guildId);

    const content = {
      embeds: [DiscordEmbeds.getServerConnectionInvalidEmbed(guildId, serverId)]
    };

    await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
  },

  sendInformationMapMessage: async function (guildId) {
    const instance = getClient().getInstance(guildId);

    const content = {
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', '..', `maps/${guildId}_map_full.png`)
        )
      ]
    };

    const message = await module.exports.sendMessage(
      guildId,
      content,
      instance.informationMessageId.map,
      instance.channelId.information
    );

    if (message && message.id) {
      instance.informationMessageId.map = message.id;
      getClient().setInstance(guildId, instance);
    }
  },

  sendDiscordEventMessage: async function (guildId, serverId, text, image, color) {
    const instance = getClient().getInstance(guildId);

    const content = {
      embeds: [DiscordEmbeds.getEventEmbed(guildId, serverId, text, image, color)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', `resources/images/events/${image}`)
        )
      ]
    };

    await module.exports.sendMessage(guildId, content, null, instance.channelId.events);
  },

  sendActivityNotificationMessage: async function (guildId, serverId, color, text, steamId, title = null, everyone = false) {
    const instance = getClient().getInstance(guildId);

    let png = null;
    if (steamId !== null) {
      png = await Scrape.scrapeSteamProfilePicture(getClient(), steamId);
    }
    const content = {
      embeds: [DiscordEmbeds.getActivityNotificationEmbed(guildId, serverId, color, text, steamId, png, title)]
    };

    if (everyone) {
      content.content = '@everyone';
    }

    await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
  },

  sendTeamChatMessage: async function (guildId, message) {
    const instance = getClient().getInstance(guildId);

    let color = Constants.COLOR_TEAMCHAT_DEFAULT;
    if (instance.teamChatColors.hasOwnProperty(message.steamId)) {
      color = instance.teamChatColors[message.steamId];
    }

    const content = {
      embeds: [
        DiscordEmbeds.getEmbed({
          color: color,
          description: `**${message.name}**: ${message.message}`
        })
      ]
    };

    if (message.message.includes('@everyone')) {
      content.content = '@everyone';
    }

    await module.exports.sendMessage(guildId, content, null, instance.channelId.teamchat);
  },

  sendTTSMessage: async function (guildId, name, text) {
    const instance = getClient().getInstance(guildId);

    const content = {
      content: getClient().intlGet(guildId, 'userSaid', { user: name, text: text }),
      tts: true
    };

    await module.exports.sendMessage(guildId, content, null, instance.channelId.teamchat);
  },

  sendUpdateMapInformationMessage: async function (rustplus) {
    const instance = getClient().getInstance(rustplus.guildId);

    const content = {
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', '..', `maps/${rustplus.guildId}_map_full.png`)
        )
      ]
    };

    const message = await module.exports.sendMessage(
      rustplus.guildId,
      content,
      instance.informationMessageId.map,
      instance.channelId.information
    );

    if (message && message.id && message.id !== instance.informationMessageId.map) {
      instance.informationMessageId.map = message.id;
      getClient().setInstance(rustplus.guildId, instance);
    }
  },

  sendUpdateServerInformationMessage: async function (rustplus) {
    const instance = getClient().getInstance(rustplus.guildId);

    const content = {
      embeds: [DiscordEmbeds.getUpdateServerInformationEmbed(rustplus)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', 'resources/images/server_info_logo.png')
        )
      ]
    };

    const message = await module.exports.sendMessage(
      rustplus.guildId,
      content,
      instance.informationMessageId.server,
      instance.channelId.information
    );

    if (message && message.id && message.id !== instance.informationMessageId.server) {
      instance.informationMessageId.server = message.id;
      getClient().setInstance(rustplus.guildId, instance);
    }
  },

  sendUpdateEventInformationMessage: async function (rustplus) {
    const instance = getClient().getInstance(rustplus.guildId);

    const content = {
      embeds: [DiscordEmbeds.getUpdateEventInformationEmbed(rustplus)],
      files: [
        new Discord.AttachmentBuilder(
          Path.join(__dirname, '..', 'resources/images/event_info_logo.png')
        )
      ]
    };

    const message = await module.exports.sendMessage(
      rustplus.guildId,
      content,
      instance.informationMessageId.event,
      instance.channelId.information
    );

    if (message && message.id && message.id !== instance.informationMessageId.event) {
      instance.informationMessageId.event = message.id;
      getClient().setInstance(rustplus.guildId, instance);
    }
  },

  sendUpdateTeamInformationMessage: async function (rustplus) {
    const instance = getClient().getInstance(rustplus.guildId);

const content = {
  embeds: [DiscordEmbeds.getUpdateTeamInformationEmbed(rustplus)]
};


    const message = await module.exports.sendMessage(
      rustplus.guildId,
      content,
      instance.informationMessageId.team,
      instance.channelId.information
    );

    if (message && message.id && message.id !== instance.informationMessageId.team) {
      instance.informationMessageId.team = message.id;
      getClient().setInstance(rustplus.guildId, instance);
    }
  },

    sendUpdateMarketWatchlistInformationMessage: async function (rustplus) {
    const instance = getClient().getInstance(rustplus.guildId);

    const content = {
      embeds: [DiscordEmbeds.getUpdateMarketWatchlistInformationEmbed(rustplus)]
    };

    const message = await module.exports.sendMessage(
      rustplus.guildId,
      content,
      instance.informationMessageId.marketWatchlist,
      instance.channelId.information
    );

    if (message && message.id && message.id !== instance.informationMessageId.marketWatchlist) {
      instance.informationMessageId.marketWatchlist = message.id;
      getClient().setInstance(rustplus.guildId, instance);
    }
  },


  sendUpdateBattlemetricsOnlinePlayersInformationMessage: async function (rustplus, battlemetricsId) {
    const instance = getClient().getInstance(rustplus.guildId);

    const content = {
      embeds: [DiscordEmbeds.getUpdateBattlemetricsOnlinePlayersInformationEmbed(rustplus, battlemetricsId)]
    };

    const message = await module.exports.sendMessage(
      rustplus.guildId,
      content,
      instance.informationMessageId.battlemetricsPlayers,
      instance.channelId.information
    );

    if (message && message.id && message.id !== instance.informationMessageId.battlemetricsPlayers) {
      instance.informationMessageId.battlemetricsPlayers = message.id;
      getClient().setInstance(rustplus.guildId, instance);
    }
  },

  sendDiscordCommandResponseMessage: async function (rustplus, client, message, response) {
    const content = {
      embeds: [DiscordEmbeds.getDiscordCommandResponseEmbed(rustplus, response)]
    };

    await client.messageReply(message, content);
  },

  sendCredentialsShowMessage: async function (interaction) {
    const content = {
      embeds: [await DiscordEmbeds.getCredentialsShowEmbed(interaction.guildId)],
      ephemeral: true
    };

    await getClient().interactionEditReply(interaction, content);
  },

  sendItemAvailableInVendingMachineMessage: async function (rustplus, str) {
    const instance = getClient().getInstance(rustplus.guildId);

    const content = {
      embeds: [DiscordEmbeds.getItemAvailableVendingMachineEmbed(rustplus.guildId, rustplus.serverId, str)]
    };

    await module.exports.sendMessage(rustplus.guildId, content, null, instance.channelId.activity);
  },

  sendHelpMessage: async function (interaction) {
    const content = {
      embeds: [DiscordEmbeds.getHelpEmbed(interaction.guildId)],
      components: DiscordButtons.getHelpButtons(),
      ephemeral: true
    };

    await getClient().interactionReply(interaction, content);
  },

  sendCctvMessage: async function (interaction, monument, cctvCodes, dynamic) {
    const content = {
      embeds: [DiscordEmbeds.getCctvEmbed(interaction.guildId, monument, cctvCodes, dynamic)],
      ephemeral: true
    };

    await getClient().interactionReply(interaction, content);
  },

  sendUptimeMessage: async function (interaction, uptime) {
    const content = {
      embeds: [DiscordEmbeds.getUptimeEmbed(interaction.guildId, uptime)],
      ephemeral: true
    };

    await getClient().interactionEditReply(interaction, content);
  },

  sendVoiceMessage: async function (interaction, state) {
    const content = {
      embeds: [DiscordEmbeds.getVoiceEmbed(interaction.guildId, state)],
      ephemeral: true
    };

    await getClient().interactionEditReply(interaction, content);
  },

  sendCraftMessage: async function (interaction, craftDetails, quantity) {
    const content = {
      embeds: [DiscordEmbeds.getCraftEmbed(interaction.guildId, craftDetails, quantity)],
      ephemeral: true
    };

    await getClient().interactionEditReply(interaction, content);
  },

  sendResearchMessage: async function (interaction, researchDetails) {
    const content = {
      embeds: [DiscordEmbeds.getResearchEmbed(interaction.guildId, researchDetails)],
      ephemeral: true
    };

    await getClient().interactionEditReply(interaction, content);
  },

  sendRecycleMessage: async function (interaction, recycleDetails, quantity, recyclerType) {
    const content = {
      embeds: [DiscordEmbeds.getRecycleEmbed(interaction.guildId, recycleDetails, quantity, recyclerType)],
      ephemeral: true
    };

    await getClient().interactionEditReply(interaction, content);
  },

  sendBattlemetricsEventMessage: async function (guildId, battlemetricsId, title, description, fields = null, everyone = false) {
    const instance = getClient().getInstance(guildId);

    const content = {
      embeds: [DiscordEmbeds.getBattlemetricsEventEmbed(guildId, battlemetricsId, title, description, fields)]
    };

    if (everyone) {
      content.content = '@everyone';
    }

    await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
  },

  sendItemMessage: async function (interaction, itemName, itemId, type) {
    const content = {
      embeds: [DiscordEmbeds.getItemEmbed(interaction.guildId, itemName, itemId, type)],
      ephemeral: true
    };

    await getClient().interactionEditReply(interaction, content);
  }
};
