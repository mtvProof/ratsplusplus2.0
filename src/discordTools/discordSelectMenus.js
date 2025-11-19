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
const Fs = require('fs');
const Path = require('path');



const getClient = require('../util/getClient');
const Constants = require('../util/constants.js');
const Languages = require('../util/languages.js');

module.exports = {
    getSelectMenu: function (options = {}) {
        const selectMenu = new Discord.StringSelectMenuBuilder();

        if (options.hasOwnProperty('customId')) selectMenu.setCustomId(options.customId);
        if (options.hasOwnProperty('placeholder')) selectMenu.setPlaceholder(options.placeholder);
        if (options.hasOwnProperty('options')) {
            for (const option of options.options) {
                option.description = option.description.substring(0, Constants.SELECT_MENU_MAX_DESCRIPTION_CHARACTERS);
            }
            selectMenu.setOptions(options.options);
        }
        if (options.hasOwnProperty('disabled')) selectMenu.setDisabled(options.disabled);

        return selectMenu;
    },

    getLanguageSelectMenu: function (guildId, language) {
        const languageFiles = Fs.readdirSync(
            Path.join(__dirname, '..', 'languages')).filter(file => file.endsWith('.json'));

        const options = [];
        for (const language of languageFiles) {
            const langShort = language.replace('.json', '')
            let langLong = Object.keys(Languages).find(e => Languages[e] === langShort)
            if (!langLong) langLong = getClient().intlGet(guildId, 'unknown');
            options.push({
                label: `${langLong} (${langShort})`,
                description: getClient().intlGet(guildId, 'setBotLanguage', {
                    language: `${langLong} (${langShort})`
                }),
                value: langShort
            });
        }

        let currentLanguage = Object.keys(Languages).find(e => Languages[e] === language);
        if (!currentLanguage) currentLanguage = getClient().intlGet(guildId, 'unknown');

        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
                customId: 'language',
                placeholder: `${currentLanguage} (${language})`,
                options: options
            }));
    },

    getPrefixSelectMenu: function (guildId, prefix) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
                customId: 'Prefix',
                placeholder: getClient().intlGet(guildId, 'currentPrefixPlaceholder', { prefix: prefix }),
                options: [
                    { label: '!', description: getClient().intlGet(guildId, 'exclamationMark'), value: '!' },
                    { label: '?', description: getClient().intlGet(guildId, 'questionMark'), value: '?' },
                    { label: '.', description: getClient().intlGet(guildId, 'dot'), value: '.' },
                    { label: ':', description: getClient().intlGet(guildId, 'colon'), value: ':' },
                    { label: ',', description: getClient().intlGet(guildId, 'comma'), value: ',' },
                    { label: ';', description: getClient().intlGet(guildId, 'semicolon'), value: ';' },
                    { label: '-', description: getClient().intlGet(guildId, 'dash'), value: '-' },
                    { label: '_', description: getClient().intlGet(guildId, 'underscore'), value: '_' },
                    { label: '=', description: getClient().intlGet(guildId, 'equalsSign'), value: '=' },
                    { label: '*', description: getClient().intlGet(guildId, 'asterisk'), value: '*' },
                    { label: '@', description: getClient().intlGet(guildId, 'atSign'), value: '@' },
                    { label: '+', description: getClient().intlGet(guildId, 'plusSign'), value: '+' },
                    { label: "'", description: getClient().intlGet(guildId, 'apostrophe'), value: "'" },
                    { label: '#', description: getClient().intlGet(guildId, 'hash'), value: '#' },
                    { label: '¤', description: getClient().intlGet(guildId, 'currencySign'), value: '¤' },
                    { label: '%', description: getClient().intlGet(guildId, 'percentSign'), value: '%' },
                    { label: '&', description: getClient().intlGet(guildId, 'ampersand'), value: '&' },
                    { label: '|', description: getClient().intlGet(guildId, 'pipe'), value: '|' },
                    { label: '>', description: getClient().intlGet(guildId, 'greaterThanSign'), value: '>' },
                    { label: '<', description: getClient().intlGet(guildId, 'lessThanSign'), value: '<' },
                    { label: '~', description: getClient().intlGet(guildId, 'tilde'), value: '~' },
                    { label: '^', description: getClient().intlGet(guildId, 'circumflex'), value: '^' },
                    { label: '♥', description: getClient().intlGet(guildId, 'heart'), value: '♥' },
                    { label: '☺', description: getClient().intlGet(guildId, 'smilyFace'), value: '☺' },
                    { label: '/', description: getClient().intlGet(guildId, 'slash'), value: '/' }]
            }));
    },

    getTrademarkSelectMenu: function (guildId, trademark) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
                customId: 'Trademark',
                placeholder: `${trademark === 'NOT SHOWING' ?
                    getClient().intlGet(guildId, 'notShowingCap') : trademark}`,
                options: [
                    {
                        label: 'rustplusplus',
                        description: getClient().intlGet(guildId, 'trademarkShownBeforeMessage', {
                            trademark: 'rustplusplus'
                        }),
                        value: 'rustplusplus'
                    },
                    {
                        label: 'Rust++',
                        description: getClient().intlGet(guildId, 'trademarkShownBeforeMessage', {
                            trademark: 'Rust++'
                        }),
                        value: 'Rust++'
                    },
                    {
                        label: 'R++',
                        description: getClient().intlGet(guildId, 'trademarkShownBeforeMessage', {
                            trademark: 'R++'
                        }),
                        value: 'R++'
                    },
                    {
                        label: 'RPP',
                        description: getClient().intlGet(guildId, 'trademarkShownBeforeMessage', {
                            trademark: 'RPP'
                        }),
                        value: 'RPP'
                    },
                    {
                        label: 'RATS++',
                        description: getClient().intlGet(guildId, 'trademarkShownBeforeMessage', {
                            trademark: 'RATS++'
                        }),
                        value: 'RATS++'
                    },
                    {
                        label: ':hat.ratmask:',
                        description: getClient().intlGet(guildId, 'trademarkShownBeforeMessage', {
                            trademark: ':hat.ratmask:'
                        }),
                        value: ':hat.ratmask:'
                    },
                    {
                        label: getClient().intlGet(guildId, 'notShowingCap'),
                        description: getClient().intlGet(guildId, 'hideTrademark'),
                        value: 'NOT SHOWING'
                    }]
            }));
    },

    getCommandDelaySelectMenu: function (guildId, delay) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
                customId: 'CommandDelay',
                placeholder: getClient().intlGet(guildId, 'currentCommandDelay', { delay: delay }),
                options: [
                    {
                        label: getClient().intlGet(guildId, 'noDelayCap'),
                        description: getClient().intlGet(guildId, 'noCommandDelay'),
                        value: '0'
                    },
                    {
                        label: getClient().intlGet(guildId, 'second', { second: '1' }),
                        description: getClient().intlGet(guildId, 'secondCommandDelay', {
                            second: getClient().intlGet(guildId, 'one')
                        }),
                        value: '1'
                    },
                    {
                        label: getClient().intlGet(guildId, 'seconds', { seconds: '2' }),
                        description: getClient().intlGet(guildId, 'secondsCommandDelay', {
                            seconds: getClient().intlGet(guildId, 'two')
                        }),
                        value: '2'
                    },
                    {
                        label: getClient().intlGet(guildId, 'seconds', { seconds: '3' }),
                        description: getClient().intlGet(guildId, 'secondsCommandDelay', {
                            seconds: getClient().intlGet(guildId, 'three')
                        }),
                        value: '3'
                    },
                    {
                        label: getClient().intlGet(guildId, 'seconds', { seconds: '4' }),
                        description: getClient().intlGet(guildId, 'secondsCommandDelay', {
                            seconds: getClient().intlGet(guildId, 'four')
                        }),
                        value: '4'
                    },
                    {
                        label: getClient().intlGet(guildId, 'seconds', { seconds: '5' }),
                        description: getClient().intlGet(guildId, 'secondsCommandDelay', {
                            seconds: getClient().intlGet(guildId, 'five')
                        }),
                        value: '5'
                    },
                    {
                        label: getClient().intlGet(guildId, 'seconds', { seconds: '6' }),
                        description: getClient().intlGet(guildId, 'secondsCommandDelay', {
                            seconds: getClient().intlGet(guildId, 'six')
                        }),
                        value: '6'
                    },
                    {
                        label: getClient().intlGet(guildId, 'seconds', { seconds: '7' }),
                        description: getClient().intlGet(guildId, 'secondsCommandDelay', {
                            seconds: getClient().intlGet(guildId, 'seven')
                        }),
                        value: '7'
                    },
                    {
                        label: getClient().intlGet(guildId, 'seconds', { seconds: '8' }),
                        description: getClient().intlGet(guildId, 'secondsCommandDelay', {
                            seconds: getClient().intlGet(guildId, 'eight')
                        }),
                        value: '8'
                    }]
            }));
    },

    getSmartSwitchSelectMenu: function (guildId, serverId, entityId) {
        const instance = getClient().getInstance(guildId);
        const entity = instance.serverList[serverId].switches[entityId];
        const identifier = JSON.stringify({ "serverId": serverId, "entityId": entityId });

        const autoSetting = getClient().intlGet(guildId, 'autoSettingCap');
        const off = getClient().intlGet(guildId, 'offCap');
        const autoDay = getClient().intlGet(guildId, 'autoDayCap');
        const autoNight = getClient().intlGet(guildId, 'autoNightCap');
        const autoOn = getClient().intlGet(guildId, 'autoOnCap');
        const autoOff = getClient().intlGet(guildId, 'autoOffCap');
        const autoOnProximity = getClient().intlGet(guildId, 'autoOnProximityCap');
        const autoOffProximity = getClient().intlGet(guildId, 'autoOffProximityCap');
        const autoOnAnyOnline = getClient().intlGet(guildId, 'autoOnAnyOnlineCap');
        const autoOffAnyOnline = getClient().intlGet(guildId, 'autoOffAnyOnlineCap');

        let autoDayNightOnOffString = autoSetting;
        if (entity.autoDayNightOnOff === 0) autoDayNightOnOffString += off;
        else if (entity.autoDayNightOnOff === 1) autoDayNightOnOffString += autoDay;
        else if (entity.autoDayNightOnOff === 2) autoDayNightOnOffString += autoNight;
        else if (entity.autoDayNightOnOff === 3) autoDayNightOnOffString += autoOn;
        else if (entity.autoDayNightOnOff === 4) autoDayNightOnOffString += autoOff;
        else if (entity.autoDayNightOnOff === 5) autoDayNightOnOffString += autoOnProximity;
        else if (entity.autoDayNightOnOff === 6) autoDayNightOnOffString += autoOffProximity;
        else if (entity.autoDayNightOnOff === 7) autoDayNightOnOffString += autoOnAnyOnline;
        else if (entity.autoDayNightOnOff === 8) autoDayNightOnOffString += autoOffAnyOnline;

        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
                customId: `AutoDayNightOnOff${identifier}`,
                placeholder: `${autoDayNightOnOffString}`,
                options: [
                    {
                        label: off,
                        description: getClient().intlGet(guildId, 'smartSwitchNormal'),
                        value: '0'
                    },
                    {
                        label: autoDay,
                        description: getClient().intlGet(guildId, 'smartSwitchAutoDay'),
                        value: '1'
                    },
                    {
                        label: autoNight,
                        description: getClient().intlGet(guildId, 'smartSwitchAutoNight'),
                        value: '2'
                    },
                    {
                        label: autoOn,
                        description: getClient().intlGet(guildId, 'smartSwitchAutoOn'),
                        value: '3'
                    },
                    {
                        label: autoOff,
                        description: getClient().intlGet(guildId, 'smartSwitchAutoOff'),
                        value: '4'
                    },
                    {
                        label: autoOnProximity,
                        description: getClient().intlGet(guildId, 'smartSwitchAutoOnProximity'),
                        value: '5'
                    },
                    {
                        label: autoOffProximity,
                        description: getClient().intlGet(guildId, 'smartSwitchAutoOffProximity'),
                        value: '6'
                    },
                    {
                        label: autoOnAnyOnline,
                        description: getClient().intlGet(guildId, 'smartSwitchAutoOnAnyOnline'),
                        value: '7'
                    },
                    {
                        label: autoOffAnyOnline,
                        description: getClient().intlGet(guildId, 'smartSwitchAutoOffAnyOnline'),
                        value: '8'
                    }]
            }));
    },

    getVoiceGenderSelectMenu: function (guildId, gender) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
                customId: 'VoiceGender',
                placeholder: `${gender === 'male' ?
                    getClient().intlGet(guildId, 'commandsVoiceMale') :
                    getClient().intlGet(guildId, 'commandsVoiceFemale')}`,
                options: [
                    {
                        label: getClient().intlGet(guildId, 'commandsVoiceMale'),
                        description: getClient().intlGet(guildId, 'commandsVoiceMaleDescription'),
                        value: 'male'
                    },
                    {
                        label: getClient().intlGet(guildId, 'commandsVoiceFemale'),
                        description: getClient().intlGet(guildId, 'commandsVoiceFemaleDescription'),
                        value: 'female'
                    }]
            }));
    },
}