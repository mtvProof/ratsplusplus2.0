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

const { buildStreamDeckCountUrl } = require('../util/StreamDeckWebhook');
let MRC_KEYS = {};
try { MRC_KEYS = require('../discordTools/MainResourcesCompsBox'); } catch {}
const RES_KEYS  = MRC_KEYS.RESOURCE_KEYS  || ['Wood','Stones','Metal Fragments','High Quality Metal','Leather','Diesel Fuel','Sulfur','Cloth','Animal Fat','Charcoal','Explosives','Gun Powder','Scrap'];
const COMP_KEYS = MRC_KEYS.COMPONENT_KEYS || ['Tech Trash','CCTV Camera','Targeting Computer','Metal Pipe','Rifle Body','Gears','Semi Automatic Body','Road Signs','SMG Body','Sewing Kit','Rope','Metal Blade','Tarp','Electric Fuse','Sheet Metal','Metal Spring'];
const BOOM_KEYS = MRC_KEYS.BOOM_KEYS      || ['Rocket','High Velocity Rocket','Incendiary Rocket','C4','Satchel Charge','MLRS Rocket','MLRS Aiming Module','Explosive 5.56 Rifle Ammo'];


const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');


const Discord = require('discord.js');
const { buildStreamDeckUrl, buildStreamDeckStatusUrl } = require('../util/StreamDeckWebhook');


const Config = require('../../config');
const DiscordMessages = require('../discordTools/discordMessages.js');
const DiscordTools = require('../discordTools/discordTools.js');
const SmartSwitchGroupHandler = require('./smartSwitchGroupHandler.js');
const DiscordButtons = require('../discordTools/discordButtons.js');
const DiscordModals = require('../discordTools/discordModals.js');
const getClient = require('../util/getClient');

function safeParse(str) {
  try { return JSON.parse(str); }
  catch { return null; }
}


module.exports = async (client, interaction) => {
    const instance = client.getInstance(interaction.guildId);
    const guildId = interaction.guildId;
    const rustplus = client.rustplusInstances[guildId];

    const verifyId = Math.floor(100000 + Math.random() * 900000);
    client.logInteraction(interaction, verifyId, 'userButton');

    if (instance.blacklist['discordIds'].includes(interaction.user.id) &&
        !interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userPartOfBlacklist', {
            id: `${verifyId}`,
            user: `${interaction.user.username} (${interaction.user.id})`
        }));
        return;
    }

    if (interaction.customId.startsWith('DiscordNotification')) {
const ids = safeParse(interaction.customId.replace('DiscordNotification', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const setting = instance.notificationSettings[ids.setting];

        setting.discord = !setting.discord;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.notificationSettings[ids.setting].discord = setting.discord;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${setting.discord}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getNotificationButtons(
                guildId, ids.setting, setting.discord, setting.inGame, setting.voice)]
        });
    }
    else if (interaction.customId.startsWith('InGameNotification')) {
const ids = safeParse(interaction.customId.replace('InGameNotification', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const setting = instance.notificationSettings[ids.setting];

        setting.inGame = !setting.inGame;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.notificationSettings[ids.setting].inGame = setting.inGame;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${setting.inGame}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getNotificationButtons(
                guildId, ids.setting, setting.discord, setting.inGame, setting.voice)]
        });
    }
    else if (interaction.customId.startsWith('VoiceNotification')) {
const ids = safeParse(interaction.customId.replace('VoiceNotification', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const setting = instance.notificationSettings[ids.setting];

        setting.voice = !setting.voice;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.notificationSettings[ids.setting].voice = setting.voice;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${setting.voice}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getNotificationButtons(
                guildId, ids.setting, setting.discord, setting.inGame, setting.voice)]
        });
    }
    else if (interaction.customId === 'AllowInGameCommands') {
        instance.generalSettings.inGameCommandsEnabled = !instance.generalSettings.inGameCommandsEnabled;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.inGameCommandsEnabled = instance.generalSettings.inGameCommandsEnabled;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.inGameCommandsEnabled}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getInGameCommandsEnabledButton(guildId,
                instance.generalSettings.inGameCommandsEnabled)]
        });
    }
    else if (interaction.isButton() && interaction.customId === 'MrcWebhooks') {
  const gid = interaction.guildId;

   // Build full text blocks, then chunk to ≤2000 characters per message
   const mkBlock = (title, keys) => {
     const parts = [`**${title}**`];
     for (const k of keys) {
       parts.push(`• ${k}`);
       parts.push(buildStreamDeckCountUrl(client, gid, k, 'txt'));
     }
     return parts.join('\n');
   };

   const blocks = [
     mkBlock('Resources', RES_KEYS),
     mkBlock('Components', COMP_KEYS),
     mkBlock('Boom', BOOM_KEYS)
   ];

   // Ack fast to avoid "Unknown interaction"
   await interaction.deferReply({ ephemeral: true });

   const MAX = 1800; // safety margin under Discord’s 2000
   let first = true;
   for (const b of blocks) {
     // send b in chunks of MAX
    let i = 0;
    while (i < b.length) {
      const chunk = b.slice(i, i + MAX);
      if (first) {
        await interaction.editReply({ content: chunk });
        first = false;
      } else {
        await interaction.followUp({ content: chunk, ephemeral: true });
      }
      i += MAX;
    }
   }
   return;

  return;
}

else if (interaction.customId === 'BaseCodeEdit') {
  const guildId = interaction.guildId;
  const current = client.getInstance(guildId)?.generalSettings?.baseCode ?? '';

  const modal = new ModalBuilder()
    .setCustomId('BaseCodeEditModal')
    .setTitle(client.intlGet(guildId, 'baseCodesHeader'));

  const input = new TextInputBuilder()
    .setCustomId('BaseCodeInput')
    .setLabel(client.intlGet(guildId, 'baseCodeCurrent'))
    .setPlaceholder('1234 (leave blank to clear)')
    .setStyle(TextInputStyle.Short)
    .setMinLength(0)          // allow clearing
    .setMaxLength(4)
    .setRequired(false);      // allow empty submit

  // Only prefill if we have a valid 4-digit code
  if (/^\d{4}$/.test(current)) input.setValue(current);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
  return;
}
 else if (interaction.customId === 'CodeCommandEnabled') {
   const guildId = interaction.guildId;
  const instance = client.getInstance(guildId);
  if (!instance.generalSettings) instance.generalSettings = {};

  const cur = instance.generalSettings.codeCommandEnabled !== false; // default true
  instance.generalSettings.codeCommandEnabled = !cur;
  client.setInstance(guildId, instance);

  // Update this message's buttons inline
  await client.interactionUpdate(interaction, {
    components: [DiscordButtons.getBaseCodeButtons(
      guildId,
      instance.generalSettings.codeCommandEnabled
    )]
  });
}

    else if (interaction.customId === 'BotMutedInGame') {
        instance.generalSettings.muteInGameBotMessages = !instance.generalSettings.muteInGameBotMessages;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.muteInGameBotMessages = instance.generalSettings.muteInGameBotMessages;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.muteInGameBotMessages}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getBotMutedInGameButton(guildId,
                instance.generalSettings.muteInGameBotMessages)]
        });
    }

else if (interaction.isButton() && interaction.customId.startsWith('GroupWebhooks')) {
  try {
    const idJson = interaction.customId.replace(/^GroupWebhooks/, '');
    const { serverId, groupId } = JSON.parse(idJson);

    const instance = client.getInstance(interaction.guildId);
    const group = instance?.serverList?.[serverId]?.switchGroups?.[groupId];
    const groupName = (group?.name || group?.title || `Group-${groupId}`).toString();

    // Build the copyable URL (uses active/connected server at runtime)
    const url = buildStreamDeckUrl(client, interaction.guildId, groupName, 'toggle');
    const statusUrl = buildStreamDeckStatusUrl(client, interaction.guildId, groupName, 'txt');


    // Helpful hint if base wasn't configured via env var
    const sdBase = instance?.generalSettings?.streamdeck?.base;
    const hint = (process.env.STREAMDECK_PUBLIC_BASE ? '' :
      '\n\n*Tip:* set `STREAMDECK_PUBLIC_BASE` in your env to your public host:port for a fully correct URL.');

await interaction.reply({
  content:
    `**Copy this into your Stream Deck button (TOGGLE):**\n\`${url}\`\n\n` +
    `**Status URL (returns ON/OFF):**\n\`${statusUrl}\`\n\n` +
    `• Change \`action=toggle\` to \`on\` or \`off\` if you want.\n` +
    `• Group: **${groupName}**` +
    (process.env.STREAMDECK_PUBLIC_BASE ? '' :
      '\n\n*Tip:* set `STREAMDECK_PUBLIC_BASE` in your env to your public host:port for a fully correct URL.'),
  ephemeral: true
});
  } catch (e) {
    await interaction.reply({ content: `Could not build webhook URL: \`${e.message}\``, ephemeral: true });
  }
  return;
}
else if (interaction.customId === 'MrcWebhooks') {
  const { RESOURCE_KEYS, COMPONENT_KEYS, BOOM_KEYS } =
    require('../discordTools/MainResourcesCompsBox');
  const { buildStreamDeckCountUrl } =
    require('../util/StreamDeckWebhook');
  const Discord = require('discord.js');

  const gid = interaction.guildId;

  const make = (bucket, keys) =>
    keys.map(k => `${k}: ${buildStreamDeckCountUrl(client, gid, bucket, k, 'txt')}`).join('\n');

  const body =
    '[RESOURCES]\n'  + make('resources',  RESOURCE_KEYS) + '\n\n' +
    '[COMPONENTS]\n' + make('components', COMPONENT_KEYS) + '\n\n' +
    '[BOOM]\n'       + make('boom',       BOOM_KEYS || []);

  const file = new Discord.AttachmentBuilder(Buffer.from(body, 'utf8'),
                                             { name: 'mrc-webhooks.txt' });

  await interaction.reply({
    content: 'Here are copy-paste links for each item (plain number response).',
    files: [file],
    ephemeral: true
  });
  return;
}


    else if (interaction.customId === 'InGameTeammateConnection') {
        instance.generalSettings.connectionNotify = !instance.generalSettings.connectionNotify;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.connectionNotify = instance.generalSettings.connectionNotify;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.connectionNotify}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getInGameTeammateNotificationsButtons(guildId)]
        });
    }
    else if (interaction.customId === 'InGameTeammateAfk') {
        instance.generalSettings.afkNotify = !instance.generalSettings.afkNotify;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.afkNotify = instance.generalSettings.afkNotify;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.afkNotify}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getInGameTeammateNotificationsButtons(guildId)]
        });
    }
    else if (interaction.customId === 'InGameTeammateDeath') {
        instance.generalSettings.deathNotify = !instance.generalSettings.deathNotify;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.deathNotify = instance.generalSettings.deathNotify;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.deathNotify}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getInGameTeammateNotificationsButtons(guildId)]
        });
    }
    else if (interaction.customId === 'FcmAlarmNotification') {
        instance.generalSettings.fcmAlarmNotificationEnabled = !instance.generalSettings.fcmAlarmNotificationEnabled;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.fcmAlarmNotificationEnabled =
            instance.generalSettings.fcmAlarmNotificationEnabled;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.fcmAlarmNotificationEnabled}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getFcmAlarmNotificationButtons(
                guildId,
                instance.generalSettings.fcmAlarmNotificationEnabled,
                instance.generalSettings.fcmAlarmNotificationEveryone)]
        });
    }
    else if (interaction.customId === 'FcmAlarmNotificationEveryone') {
        instance.generalSettings.fcmAlarmNotificationEveryone = !instance.generalSettings.fcmAlarmNotificationEveryone;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.fcmAlarmNotificationEveryone =
            instance.generalSettings.fcmAlarmNotificationEveryone;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.fcmAlarmNotificationEveryone}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getFcmAlarmNotificationButtons(
                guildId,
                instance.generalSettings.fcmAlarmNotificationEnabled,
                instance.generalSettings.fcmAlarmNotificationEveryone)]
        });
    }
    else if (interaction.customId === 'SmartAlarmNotifyInGame') {
        instance.generalSettings.smartAlarmNotifyInGame = !instance.generalSettings.smartAlarmNotifyInGame;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.smartAlarmNotifyInGame =
            instance.generalSettings.smartAlarmNotifyInGame;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.smartAlarmNotifyInGame}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getSmartAlarmNotifyInGameButton(
                guildId,
                instance.generalSettings.smartAlarmNotifyInGame)]
        });
    }
    else if (interaction.customId === 'SmartSwitchNotifyInGameWhenChangedFromDiscord') {
        instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord =
            !instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord =
            instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getSmartSwitchNotifyInGameWhenChangedFromDiscordButton(
                guildId,
                instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord)]
        });
    }
    else if (interaction.customId === 'LeaderCommandEnabled') {
        instance.generalSettings.leaderCommandEnabled = !instance.generalSettings.leaderCommandEnabled;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.leaderCommandEnabled = instance.generalSettings.leaderCommandEnabled;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.leaderCommandEnabled}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getLeaderCommandEnabledButton(
                guildId,
                instance.generalSettings.leaderCommandEnabled)]
        });
    }
    else if (interaction.customId === 'LeaderCommandOnlyForPaired') {
        instance.generalSettings.leaderCommandOnlyForPaired = !instance.generalSettings.leaderCommandOnlyForPaired;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.leaderCommandOnlyForPaired =
            instance.generalSettings.leaderCommandOnlyForPaired;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.leaderCommandOnlyForPaired}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getLeaderCommandOnlyForPairedButton(
                guildId,
                instance.generalSettings.leaderCommandOnlyForPaired)]
        });
    }
    else if (interaction.customId === 'MapWipeNotifyEveryone') {
        instance.generalSettings.mapWipeNotifyEveryone = !instance.generalSettings.mapWipeNotifyEveryone;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.mapWipeNotifyEveryone =
            instance.generalSettings.mapWipeNotifyEveryone;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.mapWipeNotifyEveryone}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getMapWipeNotifyEveryoneButton(instance.generalSettings.mapWipeNotifyEveryone)]
        });
    }
    else if (interaction.customId === 'ItemAvailableNotifyInGame') {
        instance.generalSettings.itemAvailableInVendingMachineNotifyInGame =
            !instance.generalSettings.itemAvailableInVendingMachineNotifyInGame;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.itemAvailableInVendingMachineNotifyInGame =
            instance.generalSettings.itemAvailableInVendingMachineNotifyInGame;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.itemAvailableInVendingMachineNotifyInGame}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getItemAvailableNotifyInGameButton(guildId,
                instance.generalSettings.itemAvailableInVendingMachineNotifyInGame)]
        });
    }
    else if (interaction.customId === 'DisplayInformationBattlemetricsAllOnlinePlayers') {
        instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers =
            !instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.displayInformationBattlemetricsAllOnlinePlayers =
            instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getDisplayInformationBattlemetricsAllOnlinePlayersButton(guildId,
                instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers)]
        });
    }
    else if (interaction.customId === 'BattlemetricsServerNameChanges') {
        instance.generalSettings.battlemetricsServerNameChanges =
            !instance.generalSettings.battlemetricsServerNameChanges;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.battlemetricsServerNameChanges =
            instance.generalSettings.battlemetricsServerNameChanges;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.battlemetricsServerNameChanges}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId)
        });
    }
    else if (interaction.customId === 'BattlemetricsTrackerNameChanges') {
        instance.generalSettings.battlemetricsTrackerNameChanges =
            !instance.generalSettings.battlemetricsTrackerNameChanges;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.battlemetricsTrackerNameChanges =
            instance.generalSettings.battlemetricsTrackerNameChanges;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.battlemetricsTrackerNameChanges}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId)
        });
    }
    else if (interaction.customId === 'BattlemetricsGlobalNameChanges') {
        instance.generalSettings.battlemetricsGlobalNameChanges =
            !instance.generalSettings.battlemetricsGlobalNameChanges;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.battlemetricsGlobalNameChanges =
            instance.generalSettings.battlemetricsGlobalNameChanges;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.battlemetricsGlobalNameChanges}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId)
        });
    }
    else if (interaction.customId === 'BattlemetricsGlobalLogin') {
        instance.generalSettings.battlemetricsGlobalLogin =
            !instance.generalSettings.battlemetricsGlobalLogin;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.battlemetricsGlobalLogin =
            instance.generalSettings.battlemetricsGlobalLogin;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.battlemetricsGlobalLogin}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId)
        });
    }
    else if (interaction.customId === 'BattlemetricsGlobalLogout') {
        instance.generalSettings.battlemetricsGlobalLogout =
            !instance.generalSettings.battlemetricsGlobalLogout;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.battlemetricsGlobalLogout =
            instance.generalSettings.battlemetricsGlobalLogout;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.battlemetricsGlobalLogout}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId)
        });
    }
    else if (interaction.customId.startsWith('ServerConnect')) {
const ids = safeParse(interaction.customId.replace('ServerConnect', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        client.resetRustplusVariables(guildId);

        if (instance.activeServer !== null) {
            await DiscordMessages.sendServerMessage(guildId, instance.activeServer, null);
        }

        instance.activeServer = ids.serverId;
        client.setInstance(guildId, instance);

        /* Disconnect previous instance is any */
        if (rustplus) {
            rustplus.isDeleted = true;
            rustplus.disconnect();
        }

        /* Create the rustplus instance */
        const newRustplus = client.createRustplusInstance(
            guildId, server.serverIp, server.appPort, server.steamId, server.playerToken);

        await DiscordMessages.sendServerMessage(guildId, ids.serverId, null, interaction);

        newRustplus.isNewConnection = true;
    }
    else if (interaction.customId.startsWith('ServerEdit')) {
const ids = safeParse(interaction.customId.replace('ServerEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getServerEditModal(guildId, ids.serverId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('DeleteUnreachableDevices')) {
const ids = safeParse(interaction.customId.replace('DeleteUnreachableDevices', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        const groupsToUpdate = [];
        for (const [entityId, content] of Object.entries(server.switches)) {
            if (!content.reachable) {
                await DiscordTools.deleteMessageById(guildId, instance.channelId.switches, content.messageId);
                delete server.switches[entityId];

                for (const [groupId, groupContent] of Object.entries(server.switchGroups)) {
                    if (groupContent.switches.includes(`${entityId}`) && !groupsToUpdate.includes(groupId)) {
                        groupsToUpdate.push(groupId);
                    }
                }
            }
        }

        for (const groupId of groupsToUpdate) {
            await DiscordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, groupId);
        }

        for (const [entityId, content] of Object.entries(server.alarms)) {
            if (!content.reachable) {
                await DiscordTools.deleteMessageById(guildId, instance.channelId.alarms, content.messageId)
                delete server.alarms[entityId];
            }
        }

        for (const [entityId, content] of Object.entries(server.storageMonitors)) {
            if (!content.reachable) {
                await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors, content.messageId)
                delete server.storageMonitors[entityId];
            }
        }

        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('CustomTimersEdit')) {
const ids = safeParse(interaction.customId.replace('CustomTimersEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getCustomTimersEditModal(guildId, ids.serverId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('CreateTracker')) {
const ids = safeParse(interaction.customId.replace('CreateTracker', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        /* Find an available tracker id */
        const trackerId = client.findAvailableTrackerId(guildId);

        instance.trackers[trackerId] = {
            name: 'Tracker',
            serverId: ids.serverId,
            battlemetricsId: server.battlemetricsId,
            title: server.title,
            img: server.img,
            clanTag: '',
            everyone: false,
            inGame: true,
            players: [],
            messageId: null
        }
        client.setInstance(guildId, instance);

        await DiscordMessages.sendTrackerMessage(guildId, trackerId);
    }
    else if (interaction.customId.startsWith('CreateGroup')) {
const ids = safeParse(interaction.customId.replace('CreateGroup', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        const groupId = client.findAvailableGroupId(guildId, ids.serverId);

        server.switchGroups[groupId] = {
            name: 'Group',
            command: `${groupId}`,
            switches: [],
            image: 'smart_switch.png',
            messageId: null
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${groupId}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, groupId);
    }
    else if (interaction.customId.startsWith('ServerDisconnect') ||
        interaction.customId.startsWith('ServerReconnecting')) {
const ids = safeParse(interaction.customId.replace('ServerDisconnect', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }            
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }
        instance.activeServer = null;
        client.setInstance(guildId, instance);

        client.resetRustplusVariables(guildId);

        if (rustplus) {
            rustplus.isDeleted = true;
            rustplus.disconnect();
            delete client.rustplusInstances[guildId];
        }

        await DiscordMessages.sendServerMessage(guildId, ids.serverId, null, interaction);
    }
    else if (interaction.customId.startsWith('ServerDelete')) {
const ids = safeParse(interaction.customId.replace('ServerDelete', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server) {
            await interaction.message.delete();
            return;
        }

        if (rustplus && (rustplus.serverId === ids.serverId || rustplus.serverId === instance.activeServer)) {
            await DiscordTools.clearTextChannel(rustplus.guildId, instance.channelId.switches, 100);
            await DiscordTools.clearTextChannel(rustplus.guildId, instance.channelId.switchGroups, 100);
            await DiscordTools.clearTextChannel(rustplus.guildId, instance.channelId.storageMonitors, 100);

            instance.activeServer = null;
            client.setInstance(guildId, instance);

            client.resetRustplusVariables(guildId);

            rustplus.isDeleted = true;
            rustplus.disconnect();
            delete client.rustplusInstances[guildId];
        }

        for (const [entityId, content] of Object.entries(server.alarms)) {
            await DiscordTools.deleteMessageById(guildId, instance.channelId.alarms, content.messageId);
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.servers, server.messageId);

        delete instance.serverList[ids.serverId];
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('SmartSwitchOn') ||
        interaction.customId.startsWith('SmartSwitchOff')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchOn', '').replace('SmartSwitchOff', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        if (!rustplus || (rustplus && (rustplus.serverId !== ids.serverId))) {
            interaction.deferUpdate();
            return;
        }

        clearTimeout(rustplus.currentSwitchTimeouts[ids.entityId]);
        delete rustplus.currentSwitchTimeouts[ids.entityId];

        const active = (interaction.customId.startsWith('SmartSwitchOn')) ? true : false;
        const prevActive = server.switches[ids.entityId].active;
        server.switches[ids.entityId].active = active;
        client.setInstance(guildId, instance);

        rustplus.interactionSwitches.push(ids.entityId);

        const response = await rustplus.turnSmartSwitchAsync(ids.entityId, active);
        if (!(await rustplus.isResponseValid(response))) {
            if (server.switches[ids.entityId].reachable) {
                await DiscordMessages.sendSmartSwitchNotFoundMessage(guildId, ids.serverId, ids.entityId);
            }
            server.switches[ids.entityId].reachable = false;
            server.switches[ids.entityId].active = prevActive;
            client.setInstance(guildId, instance);

            rustplus.interactionSwitches = rustplus.interactionSwitches.filter(e => e !== ids.entityId);
        }
        else {
            server.switches[ids.entityId].reachable = true;
            client.setInstance(guildId, instance);
        }

        if (instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord) {
            const user = interaction.user.username;
            const name = server.switches[ids.entityId].name;
            const status = active ? client.intlGet(guildId, 'onCap') : client.intlGet(guildId, 'offCap');
            const str = client.intlGet(guildId, 'userTurnedOnOffSmartSwitchFromDiscord', {
                user: user,
                name: name,
                status: status
            });

            await rustplus.sendInGameMessage(str);
        }

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${active}`
        }));

        DiscordMessages.sendSmartSwitchMessage(guildId, ids.serverId, ids.entityId, interaction);
        SmartSwitchGroupHandler.updateSwitchGroupIfContainSwitch(client, guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('SmartSwitchEdit')) {
const ids = safeParse(interaction.customId.replace('SmartSwitchEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getSmartSwitchEditModal(guildId, ids.serverId, ids.entityId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('SmartSwitchDelete')) {
const ids = safeParse(interaction.customId.replace('SmartSwitchDelete', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.switches,
            server.switches[ids.entityId].messageId);

        delete server.switches[ids.entityId];
        client.setInstance(guildId, instance);

        if (rustplus) {
            clearTimeout(rustplus.currentSwitchTimeouts[ids.entityId]);
            delete rustplus.currentSwitchTimeouts[ids.entityId];
        }

        for (const [groupId, content] of Object.entries(server.switchGroups)) {
            if (content.switches.includes(ids.entityId.toString())) {
                server.switchGroups[groupId].switches = content.switches.filter(e => e !== ids.entityId.toString());
                client.setInstance(guildId, instance);
                await DiscordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, groupId);
            }
        }
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('SmartAlarmEveryone')) {
const ids = safeParse(interaction.customId.replace('SmartAlarmEveryone', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.alarms.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        server.alarms[ids.entityId].everyone = !server.alarms[ids.entityId].everyone;
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${server.alarms[ids.entityId].everyone}`
        }));

        await DiscordMessages.sendSmartAlarmMessage(guildId, ids.serverId, ids.entityId, interaction);
    }
    else if (interaction.customId.startsWith('SmartAlarmNotify')) {
const ids = safeParse(interaction.customId.replace('SmartAlarmNotify', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
  const server = instance.serverList[ids.serverId];

  if (!server || !server.alarms.hasOwnProperty(ids.entityId)) {
    await interaction.message.delete();
    return;
  }

  const cur = server.alarms[ids.entityId].notify !== false; // default ON
  server.alarms[ids.entityId].notify = !cur;
  client.setInstance(guildId, instance);

  client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
    id: `${verifyId}`,
    value: `${server.alarms[ids.entityId].notify}`
  }));

  // Re-render the alarm card in-place (edits the existing message)
  await DiscordMessages.sendSmartAlarmMessage(guildId, ids.serverId, ids.entityId, interaction);
}
    else if (interaction.customId.startsWith('SmartAlarmDelete')) {
const ids = safeParse(interaction.customId.replace('SmartAlarmDelete', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server || (server && !server.alarms.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.alarms,
            server.alarms[ids.entityId].messageId);

        delete server.alarms[ids.entityId];
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('SmartAlarmEdit')) {
const ids = safeParse(interaction.customId.replace('SmartAlarmEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.alarms.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getSmartAlarmEditModal(guildId, ids.serverId, ids.entityId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('StorageMonitorToolCupboardEveryone')) {
const ids = safeParse(interaction.customId.replace('StorageMonitorToolCupboardEveryone', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.storageMonitors.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        server.storageMonitors[ids.entityId].everyone = !server.storageMonitors[ids.entityId].everyone;
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${server.storageMonitors[ids.entityId].everyone}`
        }));

        await DiscordMessages.sendStorageMonitorMessage(guildId, ids.serverId, ids.entityId, interaction);
    }
    else if (interaction.customId.startsWith('StorageMonitorToolCupboardInGame')) {
const ids = safeParse(interaction.customId.replace('StorageMonitorToolCupboardInGame', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.storageMonitors.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        server.storageMonitors[ids.entityId].inGame = !server.storageMonitors[ids.entityId].inGame;
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${server.storageMonitors[ids.entityId].inGame}`
        }));

        await DiscordMessages.sendStorageMonitorMessage(guildId, ids.serverId, ids.entityId, interaction);
    }
    else if (interaction.customId.startsWith('StorageMonitorEdit')) {
const ids = safeParse(interaction.customId.replace('StorageMonitorEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.storageMonitors.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getStorageMonitorEditModal(guildId, ids.serverId, ids.entityId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('StorageMonitorToolCupboardDelete')) {
const ids = safeParse(interaction.customId.replace('StorageMonitorToolCupboardDelete', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server || (server && !server.storageMonitors.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors,
            server.storageMonitors[ids.entityId].messageId);

        delete server.storageMonitors[ids.entityId];
        client.setInstance(guildId, instance);
    }

    else if (interaction.customId.startsWith('StorageMonitorToolCupboardUpkeepSet')) {
const ids = safeParse(interaction.customId.replace('StorageMonitorToolCupboardUpkeepSet', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
  const sm = instance.serverList?.[ids.serverId]?.storageMonitors?.[ids.entityId];
  const preset = (sm?.tcDailyUpkeep) || {};

  const modal = new ModalBuilder()
    .setCustomId('TCUpkeepEdit' + JSON.stringify(ids))
    .setTitle('Set TC Daily Upkeep');

  const mkInput = (id, label, presetVal = '') =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label + ' per 24h')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('0')
        .setValue(String(presetVal ?? ''))
    );

  modal.addComponents(
    mkInput('upkeep_wood',   'Wood',           preset.wood),
    mkInput('upkeep_stones', 'Stones',         preset.stones),
    mkInput('upkeep_frags',  'Metal Fragments',preset['metal.fragments']),
    mkInput('upkeep_hqm',    'HQM (Refined)',  preset['metal.refined'])
  );
  await interaction.showModal(modal);
  return;
}

    
else if (interaction.customId.startsWith('StorageMonitorToolCupboardUpkeep')) {
const ids = safeParse(interaction.customId.replace('StorageMonitorToolCupboardUpkeep', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
  const server = instance.serverList[ids.serverId];

  if (!server || !server.storageMonitors?.hasOwnProperty(ids.entityId)) {
    // initial response (no modal path), safe to reply
    await interaction.reply({ content: 'Storage monitor not found.', ephemeral: true }).catch(() => {});
    return;
  }

  const sm = server.storageMonitors[ids.entityId];
  const saved = sm.tcDailyUpkeep || null;
  const hasDaily = !!saved && (
    Number(saved.wood) > 0 ||
    Number(saved.stones) > 0 ||
    Number(saved['metal.fragments']) > 0 ||
    Number(saved['metal.refined']) > 0
  );

  // ---- If we DON'T have saved upkeep yet: show the modal FIRST (no defer/reply beforehand) ----
  if (!hasDaily) {
    const modal = new ModalBuilder()
      .setCustomId('TCUpkeepEdit' + JSON.stringify(ids))
      .setTitle('Set TC Daily Upkeep');

    const mkInput = (id, label, preset = '') =>
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(id)
          .setLabel(label + ' per 24h')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('0')
          .setValue(String(preset ?? ''))
      );

    const preset = saved || {};
    modal.addComponents(
      mkInput('upkeep_wood',   'Wood',           preset.wood),
      mkInput('upkeep_stones', 'Stones',         preset.stones),
      mkInput('upkeep_frags',  'Metal Fragments',preset['metal.fragments']),
      mkInput('upkeep_hqm',    'HQM (Refined)',  preset['metal.refined'])
    );

    // IMPORTANT: do not defer or reply before showing a modal
    await interaction.showModal(modal).catch(() => {});
    return;
  }

  // ---- We DO have saved daily upkeep → now we can defer and compute ----
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  const daily = {
    wood: Number(saved.wood) || 0,
    stones: Number(saved.stones) || 0,
    'metal.fragments': Number(saved['metal.fragments']) || 0,
    'metal.refined': Number(saved['metal.refined']) || 0
  };

  // Calculator: 24 slots, stacks (wood/stone/frags=1000, HQM=100)
  const MAX_SLOTS = 24;
  const STACK = { wood: 1000, stones: 1000, 'metal.fragments': 1000, 'metal.refined': 100 };
  const KEYS = ['wood', 'stones', 'metal.fragments', 'metal.refined'];

  const slotsUsed = (T) => KEYS.reduce(
    (sum, k) => sum + Math.ceil(((daily[k] || 0) * T) / STACK[k]), 0
  );

  let lo = 0, hi = 1;
  while (slotsUsed(hi) <= MAX_SLOTS) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (slotsUsed(mid) <= MAX_SLOTS) lo = mid; else hi = mid;
  }
  const T = lo;

  const out = {
    wood: Math.ceil((daily.wood || 0) * T),
    stones: Math.ceil((daily.stones || 0) * T),
    'metal.fragments': Math.ceil((daily['metal.fragments'] || 0) * T),
    'metal.refined': Math.ceil((daily['metal.refined'] || 0) * T)
  };

  const payload = [
    {
      "TargetCategory": null,
      "MaxAmountInOutput": out.wood || 0,
      "BufferAmount": 0,
      "MinAmountInInput": 0,
      "IsBlueprint": false,
      "BufferTransferRemaining": 0,
      "TargetItemName": "wood"
    },
    {
      "TargetCategory": null,
      "MaxAmountInOutput": out.stones || 0,
      "BufferAmount": 0,
      "MinAmountInInput": 0,
      "IsBlueprint": false,
      "BufferTransferRemaining": 0,
      "TargetItemName": "stones"
    },
    {
      "TargetCategory": null,
      "MaxAmountInOutput": out['metal.fragments'] || 0,
      "BufferAmount": 0,
      "MinAmountInInput": 0,
      "IsBlueprint": false,
      "BufferTransferRemaining": 0,
      "TargetItemName": "metal.fragments"
    },
    {
      "TargetCategory": null,
      "MaxAmountInOutput": out['metal.refined'] || 0,
      "BufferAmount": 0,
      "MinAmountInInput": 0,
      "IsBlueprint": false,
      "BufferTransferRemaining": 0,
      "TargetItemName": "metal.refined"
    }
  ];

  await interaction.editReply({
    content: '```json\n' + JSON.stringify(payload, null, 2) + '\n```',
    ephemeral: true
  }).catch(() => {});
  return;
}



else if (interaction.customId.startsWith('StorageMonitorRecycle')) {
const ids = safeParse(interaction.customId.replace('StorageMonitorRecycle', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.storageMonitors.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        if (!rustplus || (rustplus && rustplus.serverId !== ids.serverId)) return;

        const entityInfo = await rustplus.getEntityInfoAsync(ids.entityId);
        if (!(await rustplus.isResponseValid(entityInfo))) {
            if (server.storageMonitors[ids.entityId].reachable) {
                await DiscordMessages.sendStorageMonitorNotFoundMessage(guildId, ids.serverId, ids.entityId);
            }
            server.storageMonitors[ids.entityId].reachable = false;
            client.setInstance(guildId, instance);

            await DiscordMessages.sendStorageMonitorMessage(guildId, ids.serverId, ids.entityId);
            return;
        }

        // Ensure entityInfo contains payload before attempting to read items
        if (!entityInfo || !entityInfo.entityInfo || !entityInfo.entityInfo.payload) {
            if (server.storageMonitors[ids.entityId].reachable) {
                await DiscordMessages.sendStorageMonitorNotFoundMessage(guildId, ids.serverId, ids.entityId);
            }
            server.storageMonitors[ids.entityId].reachable = false;
            client.setInstance(guildId, instance);

            await DiscordMessages.sendStorageMonitorMessage(guildId, ids.serverId, ids.entityId);
            return;
        }

        server.storageMonitors[ids.entityId].reachable = true;
        client.setInstance(guildId, instance);

        const items = client.rustlabs.getRecycleDataFromArray(entityInfo.entityInfo.payload.items);

        const message = await DiscordMessages.sendStorageMonitorRecycleMessage(
            guildId, ids.serverId, ids.entityId, items);

        setTimeout(async () => {
            await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors, message.id);
        }, 30000);
    }
    else if (interaction.customId.startsWith('StorageMonitorContainerDelete')) {
const ids = safeParse(interaction.customId.replace('StorageMonitorContainerDelete', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server || (server && !server.storageMonitors.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors,
            server.storageMonitors[ids.entityId].messageId);

        delete server.storageMonitors[ids.entityId];
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId === 'RecycleDelete') {
        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        await interaction.message.delete();
    }
    else if (interaction.customId.startsWith('GroupTurnOn') ||
        interaction.customId.startsWith('GroupTurnOff')) {
        const ids = JSON.parse(interaction.customId.replace('GroupTurnOn', '').replace('GroupTurnOff', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        if (rustplus) {
            clearTimeout(rustplus.currentSwitchTimeouts[ids.groupId]);
            delete rustplus.currentSwitchTimeouts[ids.groupId];

            if (rustplus.serverId === ids.serverId) {
                const active = (interaction.customId.startsWith('GroupTurnOn') ? true : false);

                if (instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord) {
                    const user = interaction.user.username;
                    const name = server.switchGroups[ids.groupId].name;
                    const status = active ? client.intlGet(guildId, 'onCap') : client.intlGet(guildId, 'offCap');
                    const str = client.intlGet(guildId, 'userTurnedOnOffSmartSwitchGroupFromDiscord', {
                        user: user,
                        name: name,
                        status: status
                    });

                    await rustplus.sendInGameMessage(str);
                }

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
                    id: `${verifyId}`,
                    value: `${active}`
                }));

                await SmartSwitchGroupHandler.TurnOnOffGroup(
                    client, rustplus, guildId, ids.serverId, ids.groupId, active);
            }
        }
    }
    else if (interaction.customId.startsWith('GroupEdit')) {
const ids = safeParse(interaction.customId.replace('GroupEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getGroupEditModal(guildId, ids.serverId, ids.groupId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('GroupDelete')) {
const ids = safeParse(interaction.customId.replace('GroupDelete', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        if (rustplus) {
            clearTimeout(rustplus.currentSwitchTimeouts[ids.groupId]);
            delete rustplus.currentSwitchTimeouts[ids.groupId];
        }

        if (server.switchGroups.hasOwnProperty(ids.groupId)) {
            await DiscordTools.deleteMessageById(guildId, instance.channelId.switchGroups,
                server.switchGroups[ids.groupId].messageId);

            delete server.switchGroups[ids.groupId];
            client.setInstance(guildId, instance);
        }
    }
    else if (interaction.customId.startsWith('GroupAddSwitch')) {
const ids = safeParse(interaction.customId.replace('GroupAddSwitch', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getGroupAddSwitchModal(guildId, ids.serverId, ids.groupId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('GroupRemoveSwitch')) {
const ids = safeParse(interaction.customId.replace('GroupRemoveSwitch', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getGroupRemoveSwitchModal(guildId, ids.serverId, ids.groupId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('TrackerEveryone')) {
const ids = safeParse(interaction.customId.replace('TrackerEveryone', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        tracker.everyone = !tracker.everyone;
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${tracker.everyone}`
        }));

        await DiscordMessages.sendTrackerMessage(guildId, ids.trackerId, interaction);
    }
    else if (interaction.customId.startsWith('TrackerUpdate')) {
const ids = safeParse(interaction.customId.replace('TrackerUpdate', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        // TODO! Remove name change icon from status

        await DiscordMessages.sendTrackerMessage(guildId, ids.trackerId, interaction);
    }
    else if (interaction.customId.startsWith('TrackerEdit')) {
const ids = safeParse(interaction.customId.replace('TrackerEdit', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getTrackerEditModal(guildId, ids.trackerId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('TrackerDelete')) {
const ids = safeParse(interaction.customId.replace('TrackerDelete', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const tracker = instance.trackers[ids.trackerId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.trackers,
            tracker.messageId);

        delete instance.trackers[ids.trackerId];
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('TrackerAddPlayer')) {
const ids = safeParse(interaction.customId.replace('TrackerAddPlayer', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getTrackerAddPlayerModal(guildId, ids.trackerId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('TrackerRemovePlayer')) {
const ids = safeParse(interaction.customId.replace('TrackerRemovePlayer', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getTrackerRemovePlayerModal(guildId, ids.trackerId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('TrackerInGame')) {
const ids = safeParse(interaction.customId.replace('TrackerInGame', ''));
if (!ids) { try { await interaction.deferUpdate(); } catch {} return; }
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        tracker.inGame = !tracker.inGame;
        client.setInstance(guildId, instance);


        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${tracker.inGame}`
        }));

        await DiscordMessages.sendTrackerMessage(guildId, ids.trackerId, interaction);
    }

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userButtonInteractionSuccess', {
        id: `${verifyId}`
    }));
}
