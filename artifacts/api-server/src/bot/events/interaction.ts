import type { Interaction, Collection } from "discord.js";
import type { Command } from "../commands/types";
import { handleBloxpinButton } from "../commands/bloxpin";
import { handleTicketButton } from "../commands/ticket";
import { handleGiveawayButton } from "../commands/utility";
import { logger } from "../../lib/logger";

export async function onInteractionCreate(
  interaction: Interaction,
  commands: Collection<string, Command>,
): Promise<void> {
  if (interaction.isButton()) {
    const { customId } = interaction;
    try {
      if (customId.startsWith("bloxpin_")) {
        await handleBloxpinButton(interaction);
      } else if (customId.startsWith("ticket_")) {
        await handleTicketButton(interaction);
      } else if (customId === "giveaway_enter") {
        await handleGiveawayButton(interaction);
      }
    } catch (err) {
      logger.error({ err, customId }, "Button handler error");
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "⚠️ حدث خطأ.", ephemeral: true });
        }
      } catch { /* ignore */ }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    logger.error({ err, command: interaction.commandName }, "Command error");
    const msg = "⚠️ حدث خطأ أثناء تنفيذ الأمر.";
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    } catch { /* ignore */ }
  }
}
