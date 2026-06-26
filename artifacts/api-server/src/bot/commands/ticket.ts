import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ButtonInteraction,
} from "discord.js";
import type { Command } from "./types";
import { getConfig } from "../config";

const setupticket: Command = {
  data: new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("🎫 إعداد نظام التذاكر")
    .addChannelOption(o => o.setName("قناة").setDescription("قناة إرسال رسالة التذاكر").setRequired(true))
    .addRoleOption(o => o.setName("رتبة-الدعم").setDescription("رتبة فريق الدعم").setRequired(false))
    .addChannelOption(o => o.setName("الفئة").setDescription("فئة إنشاء التذاكر فيها").setRequired(false))
    .addChannelOption(o => o.setName("سجل").setDescription("قناة سجل التذاكر المغلقة").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.guild || !interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const channel = interaction.options.getChannel("قناة", true);
    const supportRole = interaction.options.getRole("رتبة-الدعم");
    const category = interaction.options.getChannel("الفئة");
    const logChannel = interaction.options.getChannel("سجل");
    if (supportRole) cfg.supportRoleId = supportRole.id;
    if (category) cfg.ticketCategoryId = category.id;
    if (logChannel) cfg.ticketLogChannelId = logChannel.id;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎫 نظام التذاكر")
      .setDescription("هل تحتاج إلى مساعدة؟ اضغط على الزر أدناه لفتح تذكرة دعم.")
      .setTimestamp();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_open").setLabel("🎫 فتح تذكرة").setStyle(ButtonStyle.Primary),
    );
    const ch = interaction.guild.channels.cache.get(channel.id) as any;
    await ch.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ تم إعداد نظام التذاكر في <#${channel.id}>.`, ephemeral: true });
  },
};

export async function handleTicketButton(interaction: ButtonInteraction): Promise<void> {
  const { customId, guild, user } = interaction;
  if (!guild) return;
  const cfg = getConfig(guild.id);

  if (customId === "ticket_open") {
    const existing = [...cfg.openTickets.values()].find(t => t.userId === user.id);
    if (existing) {
      await interaction.reply({ content: `❌ لديك تذكرة مفتوحة بالفعل.`, ephemeral: true });
      return;
    }
    cfg.ticketCount++;
    const num = cfg.ticketCount;
    const channelName = `ticket-${num}-${user.username.toLowerCase().slice(0, 10)}`;
    try {
      const ch = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: cfg.ticketCategoryId ?? undefined,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          ...(cfg.supportRoleId ? [{ id: cfg.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
        ],
      });
      cfg.openTickets.set(ch.id, { userId: user.id, number: num, claimedBy: null, createdAt: Date.now() });
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🎫 تذكرة #${num}`)
        .setDescription(`مرحباً <@${user.id}>! سيتواصل معك الدعم قريباً.\n\nاضغط **إغلاق** عند الانتهاء.`)
        .setTimestamp();
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ticket_claim").setLabel("✋ استلام").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒 إغلاق").setStyle(ButtonStyle.Danger),
      );
      await ch.send({ content: `<@${user.id}>${cfg.supportRoleId ? ` <@&${cfg.supportRoleId}>` : ""}`, embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ تم فتح تذكرتك: <#${ch.id}>`, ephemeral: true });
    } catch {
      await interaction.reply({ content: "❌ فشل إنشاء قناة التذكرة.", ephemeral: true });
    }
  }

  if (customId === "ticket_claim") {
    const ticket = cfg.openTickets.get(interaction.channelId);
    if (!ticket) return;
    ticket.claimedBy = user.id;
    await interaction.reply(`✋ تم استلام التذكرة من قِبل <@${user.id}>.`);
  }

  if (customId === "ticket_close") {
    const ticket = cfg.openTickets.get(interaction.channelId);
    if (!ticket) return;
    cfg.openTickets.delete(interaction.channelId);
    await interaction.reply("🔒 سيتم إغلاق هذه التذكرة خلال 5 ثوانٍ...");
    if (cfg.ticketLogChannelId) {
      const logCh = guild.channels.cache.get(cfg.ticketLogChannelId) as any;
      if (logCh) {
        const logEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle(`🔒 تذكرة #${ticket.number} مغلقة`)
          .addFields(
            { name: "👤 المستخدم", value: `<@${ticket.userId}>`, inline: true },
            { name: "✋ استُلمت بواسطة", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "لم تُستلم", inline: true },
            { name: "⏱️ المدة", value: `${Math.floor((Date.now() - ticket.createdAt) / 60000)} دقيقة`, inline: true },
          )
          .setTimestamp();
        await logCh.send({ embeds: [logEmbed] });
      }
    }
    setTimeout(async () => {
      try { await interaction.channel?.delete(); } catch { /* ignore */ }
    }, 5000);
  }
}

export const ticketCommands: Command[] = [setupticket];
