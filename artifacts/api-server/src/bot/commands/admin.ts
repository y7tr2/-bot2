import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import type { Command } from "./types";

const broadcast: Command = {
  data: new SlashCommandBuilder()
    .setName("broadcast")
    .setDescription("📢 بث رسالة لجميع قنوات النص")
    .addStringOption((o) => o.setName("رسالة").setDescription("الرسالة المراد بثها").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.guild) return;
    const message = interaction.options.getString("رسالة", true);
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("📢 إعلان من الإدارة")
      .setDescription(message)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    const channels = interaction.guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildText && c.permissionsFor(interaction.guild!.members.me!)?.has(PermissionFlagsBits.SendMessages),
    );

    let sent = 0;
    for (const [, ch] of channels) {
      try {
        await (ch as any).send({ embeds: [embed] });
        sent++;
      } catch {
        // skip
      }
    }

    await interaction.editReply(`✅ تم إرسال الإعلان إلى **${sent}** قناة.`);
  },
};

const unlock: Command = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("🔓 فتح قناة مقفلة")
    .addChannelOption((o) => o.setName("قناة").setDescription("القناة المراد فتحها (الافتراضية: الحالية)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!interaction.guild) return;
    const ch = (interaction.options.getChannel("قناة") ?? interaction.channel) as any;
    await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    await interaction.reply(`🔓 تم فتح القناة <#${ch.id}>.`);
  },
};

export const adminCommands: Command[] = [broadcast, unlock];
