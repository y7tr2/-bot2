import type { Message } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { getConfig } from "../config";
import { askAI } from "../ai";

export async function onMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.guild) return;

  const cfg = getConfig(message.guild.id);

  if (cfg.aiChannelId && message.channelId === cfg.aiChannelId) {
    if (message.content.startsWith("/")) return;

    try {
      if ("sendTyping" in message.channel) await message.channel.sendTyping();
      const answer = await askAI(message.content, cfg.respectLevel, message.client.user.username);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: `🤖 ${message.client.user.username}`, iconURL: message.client.user.displayAvatarURL() })
        .setDescription(answer.slice(0, 4096))
        .setTimestamp();
      await message.reply({ embeds: [embed] });
    } catch {
      // ignore
    }
  }
}
