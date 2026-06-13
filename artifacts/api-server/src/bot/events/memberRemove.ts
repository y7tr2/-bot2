import type { GuildMember, PartialGuildMember } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { getConfig } from "../config";
import { logger } from "../../lib/logger";

export async function onGuildMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
  const cfg = getConfig(member.guild.id);
  if (!cfg.goodbyeChannelId) return;

  const channel = member.guild.channels.cache.get(cfg.goodbyeChannelId) as any;
  if (!channel) return;

  const name = member.user?.tag ?? "عضو";
  const msg = cfg.goodbyeMessage
    .replace("{user}", name)
    .replace("{server}", member.guild.name);

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("👋 غادر السيرفر")
    .setDescription(msg)
    .setThumbnail(member.user?.displayAvatarURL({ size: 256 }) ?? null)
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err }, "Failed to send goodbye message");
  }
}
