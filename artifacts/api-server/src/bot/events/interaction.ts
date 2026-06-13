import type { Interaction, Collection } from "discord.js";
import type { Command } from "../commands/types";
import { handleBloxpinButton } from "../commands/bloxpin";
import { logger } from "../../lib/logger";

export async function onInteractionCreate(
  interaction: Interaction,
  commands: Collection<string, Command>,
): Promise<void> {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("bloxpin_")) {
      try {
        await handleBloxpinButton(interaction);
      } catch (err) {
        logger.error({ err, customId: interaction.customId }, "Button handler error");
        try {
          await interaction.reply({ content: "⚠️ حدث خطأ.", ephemeral: true });
        } catch { /* ignore */ }
      }
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
