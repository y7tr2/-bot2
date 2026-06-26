import type { Message, GuildMember } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { getConfig } from "../config";
import { askAI } from "../ai";
import { handleAntiSpam, LINK_REGEX_EXPORT } from "../commands/protection";

export async function onMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.guild) return;

  const cfg = getConfig(message.guild.id);
  const p = cfg.protection;
  const member = message.member as GuildMember;
  const isWhitelisted = p.whitelist.has(message.author.id) ||
    member?.roles.cache.some(r => p.whitelist.has(r.id));

  if (p.antiSpam && !isWhitelisted && member) {
    const muted = await handleAntiSpam(member, message.channelId).catch(() => false);
    if (muted) {
      try { await message.delete(); } catch { /* ignore */ }
      return;
    }
  }

  if (p.antiLink && !isWhitelisted && LINK_REGEX_EXPORT.test(message.content)) {
    try {
      await message.delete();
      if ("send" in message.channel) {
        const warn = await (message.channel as any).send({
          content: `⚠️ ${message.author} — الروابط غير مسموحة في هذا السيرفر!`,
        });
        setTimeout(() => warn.delete().catch(() => {}), 5000);
      }
    } catch { /* no perms */ }
    return;
  }

  if (p.antiMention && !isWhitelisted && member) {
    const mentionCount = message.mentions.users.size + message.mentions.roles.size +
      (message.mentions.everyone ? 1 : 0);
    if (mentionCount >= p.antiMentionMax || message.mentions.everyone) {
      try {
        await message.delete();
        await member.timeout(5 * 60 * 1000, "Anti-Mention: منشنات مفرطة");
        if ("send" in message.channel) {
          const warn = await (message.channel as any).send({
            content: `⚠️ ${message.author} — تم كتمك بسبب المنشنات العشوائية!`,
          });
          setTimeout(() => warn.delete().catch(() => {}), 5000);
        }
      } catch { /* no perms */ }
      return;
    }
  }

  if (cfg.afkUsers.has(message.author.id)) {
    cfg.afkUsers.delete(message.author.id);
    try {
      await message.reply({ content: `👋 مرحباً بعودتك! تم إزالة حالة AFK.`, allowedMentions: { repliedUser: false } });
    } catch { /* ignore */ }
  }

  for (const [, user] of message.mentions.users) {
    const reason = cfg.afkUsers.get(user.id);
    if (reason) {
      try {
        await message.reply({ content: `😴 **${user.username}** في وضع AFK — ${reason}`, allowedMentions: { repliedUser: false } });
      } catch { /* ignore */ }
      break;
    }
  }

  if (cfg.aiChannelId && message.channelId === cfg.aiChannelId) {
    if (message.content.startsWith("/")) return;
    try {
      if ("sendTyping" in message.channel && typeof (message.channel as any).sendTyping === "function") {
        await (message.channel as any).sendTyping();
      }
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
