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

const Constants = require('../util/constants.js');
const DiscordMessages = require('./discordMessages.js');
const DiscordTools = require('./discordTools.js');
const { updateMainResourcesComps } = require('./MainResourcesCompsBox.js');

module.exports = async (client, rustplus) => {
    const instance = client.getInstance(rustplus.guildId);
    const guildId = rustplus.guildId;
    const serverId = rustplus.serverId;

    if (rustplus.isNewConnection) {
        await DiscordTools.clearTextChannel(guildId, instance.channelId.storageMonitors, 100);
    }

    for (const entityId in instance.serverList[serverId].storageMonitors) {
        const entity = instance.serverList[serverId].storageMonitors[entityId];
        const info = await rustplus.getEntityInfoAsync(entityId);

        if (!(await rustplus.isResponseValid(info))) {
            if (entity.reachable === true) {
                await DiscordMessages.sendStorageMonitorNotFoundMessage(guildId, serverId, entityId);
            }
            entity.reachable = false;
        }
        else {
            entity.reachable = true;
        }
        client.setInstance(guildId, instance);

        if (entity.reachable) {
            // Defensive: payload may be missing even when response is considered valid
            const payload = info && info.entityInfo && info.entityInfo.payload ? info.entityInfo.payload : null;
            if (!payload) {
                // Log a warning and skip setting fields to avoid TypeError
                try { rustplus.log('WARNING', `SetupStorageMonitors: missing payload for entity ${entityId}`,'warning'); } catch (e) { /* ignore logging errors */ }
            } else {
                rustplus.storageMonitors[entityId] = {
                    items: payload.items,
                    expiry: payload.protectionExpiry,
                    capacity: payload.capacity,
                    hasProtection: payload.hasProtection
                }

                if (payload.capacity !== 0) {
                    if (payload.capacity === Constants.STORAGE_MONITOR_TOOL_CUPBOARD_CAPACITY) {
                        entity.type = 'toolCupboard';
                        if (payload.protectionExpiry === 0) {
                            entity.decaying = true;
                        }
                        else {
                            entity.decaying = false;
                        }
                    }
                    else if (payload.capacity === Constants.STORAGE_MONITOR_VENDING_MACHINE_CAPACITY) {
                        entity.type = 'vendingMachine';
                    }
                    else if (payload.capacity === Constants.STORAGE_MONITOR_LARGE_WOOD_BOX_CAPACITY) {
                        entity.type = 'largeWoodBox';
                    }
                    client.setInstance(guildId, instance);
                }
            }
        }

        await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId);
    }

    // Ensure Main Resources & Comps card is created/updated after all storage monitors are set up
    try {
        await updateMainResourcesComps(guildId, serverId);
    } catch (e) {
        client.log(client.intlGet(null, 'warningCap'), `updateMainResourcesComps failed in SetupStorageMonitors: ${e.message}`, 'warning');
    }
};
