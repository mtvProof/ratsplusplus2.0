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
const TextInput = require('./discordTextInputs.js');

module.exports = {
    getModal: function (options = {}) {
        const modal = new Discord.ModalBuilder();

        if (options.hasOwnProperty('customId')) modal.setCustomId(options.customId);
        if (options.hasOwnProperty('title')) modal.setTitle(options.title.slice(0, 45));

        return modal;
    },

    getServerEditModal(guildId, serverId) {
        const instance = getClient().getInstance(guildId);
        const server = instance.serverList[serverId];
        const identifier = JSON.stringify({ "serverId": serverId });

        const modal = module.exports.getModal({
            customId: `ServerEdit${identifier}`,
            title: getClient().intlGet(guildId, 'editing')
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'ServerBattlemetricsId',
                label: getClient().intlGet(guildId, 'battlemetricsId'),
                value: server.battlemetricsId === null ? '' : server.battlemetricsId,
                style: Discord.TextInputStyle.Short,
                required: false,
                minLength: 0
            }))
        );

        return modal;
    },

    getCustomTimersEditModal(guildId, serverId) {
        const instance = getClient().getInstance(guildId);
        const server = instance.serverList[serverId];
        const identifier = JSON.stringify({ "serverId": serverId });

        const modal = module.exports.getModal({
            customId: `CustomTimersEdit${identifier}`,
            title: getClient().intlGet(guildId, 'customTimerEditDesc')
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'CargoShipEgressTime',
                label: getClient().intlGet(guildId, 'customTimerEditCargoShipEgressLabel'),
                value: `${server.cargoShipEgressTimeMs / 1000}`,
                style: Discord.TextInputStyle.Short
            })),
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'OilRigCrateUnlockTime',
                label: getClient().intlGet(guildId, 'customTimerEditCrateOilRigUnlockLabel'),
                value: `${server.oilRigLockedCrateUnlockTimeMs / 1000}`,
                style: Discord.TextInputStyle.Short
            }))
        );

        return modal;
    },

    getSmartSwitchEditModal(guildId, serverId, entityId) {
        const instance = getClient().getInstance(guildId);
        const entity = instance.serverList[serverId].switches[entityId];
        const identifier = JSON.stringify({ "serverId": serverId, "entityId": entityId });

        const modal = module.exports.getModal({
            customId: `SmartSwitchEdit${identifier}`,
            title: getClient().intlGet(guildId, 'editingOf', {
                entity: entity.name.length > 18 ? `${entity.name.slice(0, 18)}..` : entity.name
            })
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'SmartSwitchName',
                label: getClient().intlGet(guildId, 'name'),
                value: entity.name,
                style: Discord.TextInputStyle.Short
            })),
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'SmartSwitchCommand',
                label: getClient().intlGet(guildId, 'customCommand'),
                value: entity.command,
                style: Discord.TextInputStyle.Short
            }))
        );

        if (entity.autoDayNightOnOff === 5 || entity.autoDayNightOnOff === 6) {
            modal.addComponents(
                new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                    customId: 'SmartSwitchProximity',
                    label: getClient().intlGet(guildId, 'smartSwitchEditProximityLabel'),
                    value: `${entity.proximity}`,
                    style: Discord.TextInputStyle.Short
                }))
            );
        }

        return modal;
    },

    getGroupEditModal(guildId, serverId, groupId) {
        const instance = getClient().getInstance(guildId);
        const group = instance.serverList[serverId].switchGroups[groupId];
        const identifier = JSON.stringify({ "serverId": serverId, "groupId": groupId });

        const modal = module.exports.getModal({
            customId: `GroupEdit${identifier}`,
            title: getClient().intlGet(guildId, 'editingOf', {
                entity: group.name.length > 18 ? `${group.name.slice(0, 18)}..` : group.name
            })
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'GroupName',
                label: getClient().intlGet(guildId, 'name'),
                value: group.name,
                style: Discord.TextInputStyle.Short
            })),
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'GroupCommand',
                label: getClient().intlGet(guildId, 'customCommand'),
                value: group.command,
                style: Discord.TextInputStyle.Short
            }))
        );

        return modal;
    },

    getGroupAddSwitchModal(guildId, serverId, groupId) {
        const instance = getClient().getInstance(guildId);
        const group = instance.serverList[serverId].switchGroups[groupId];
        const identifier = JSON.stringify({ "serverId": serverId, "groupId": groupId });

        const modal = module.exports.getModal({
            customId: `GroupAddSwitch${identifier}`,
            title: getClient().intlGet(guildId, 'groupAddSwitchDesc', { group: group.name })
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'GroupAddSwitchId',
                label: getClient().intlGet(guildId, 'entityId'),
                value: '',
                style: Discord.TextInputStyle.Short
            }))
        );

        return modal;
    },

    getGroupRemoveSwitchModal(guildId, serverId, groupId) {
        const instance = getClient().getInstance(guildId);
        const group = instance.serverList[serverId].switchGroups[groupId];
        const identifier = JSON.stringify({ "serverId": serverId, "groupId": groupId });

        const modal = module.exports.getModal({
            customId: `GroupRemoveSwitch${identifier}`,
            title: getClient().intlGet(guildId, 'groupRemoveSwitchDesc', { group: group.name })
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'GroupRemoveSwitchId',
                label: getClient().intlGet(guildId, 'entityId'),
                value: '',
                style: Discord.TextInputStyle.Short
            }))
        );

        return modal;
    },

    getSmartAlarmEditModal(guildId, serverId, entityId) {
        const instance = getClient().getInstance(guildId);
        const entity = instance.serverList[serverId].alarms[entityId];
        const identifier = JSON.stringify({ "serverId": serverId, "entityId": entityId });

        const modal = module.exports.getModal({
            customId: `SmartAlarmEdit${identifier}`,
            title: getClient().intlGet(guildId, 'editingOf', {
                entity: entity.name.length > 18 ? `${entity.name.slice(0, 18)}..` : entity.name
            })
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'SmartAlarmName',
                label: getClient().intlGet(guildId, 'name'),
                value: entity.name,
                style: Discord.TextInputStyle.Short
            })),
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'SmartAlarmMessage',
                label: getClient().intlGet(guildId, 'message'),
                value: entity.message,
                style: Discord.TextInputStyle.Short
            })),
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'SmartAlarmCommand',
                label: getClient().intlGet(guildId, 'customCommand'),
                value: entity.command,
                style: Discord.TextInputStyle.Short
            }))
        );

        return modal;
    },

    getStorageMonitorEditModal(guildId, serverId, entityId) {
        const instance = getClient().getInstance(guildId);
        const entity = instance.serverList[serverId].storageMonitors[entityId];
        const identifier = JSON.stringify({ "serverId": serverId, "entityId": entityId });

        const modal = module.exports.getModal({
            customId: `StorageMonitorEdit${identifier}`,
            title: getClient().intlGet(guildId, 'editingOf', {
                entity: entity.name.length > 18 ? `${entity.name.slice(0, 18)}..` : entity.name
            })
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'StorageMonitorName',
                label: getClient().intlGet(guildId, 'name'),
                value: entity.name,
                style: Discord.TextInputStyle.Short
            }))
        );

        return modal;
    },

    getTrackerEditModal(guildId, trackerId) {
        const instance = getClient().getInstance(guildId);
        const tracker = instance.trackers[trackerId];
        const identifier = JSON.stringify({ "trackerId": trackerId });

        const modal = module.exports.getModal({
            customId: `TrackerEdit${identifier}`,
            title: getClient().intlGet(guildId, 'editingOf', {
                entity: tracker.name.length > 18 ? `${tracker.name.slice(0, 18)}..` : tracker.name
            })
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'TrackerName',
                label: getClient().intlGet(guildId, 'name'),
                value: tracker.name,
                style: Discord.TextInputStyle.Short
            })),
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'TrackerBattlemetricsId',
                label: getClient().intlGet(guildId, 'battlemetricsId'),
                value: tracker.battlemetricsId,
                style: Discord.TextInputStyle.Short
            })),
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'TrackerClanTag',
                label: getClient().intlGet(guildId, 'clanTag'),
                value: tracker.clanTag,
                style: Discord.TextInputStyle.Short,
                required: false,
                minLength: 0
            }))
        );

        return modal;
    },

    getTrackerAddPlayerModal(guildId, trackerId) {
        const instance = getClient().getInstance(guildId);
        const tracker = instance.trackers[trackerId];
        const identifier = JSON.stringify({ "trackerId": trackerId });

        const modal = module.exports.getModal({
            customId: `TrackerAddPlayer${identifier}`,
            title: getClient().intlGet(guildId, 'trackerAddPlayerDesc', { tracker: tracker.name })
        });


        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'TrackerAddPlayerId',
                label: `${getClient().intlGet(guildId, 'steamId')} / ` +
                    `${getClient().intlGet(guildId, 'battlemetricsId')}`,
                value: '',
                style: Discord.TextInputStyle.Short
            }))
        );

        return modal;
    },

    getTrackerRemovePlayerModal(guildId, trackerId) {
        const instance = getClient().getInstance(guildId);
        const tracker = instance.trackers[trackerId];
        const identifier = JSON.stringify({ "trackerId": trackerId });

        const modal = module.exports.getModal({
            customId: `TrackerRemovePlayer${identifier}`,
            title: getClient().intlGet(guildId, 'trackerRemovePlayerDesc', { tracker: tracker.name })
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(TextInput.getTextInput({
                customId: 'TrackerRemovePlayerId',
                label: `${getClient().intlGet(guildId, 'steamId')} / ` +
                    `${getClient().intlGet(guildId, 'battlemetricsId')}`,
                value: '',
                style: Discord.TextInputStyle.Short
            }))
        );

        return modal;
    },
}