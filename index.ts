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

const DiscordBot = require('./src/structures/DiscordBot');

createMissingDirectories();

const client = new DiscordBot({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildVoiceStates],
    retryLimit: 2,
    restRequestTimeout: 60000,
    disableEveryone: false,
    // Memory leak fix: Limit caches to prevent infinite growth
    makeCache: Discord.Options.cacheWithLimits({
        MessageManager: 200,        // Keep last 200 messages per channel
        GuildMemberManager: 200,    // Keep up to 200 members cached
        UserManager: 200,           // Keep up to 200 users cached
        PresenceManager: 0,         // Don't cache presence data (online/offline status)
        ReactionManager: 0,         // Don't cache reactions
        ReactionUserManager: 0,     // Don't cache reaction users
        ThreadManager: 50,          // Keep up to 50 threads
        ThreadMemberManager: 0,     // Don't cache thread members
        StageInstanceManager: 0,    // Don't cache stage instances
        GuildInviteManager: 0,      // Don't cache invites
        VoiceStateManager: 200      // Keep voice states (needed for voice features)
    }),
    sweepers: {
        messages: {
            interval: 300,          // Sweep every 5 minutes
            lifetime: 1800          // Remove messages older than 30 minutes
        },
        users: {
            interval: 600,          // Sweep every 10 minutes
            filter: () => (user: any) => user.bot && user.id !== client.user.id  // Keep non-bot users
        }
    }
});

client.build();

function createMissingDirectories() {
    if (!Fs.existsSync(Path.join(__dirname, 'logs'))) {
        Fs.mkdirSync(Path.join(__dirname, 'logs'));
    }

    if (!Fs.existsSync(Path.join(__dirname, 'instances'))) {
        Fs.mkdirSync(Path.join(__dirname, 'instances'));
    }

    if (!Fs.existsSync(Path.join(__dirname, 'credentials'))) {
        Fs.mkdirSync(Path.join(__dirname, 'credentials'));
    }

    if (!Fs.existsSync(Path.join(__dirname, 'maps'))) {
        Fs.mkdirSync(Path.join(__dirname, 'maps'));
    }
}

process.on('unhandledRejection', error => {
    client.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'unhandledRejection', {
        error: error
    }), 'error');
    console.log(error);
});

process.on('uncaughtException', (err) => {
  client.log(client.intlGet(null, 'errorCap'),
             `Uncaught exception: ${err?.stack || err}`, 'error');
  // Don't exit — keep the bot running.
});

process.on('SIGINT', () => {
  client.log(client.intlGet(null, 'warningCap'), 'Received SIGINT, shutting down gracefully...');
  try { client.shutdown?.(); } catch {}
  // Give any open sockets a moment to close
  setTimeout(() => process.exit(0), 500);
});

process.on('SIGTERM', () => {
  client.log(client.intlGet(null, 'warningCap'), 'Received SIGTERM, shutting down gracefully...');
  try { client.shutdown?.(); } catch {}
  setTimeout(() => process.exit(0), 500);
});


exports.client = client;
