const Discord = require('discord.js');
const Path = require('path');
const { startStreamDeckWebhook } = require('../util/StreamDeckWebhook');

const BattlemetricsHandler = require('../handlers/battlemetricsHandler.js');
const Config = require('../../config');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    // ✅ make sure container exists before writing into it
    client.fcmListenersLite = client.fcmListenersLite || {};

    for (const guild of client.guilds.cache) {
      require('../util/CreateInstanceFile')(client, guild[1]);
      require('../util/CreateCredentialsFile')(client, guild[1]);
      client.fcmListenersLite[guild[0]] = {};
    }

    client.loadGuildsIntl();
    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'loggedInAs', {
      name: client.user.tag
    }));

    try {
      await client.user.setUsername(Config.discord.username);
    } catch (e) {
      client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'ignoreSetUsername'));
    }

    try {
      await client.user.setAvatar(Path.join(__dirname, '..', 'resources/images/rustplusplus_logo.png'));
    } catch (e) {
      client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'ignoreSetAvatar'));
    }

    client.user.setPresence({
      activities: [{ name: '/help', type: Discord.ActivityType.Listening }],
      status: 'online'
    });

    client.uptimeBot = new Date();

    for (const [, guild] of client.guilds.cache) {
      try {
        await guild.members.me.setNickname(Config.discord.username);
      } catch (e) {
        client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'ignoreSetNickname'));
      }
      await client.syncCredentialsWithUsers(guild);
      await client.setupGuild(guild);
    }

    // === Ensure #information has Map + Battlemetrics on a fresh guild ===
const DiscordMessages = require('../discordTools/discordMessages.js');
const DiscordTools = require('../discordTools/discordTools.js');

for (const [, guild] of client.guilds.cache) {
  const instance = client.getInstance(guild.id);
  const rustplus = client.rustplusInstances[guild.id];

  // If Rust+ is online, write the map once and post/create the Map info message
  if (rustplus && rustplus.isOperational) {
    try {
      await rustplus.map.writeMap(false, true);
      await DiscordMessages.sendUpdateMapInformationMessage(rustplus);
    } catch (e) {
      client.log('WARN', `Map info init failed for ${guild.id}: ${e.message}`);
    }
  }

  // Try to create the Battlemetrics Online Players message if settings allow
  try {
    const showAll = instance.generalSettings?.displayInformationBattlemetricsAllOnlinePlayers;
    const activeId = instance.activeServer;
    const bmId = activeId ? instance.serverList?.[activeId]?.battlemetricsId : null;
    const canPost = showAll && bmId && client.battlemetricsInstances?.hasOwnProperty(bmId) && rustplus && rustplus.isOperational;

    if (canPost) {
      await DiscordMessages.sendUpdateBattlemetricsOnlinePlayersInformationMessage(rustplus, bmId);
    }
  } catch (e) {
    client.log('WARN', `BM players init skipped for ${guild.id}: ${e.message}`);
  }
}


    await client.updateBattlemetricsInstances();
    BattlemetricsHandler.handler(client, true);
    client.battlemetricsIntervalId = setInterval(BattlemetricsHandler.handler, 60000, client, false);

    client.createRustplusInstancesFromConfig();

    // ✅ Start Stream Deck webhook once (after instances are ready)
    if (!client._streamDeckStarted) {
      try {
        startStreamDeckWebhook(client);
        client._streamDeckStarted = true;
        client.log('INFO', '[StreamDeck] Webhook started');
      } catch (e) {
        client.log('ERROR', `[StreamDeck] Failed to start webhook: ${e.message}`);
      }
    }
  },
};
