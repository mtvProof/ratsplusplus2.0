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
const MrcLimits = require('../discordTools/MainResourcesCompsLimits');
const DiscordEmbeds = require('../discordTools/discordEmbeds');
const MRC = require('../discordTools/MainResourcesCompsLimits');



module.exports = {
    name: 'interactionCreate',
    async execute(client, interaction) {
        const instance = client.getInstance(interaction.guildId);

        /* Check so that the interaction comes from valid channels */
        if (!Object.values(instance.channelId).includes(interaction.channelId) && !interaction.isCommand) {
            client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'interactionInvalidChannel'));
            if (interaction.isButton && interaction.isButton()) {
                try { interaction.deferUpdate(); }
                catch (e) {
                    client.log(client.intlGet(null, 'errorCap'),
                        client.intlGet(null, 'couldNotDeferInteraction'), 'error');
                }
            }
        }

        // ---- ROUTE MRC LIMITS CONTROLS FIRST ----
        // Buttons (Edit, Toggle, JSON editor, category tabs, close)
        if (interaction.isButton && interaction.isButton()) {
            const id = interaction.customId;
            if (
                id === 'mrc_limits_toggle'     ||
                id === 'mrc_limits_edit'       ||
                id === 'mrc_limits_edit_json'  ||
                id === 'mrc_cat_resources'     ||
                id === 'mrc_cat_components'    ||
                id === 'mrc_editor_close'
            ) {
                try { await MrcLimits.handleButton(interaction); }
                catch (e) {
                    client.log(client.intlGet(null, 'errorCap'), `MRC button error: ${e.message}`, 'error');
                }
                return; // prevent double-handling
            }
        }

        // Select menu (pick an item to set limit)
        if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
            if (interaction.customId === 'mrc_item_select') {
                try { await MrcLimits.handleSelect(interaction); }
                catch (e) {
                    client.log(client.intlGet(null, 'errorCap'), `MRC select error: ${e.message}`, 'error');
                }
                return; // prevent double-handling
            }
        }

        // Modals (single-item numeric modal and legacy JSON modal)
        if (
            (interaction.isModalSubmit && interaction.isModalSubmit()) ||
            interaction.type === Discord.InteractionType.ModalSubmit
        ) {
            if (
                interaction.customId === 'mrc_limits_modal' ||
                (typeof interaction.customId === 'string' && interaction.customId.startsWith('mrc_limit_modal_single:'))
            ) {
                try { await MrcLimits.handleModal(interaction); }
                catch (e) {
                    client.log(client.intlGet(null, 'errorCap'), `MRC modal error: ${e.message}`, 'error');
                }
                return; // prevent double-handling
            }
        }
        // -----------------------------------------

        if (interaction.isButton && interaction.isButton()) {
try { await require('../handlers/buttonHandler')(client, interaction); }
catch (e) {
  client.log(client.intlGet(null, 'errorCap'), `buttonHandler crashed: ${e.stack || e}`, 'error');
}
        }
        else if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
try { await require('../handlers/selectMenuHandler')(client, interaction); }
catch (e) {
  client.log(client.intlGet(null, 'errorCap'), `selectMenuHandler crashed: ${e.stack || e}`, 'error');
}
        }
        else if (interaction.type === Discord.InteractionType.ApplicationCommand) {
            const command = interaction.client.commands.get(interaction.commandName);

            /* If the command doesn't exist, return */
            if (!command) return;

            try {
                await command.execute(client, interaction);
            }
            catch (e) {
                client.log(client.intlGet(null, 'errorCap'), e, 'error');

                const str = client.intlGet(interaction.guildId, 'errorExecutingCommand');
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(null, 'errorCap'), str, 'error');
            }
        }
        else if (interaction.type === Discord.InteractionType.ModalSubmit) {
try { await require('../handlers/modalHandler')(client, interaction); }
catch (e) {
  client.log(client.intlGet(null, 'errorCap'), `modalHandler crashed: ${e.stack || e}`, 'error');
}
        }
        else {
            client.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'unknownInteraction'), 'error');

            if (interaction.isButton && interaction.isButton()) {
                try { interaction.deferUpdate(); }
                catch (e) {
                    client.log(client.intlGet(null, 'errorCap'),
                        client.intlGet(null, 'couldNotDeferInteraction'), 'error');
                }
            }
        }
    },
};
