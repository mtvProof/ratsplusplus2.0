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

const CommandHandler = require('../handlers/inGameCommandHandler.js');
const Constants = require('../util/constants.js');
const DiscordMessages = require('../discordTools/discordMessages.js');
const InGameChatHandler = require('../handlers/inGameChatHandler.js');
const SmartSwitchGroupHandler = require('../handlers/smartSwitchGroupHandler.js');
const TeamChatHandler = require("../handlers/teamChatHandler.js");
const TeamHandler = require('../handlers/teamHandler.js');

module.exports = {
    name: 'message',
    async execute(rustplus, client, message) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        if (!rustplus.isOperational) return;

        if (message.hasOwnProperty('response')) {
            messageResponse(rustplus, client, message);
        }
        else if (message.hasOwnProperty('broadcast')) {
            messageBroadcast(rustplus, client, message);
        }
    },
};

async function messageResponse(rustplus, client, message) {
    /* Not implemented */
}

async function messageBroadcast(rustplus, client, message) {
    if (message.broadcast.hasOwnProperty('teamChanged')) {
        messageBroadcastTeamChanged(rustplus, client, message);
    }
    else if (message.broadcast.hasOwnProperty('teamMessage')) {
        messageBroadcastTeamMessage(rustplus, client, message);
    }
    else if (message.broadcast.hasOwnProperty('entityChanged')) {
        messageBroadcastEntityChanged(rustplus, client, message);
    }
    else if (message.broadcast.hasOwnProperty('cameraRays')) {
        messageBroadcastCameraRays(rustplus, client, message);
    }
}

async function messageBroadcastTeamChanged(rustplus, client, message) {
    TeamHandler.handler(rustplus, client, message.broadcast.teamChanged.teamInfo);
    const changed = rustplus.team.isLeaderSteamIdChanged(message.broadcast.teamChanged.teamInfo);
    rustplus.team.updateTeam(message.broadcast.teamChanged.teamInfo);
    if (changed) rustplus.updateLeaderRustPlusLiteInstance();
}

async function messageBroadcastTeamMessage(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const steamId = message.broadcast.teamMessage.message.steamId.toString();

    if (steamId === rustplus.playerId) {
        /* Delay inGameChatHandler */
        clearTimeout(rustplus.inGameChatTimeout);
        const commandDelayMs = parseInt(rustplus.generalSettings.commandDelay) * 1000;
        rustplus.inGameChatTimeout = setTimeout(
            InGameChatHandler.inGameChatHandler, commandDelayMs, rustplus, client);
    }

    let tempName = message.broadcast.teamMessage.message.name;
    let tempMessage = message.broadcast.teamMessage.message.message;

    tempName = tempName.replace(/^<size=.*?><color=.*?>/, '');  /* Rustafied */
    tempName = tempName.replace(/<\/color><\/size>$/, '');      /* Rustafied */
    message.broadcast.teamMessage.message.name = tempName;

    tempMessage = tempMessage.replace(/^<size=.*?><color=.*?>/, '');  /* Rustafied */
    tempMessage = tempMessage.replace(/<\/color><\/size>$/, '');      /* Rustafied */
    tempMessage = tempMessage.replace(/^<color.+?<\/color>/g, '');      /* Unknown */
    message.broadcast.teamMessage.message.message = tempMessage;

    if (instance.blacklist['steamIds'].includes(`${steamId}`)) {
        rustplus.log(client.intlGet(null, 'infoCap'), client.intlGet(null, `userPartOfBlacklistInGame`, {
            user: `${message.broadcast.teamMessage.message.name} (${steamId})`,
            message: message.broadcast.teamMessage.message.message
        }));
        TeamChatHandler(rustplus, client, message.broadcast.teamMessage.message);
        return;
    }

    if (rustplus.messagesSentByBot.includes(message.broadcast.teamMessage.message.message)) {
        /* Remove message from messagesSendByBot */
        for (let i = rustplus.messagesSentByBot.length - 1; i >= 0; i--) {
            if (rustplus.messagesSentByBot[i] === message.broadcast.teamMessage.message.message) {
                rustplus.messagesSentByBot.splice(i, 1);
            }
        }
        return;
    }

    const isCommand = await CommandHandler.inGameCommandHandler(rustplus, client, message);
    if (isCommand) return;

    rustplus.log(client.intlGet(null, 'infoCap'), client.intlGet(null, `logInGameMessage`, {
        message: message.broadcast.teamMessage.message.message,
        user: `${message.broadcast.teamMessage.message.name} (${steamId})`
    }));

    TeamChatHandler(rustplus, client, message.broadcast.teamMessage.message);
}

async function messageBroadcastEntityChanged(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const entityId = message.broadcast.entityChanged.entityId;

    if (instance.serverList[rustplus.serverId].switches.hasOwnProperty(entityId)) {
        messageBroadcastEntityChangedSmartSwitch(rustplus, client, message);
    }
    else if (instance.serverList[rustplus.serverId].alarms.hasOwnProperty(entityId)) {
        messageBroadcastEntityChangedSmartAlarm(rustplus, client, message);
    }
    else if (instance.serverList[rustplus.serverId].storageMonitors.hasOwnProperty(entityId)) {
        messageBroadcastEntityChangedStorageMonitor(rustplus, client, message);
    }
}

async function messageBroadcastCameraRays(rustplus, client, message) {
    /* Not implemented */
}

async function messageBroadcastEntityChangedSmartSwitch(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const serverId = rustplus.serverId;
    const entityId = message.broadcast.entityChanged.entityId;
    const server = instance.serverList[serverId];

    if (!server || (server && !server.switches[entityId])) return;

    if (rustplus.interactionSwitches.includes(`${entityId}`)) {
        rustplus.interactionSwitches = rustplus.interactionSwitches.filter(e => e !== `${entityId}`);
        return;
    }

    if (rustplus.currentSwitchTimeouts.hasOwnProperty(entityId)) {
        clearTimeout(rustplus.currentSwitchTimeouts[entityId]);
        delete rustplus.currentSwitchTimeouts[entityId];
    }

    // Guard: payload may be missing in some broadcasts
    const payload = message.broadcast.entityChanged.payload;
    if (!payload) {
        // Mark unreachable and persist
        server.switches[entityId].reachable = false;
        client.setInstance(rustplus.guildId, instance);
        return;
    }

    const active = payload.value;
    server.switches[entityId].active = active;
    client.setInstance(rustplus.guildId, instance);

    DiscordMessages.sendSmartSwitchMessage(rustplus.guildId, serverId, entityId);
    SmartSwitchGroupHandler.updateSwitchGroupIfContainSwitch(
        client, rustplus.guildId, serverId, entityId);
}

async function messageBroadcastEntityChangedSmartAlarm(rustplus, client, message) {
  const instance = client.getInstance(rustplus.guildId);
  const serverId = rustplus.serverId;
  const entityId = message.broadcast.entityChanged.entityId;
  const server = instance.serverList[serverId];

    // Debug: log raw alarm broadcast for troubleshooting (will help confirm receipt)
    try {
        client.log('DEBUG', `alarm broadcast received: ${JSON.stringify(message.broadcast.entityChanged)}`);
    } catch (e) {
        client.log('DEBUG', 'alarm broadcast received (stringify failed)');
    }

    if (!server || !server.alarms[entityId]) return;

    const alarm  = server.alarms[entityId];            // <— grab the alarm once

        // Guard: payload may be missing in some broadcasts
        const payload = message.broadcast.entityChanged.payload;
        if (!payload) {
                // Mark alarm as unreachable and persist
                alarm.reachable = false;
                client.setInstance(rustplus.guildId, instance);
                return;
        }

        const active = payload.value;
  alarm.active = active;
  alarm.reachable = true;
  client.setInstance(rustplus.guildId, instance);

  if (active) {
    alarm.lastTrigger = Math.floor(Date.now() / 1000);
    client.setInstance(rustplus.guildId, instance);

    // (Optional but safe) Only send the Discord alert if the alarm's notifs are ON
    if (alarm.notify !== false) {
      await DiscordMessages.sendSmartAlarmTriggerMessage(rustplus.guildId, serverId, entityId);
    }

    // NEW: gate the in-game message by the alarm's notify toggle + global in-game toggle
    if (instance.generalSettings.smartAlarmNotifyInGame) {
      rustplus.sendInGameMessage(`${alarm.name}: ${alarm.message}`);
    }
  }

  DiscordMessages.sendSmartAlarmMessage(rustplus.guildId, rustplus.serverId, entityId);
}

async function messageBroadcastEntityChangedStorageMonitor(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const serverId = rustplus.serverId;
    const entityId = message.broadcast.entityChanged.entityId;
    const server = instance.serverList[serverId];

    if (!server || (server && !server.storageMonitors[entityId])) return;

    // Guard: payload may be missing in some broadcasts
    const payload = message.broadcast.entityChanged.payload;
    if (!payload) {
        server.storageMonitors[entityId].reachable = false;
        client.setInstance(rustplus.guildId, instance);
        return;
    }

    if (payload.value === true) return;

    if (server.storageMonitors[entityId].type === 'toolCupboard' ||
        payload.capacity === Constants.STORAGE_MONITOR_TOOL_CUPBOARD_CAPACITY) {
        setTimeout(updateToolCupboard.bind(null, rustplus, client, message), 2000);
    }
    else {
        rustplus.storageMonitors[entityId] = {
            items: payload.items,
            expiry: payload.protectionExpiry,
            capacity: payload.capacity,
            hasProtection: payload.hasProtection
        }

        const info = await rustplus.getEntityInfoAsync(entityId);
        // ensure info contains payload before marking reachable
        server.storageMonitors[entityId].reachable = (await rustplus.isResponseValid(info) && info?.entityInfo?.payload) ? true : false;

        if (server.storageMonitors[entityId].reachable) {
            const epayload = info.entityInfo.payload;
            if (epayload.capacity === Constants.STORAGE_MONITOR_VENDING_MACHINE_CAPACITY) {
                server.storageMonitors[entityId].type = 'vendingMachine';
            }
            else if (epayload.capacity === Constants.STORAGE_MONITOR_LARGE_WOOD_BOX_CAPACITY) {
                server.storageMonitors[entityId].type = 'largeWoodBox';
            }
        }
        client.setInstance(rustplus.guildId, instance);

        await DiscordMessages.sendStorageMonitorMessage(rustplus.guildId, serverId, entityId);
    }
}

async function updateToolCupboard(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const server = instance.serverList[rustplus.serverId];
    const entityId = message.broadcast.entityChanged.entityId;

    const info = await rustplus.getEntityInfoAsync(entityId);
    // ensure info contains payload before marking reachable
    server.storageMonitors[entityId].reachable = (await rustplus.isResponseValid(info) && info?.entityInfo?.payload) ? true : false;
    client.setInstance(rustplus.guildId, instance);

    if (server.storageMonitors[entityId].reachable) {
        const epayload = info.entityInfo.payload;
        rustplus.storageMonitors[entityId] = {
            items: epayload.items,
            expiry: epayload.protectionExpiry,
            capacity: epayload.capacity,
            hasProtection: epayload.hasProtection
        }

        server.storageMonitors[entityId].type = 'toolCupboard';

        if (epayload.protectionExpiry === 0 && server.storageMonitors[entityId].decaying === false) {
            server.storageMonitors[entityId].decaying = true;

            await DiscordMessages.sendDecayingNotificationMessage(rustplus.guildId, rustplus.serverId, entityId);

            if (server.storageMonitors[entityId].inGame) {
                rustplus.sendInGameMessage(client.intlGet(rustplus.guildId, 'isDecaying', {
                    device: server.storageMonitors[entityId].name
                }));
            }
        }
        else if (epayload.protectionExpiry !== 0) {
            server.storageMonitors[entityId].decaying = false;
        }
        client.setInstance(rustplus.guildId, instance);
    }

    await DiscordMessages.sendStorageMonitorMessage(rustplus.guildId, rustplus.serverId, entityId);
}