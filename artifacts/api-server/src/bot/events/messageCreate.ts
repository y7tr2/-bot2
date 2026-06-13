import type { Message } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { getConfig } from "../config";
import { askAI } from "../ai";

export async function onMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.guild) return;

  const cfg = getConfig(message.guild.id);

  // ── AFK check: if user sends a message, remove their AFK ──
  if (cfg.afkUsers.has(message.author.id)) {
    cfg.afkUsers.delete(message.author.id);
    try {
      await message.reply({ content: `👋 مرحباً بعودتك! تم إزالة حالة AFK.`, allowedMentions: { repliedUser: false } });
    } catch { /* ignore */ }
  }

  // ── AFK check: if a mentioned user is AFK ──
  for (const [, user] of message.mentions.users) {
    const reason = cfg.afkUsers.get(user.id);
    if (reason) {
      try {
        await message.reply({ content: `😴 **${user.username}** في وضع AFK — ${reason}`, allowedMentions: { repliedUser: false } });
      } catch { /* ignore */ }
      break;
    }
  }

  // ── AI channel auto-respond ──
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
    } catch { /* ignore */ }
  }
}
