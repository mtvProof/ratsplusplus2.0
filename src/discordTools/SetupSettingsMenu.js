/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)
    GPLv3 https://www.gnu.org/licenses/
    https://github.com/alexemanuelol/rustplusplus
*/

const Discord = require('discord.js');
const Path = require('path');
const MrcLimits = require('./MainResourcesCompsLimits');

const Constants = require('../util/constants.js');
const DiscordButtons = require('./discordButtons.js');
const DiscordEmbeds = require('./discordEmbeds.js');
const DiscordSelectMenus = require('./discordSelectMenus.js');
const DiscordTools = require('./discordTools.js');

module.exports = async (client, guild, forced = false) => {
  const instance = client.getInstance(guild.id);
  const channel = DiscordTools.getTextChannelById(guild.id, instance.channelId.settings);

  if (!channel) {
    client.log(
      client.intlGet(null, 'errorCap'),
      'SetupSettingsMenu: ' + client.intlGet(null, 'invalidGuildOrChannel'),
      'error'
    );
    return;
  }

  if (instance.firstTime || forced) {
    await DiscordTools.clearTextChannel(guild.id, instance.channelId.settings, 100);

    await setupGeneralSettings(client, guild.id, channel);
    await setupNotificationSettings(client, guild.id, channel);

    instance.firstTime = false;
    client.setInstance(guild.id, instance);
  }
};

async function setupGeneralSettings(client, guildId, channel) {
  const instance = client.getInstance(guildId);

  await client.messageSend(channel, {
    files: [new Discord.AttachmentBuilder(
      Path.join(__dirname, '..', `resources/images/settings/general_settings_logo_${instance.generalSettings.language}.png`)
    )]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'selectLanguageSetting'),
      thumbnail: `attachment://settings_logo.png`,
      fields: [{
        name: client.intlGet(guildId, 'noteCap'),
        value: client.intlGet(guildId, 'selectLanguageExtendSetting'),
        inline: true
      }]
    })],
    components: [DiscordSelectMenus.getLanguageSelectMenu(guildId, instance.generalSettings.language)],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'commandsVoiceGenderDesc'),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: [DiscordSelectMenus.getVoiceGenderSelectMenu(guildId, instance.generalSettings.voiceGender)],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'selectInGamePrefixSetting'),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: [DiscordSelectMenus.getPrefixSelectMenu(guildId, instance.generalSettings.prefix)],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'selectTrademarkSetting'),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: [DiscordSelectMenus.getTrademarkSelectMenu(guildId, instance.generalSettings.trademark)],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'shouldCommandsEnabledSetting'),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: [DiscordButtons.getInGameCommandsEnabledButton(
      guildId, instance.generalSettings.inGameCommandsEnabled
    )],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'shouldBotBeMutedSetting'),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: [DiscordButtons.getBotMutedInGameButton(
      guildId, instance.generalSettings.muteInGameBotMessages
    )],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  // === Base Codes (code + toggle) ===
  {
    const gs = instance.generalSettings || {};
    const baseCode = typeof gs.baseCode === 'string' ? gs.baseCode : '';
    const codeText = (/^\d{4}$/.test(baseCode))
      ? `**${client.intlGet(guildId, 'baseCodeCurrent')}:** \`${baseCode}\``
      : `*${client.intlGet(guildId, 'baseCodeNotSet')}*`;

    const msg = await client.messageSend(channel, {
      embeds: [DiscordEmbeds.getEmbed({
        color: Constants.COLOR_SETTINGS,
        title: client.intlGet(guildId, 'baseCodesHeader'),
        description: codeText,
        thumbnail: `attachment://settings_logo.png`
      })],
      components: [DiscordButtons.getBaseCodeButtons(
        guildId, gs.codeCommandEnabled !== false // default true
      )],
      files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
    });

    if (!instance.generalSettings) instance.generalSettings = {};
    if (!instance.generalSettings.baseCodeMessageId) {
      instance.generalSettings.baseCodeMessageId = msg.id;
      client.setInstance(guildId, instance);
    }
  }

  // === Main Resource/Comps Limits (editor/toggle + Webhooks) ===
  try {
    const mrc = MrcLimits.ensureDefaults(guildId);
    const desc = [
      `Status: **${mrc.enabled ? 'Enabled' : 'Disabled'}**`,
      'Edit to set per-item limits. The #information box shows 🟢 when total ≥ limit, 🔴 if under.'
    ].join('\n');

    const msg = await client.messageSend(channel, {
      embeds: [DiscordEmbeds.getEmbed({
        color: Constants.COLOR_SETTINGS,
        title: 'Main Resource/Comps Limits',
        description: desc,
        thumbnail: `attachment://settings_logo.png`
      })],
      // Show BOTH rows: editor/toggle + Webhooks
      components: [
        MrcLimits.getSettingsButtonsRow(guildId),
        DiscordButtons.getMainResourcesCompsLimitsButtons(guildId)
      ],
      files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
    });

    if (!instance.generalSettings) instance.generalSettings = {};
    if (!instance.generalSettings.mrcLimitsMessageId) {
      instance.generalSettings.mrcLimitsMessageId = msg.id;
      client.setInstance(guildId, instance);
    }
  } catch (e) {
    client.log('WARN', `MRC section failed: ${e.message}`);
  }

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'inGameTeamNotificationsSetting'),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: [DiscordButtons.getInGameTeammateNotificationsButtons(guildId)],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'commandDelaySetting'),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: [DiscordSelectMenus.getCommandDelaySelectMenu(guildId, instance.generalSettings.commandDelay)],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'shouldSmartAlarmNotifyNotConnectedSetting'),
      thumbnail: `attachment://settings_logo.png`,
      fields: [{
        name: client.intlGet(guildId, 'noteCap'),
        value: client.intlGet(guildId, 'smartAlarmNotifyExtendSetting'),
        inline: true
      }]
    })],
    components: [
      DiscordButtons.getFcmAlarmNotificationButtons(
        guildId,
        instance.generalSettings.fcmAlarmNotificationEnabled,
        instance.generalSettings.fcmAlarmNotificationEveryone
      )
    ],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'shouldSmartAlarmsNotifyInGameSetting'),
      thumbnail: `attachment://settings_logo.png`,
    })],
    components: [DiscordButtons.getSmartAlarmNotifyInGameButton(
      guildId, instance.generalSettings.smartAlarmNotifyInGame
    )],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'shouldSmartSwitchNotifyInGameWhenChangedFromDiscord'),
      thumbnail: `attachment://settings_logo.png`,
    })],
    components: [DiscordButtons.getSmartSwitchNotifyInGameWhenChangedFromDiscordButton(
      guildId, instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord
    )],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'shouldLeaderCommandEnabledSetting'),
      thumbnail: `attachment://settings_logo.png`,
    })],
    components: [DiscordButtons.getLeaderCommandEnabledButton(
      guildId, instance.generalSettings.leaderCommandEnabled
    )],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'shouldLeaderCommandOnlyForPairedSetting'),
      thumbnail: `attachment://settings_logo.png`,
    })],
    components: [DiscordButtons.getLeaderCommandOnlyForPairedButton(
      guildId, instance.generalSettings.leaderCommandOnlyForPaired
    )],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'mapWipeDetectedNotifySetting', { group: '@everyone' }),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: [DiscordButtons.getMapWipeNotifyEveryoneButton(
      instance.generalSettings.mapWipeNotifyEveryone
    )],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'itemAvailableNotifyInGameSetting'),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: [DiscordButtons.getItemAvailableNotifyInGameButton(
      guildId, instance.generalSettings.itemAvailableInVendingMachineNotifyInGame
    )],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'displayInformationBattlemetricsAllOnlinePlayers'),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: [DiscordButtons.getDisplayInformationBattlemetricsAllOnlinePlayersButton(
      guildId, instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers
    )],
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });

  await client.messageSend(channel, {
    embeds: [DiscordEmbeds.getEmbed({
      color: Constants.COLOR_SETTINGS,
      title: client.intlGet(guildId, 'subscribeToChangesBattlemetrics'),
      thumbnail: `attachment://settings_logo.png`
    })],
    components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId),
    files: [new Discord.AttachmentBuilder(Path.join(__dirname, '..', 'resources/images/settings_logo.png'))]
  });
}

async function setupNotificationSettings(client, guildId, channel) {
  const instance = client.getInstance(guildId);

  await client.messageSend(channel, {
    files: [new Discord.AttachmentBuilder(
      Path.join(__dirname, '..', `resources/images/settings/notification_settings_logo_${instance.generalSettings.language}.png`)
    )]
  });

  for (const setting in instance.notificationSettings) {
    await client.messageSend(channel, {
      embeds: [DiscordEmbeds.getEmbed({
        color: Constants.COLOR_SETTINGS,
        title: client.intlGet(guildId, setting),
        thumbnail: `attachment://${instance.notificationSettings[setting].image}`
      })],
      components: [
        DiscordButtons.getNotificationButtons(
          guildId,
          setting,
          instance.notificationSettings[setting].discord,
          instance.notificationSettings[setting].inGame,
          instance.notificationSettings[setting].voice
        )
      ],
      files: [new Discord.AttachmentBuilder(
        Path.join(__dirname, '..', `resources/images/events/${instance.notificationSettings[setting].image}`)
      )]
    });
  }
}
