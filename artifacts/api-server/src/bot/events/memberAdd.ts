import type { GuildMember } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { getConfig } from "../config";
import { logger } from "../../lib/logger";

export async function onGuildMemberAdd(member: GuildMember): Promise<void> {
  const cfg = getConfig(member.guild.id);
  if (!cfg.welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(cfg.welcomeChannelId) as any;
  if (!channel) return;

  const msg = cfg.welcomeMessage
    .replace("{user}", `<@${member.id}>`)
    .replace("{server}", member.guild.name)
    .replace("{count}", `${member.guild.memberCount}`);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("👋 عضو جديد!")
    .setDescription(msg)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields({ name: "📅 انضم في", value: `<t:${Math.floor(Date.now() / 1000)}:R>` })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err }, "Failed to send welcome message");
  }
}
