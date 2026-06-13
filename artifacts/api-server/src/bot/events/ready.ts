import type { Client } from "discord.js";
import { logger } from "../../lib/logger";

export async function onReady(client: Client, commands: any[]): Promise<void> {
  if (!client.user || !client.application) return;

  logger.info({ tag: client.user.tag }, "Bot logged in");

  try {
    await client.application.commands.set(commands.map((c) => c.data));
    logger.info({ count: commands.length }, "Slash commands registered globally");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
  }
}
