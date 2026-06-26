import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActivityType,
  type GuildMember,
} from "discord.js";
import type { Command } from "./types";
import { getConfig, setLogChannel } from "../config";

export const setlog: Command = {
  data: new SlashCommandBuilder()
    .setName("setlog")
    .setDescription("⚙️ تحديد قناة السجلات")
    .addChannelOption((o) => o.setName("قناة").setDescription("قناة السجلات").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const channel = interaction.options.getChannel("قناة");
    setLogChannel(interaction.guildId, channel ? channel.id : null);
    await interaction.reply(channel ? `✅ تم تعيين <#${channel.id}> كقناة سجلات.` : "✅ تم إزالة قناة السجلات.");
  },
};

const ping: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("🏓 فحص سرعة استجابة البوت"),
  async execute(interaction) {
    const sent = await interaction.reply({ content: "⏱️ جار الفحص...", fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;
    const embed = new EmbedBuilder()
      .setColor(latency < 200 ? 0x57f287 : latency < 500 ? 0xfee75c : 0xed4245)
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "⏱️ استجابة البوت", value: `${latency}ms`, inline: true },
        { name: "🌐 WebSocket", value: `${wsLatency}ms`, inline: true },
      )
      .setTimestamp();
    await interaction.editReply({ content: "", embeds: [embed] });
  },
};

const botinfo: Command = {
  data: new SlashCommandBuilder().setName("botinfo").setDescription("ℹ️ معلومات عن البوت"),
  async execute(interaction) {
    const bot = interaction.client.user;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`ℹ️ ${bot.username}`)
      .setThumbnail(bot.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🆔 المعرف", value: bot.id, inline: true },
        { name: "📅 أُنشئ في", value: `<t:${Math.floor(bot.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "⏱️ وقت التشغيل", value: `${hours}s ${minutes}m`, inline: true },
        { name: "🏠 عدد السيرفرات", value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: "💾 الذاكرة", value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`, inline: true },
        { name: "⚙️ Node.js", value: process.version, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const serverinfo: Command = {
  data: new SlashCommandBuilder().setName("serverinfo").setDescription("🏠 معلومات السيرفر"),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) { await interaction.reply({ content: "❌ فقط في السيرفرات.", ephemeral: true }); return; }
    await guild.fetch();
    const owner = await guild.fetchOwner();
    const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🏠 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: "🆔 المعرف", value: guild.id, inline: true },
        { name: "👑 المالك", value: owner.user.tag, inline: true },
        { name: "📅 أُنشئ في", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "👥 الأعضاء", value: `${guild.memberCount}`, inline: true },
        { name: "📝 قنوات النص", value: `${textChannels}`, inline: true },
        { name: "🔊 قنوات الصوت", value: `${voiceChannels}`, inline: true },
        { name: "🎭 عدد الرتب", value: `${guild.roles.cache.size}`, inline: true },
        { name: "😊 عدد الإيموجي", value: `${guild.emojis.cache.size}`, inline: true },
        { name: "🚀 مستوى التعزيز", value: `${guild.premiumTier}`, inline: true },
      )
      .setImage(guild.bannerURL({ size: 1024 }))
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const userinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("👤 معلومات عضو")
    .addUserOption((o) => o.setName("عضو").setDescription("العضو المراد معرفة معلوماته (الافتراضي: أنت)").setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) return;
    const user = interaction.options.getUser("عضو") ?? interaction.user;
    const member = interaction.guild.members.cache.get(user.id) as GuildMember | undefined;
    const roles = member?.roles.cache
      .filter((r) => r.id !== interaction.guild!.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => `<@&${r.id}>`)
      .slice(0, 10)
      .join(", ") || "لا توجد";
    const statusMap: Record<string, string> = { online: "🟢 متصل", idle: "🌙 بعيد", dnd: "🔴 مشغول", offline: "⚫ غير متصل" };
    const status = member?.presence?.status ? (statusMap[member.presence.status] ?? "⚫ غير متصل") : "⚫ غير متصل";
    const activity = member?.presence?.activities[0];
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🆔 المعرف", value: user.id, inline: true },
        { name: "📅 أُنشئ في", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "📥 انضم في", value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "غير معروف", inline: true },
        { name: "🔵 الحالة", value: status, inline: true },
        { name: "🎮 النشاط", value: activity ? `${activity.type === ActivityType.Playing ? "🎮 يلعب" : "📡"} ${activity.name}` : "لا يوجد", inline: true },
        { name: "🎭 الرتبة الأعلى", value: member?.roles.highest.id !== interaction.guild!.id ? `<@&${member?.roles.highest.id}>` : "لا توجد", inline: true },
        { name: `🎭 الرتب (${member?.roles.cache.size ? member.roles.cache.size - 1 : 0})`, value: roles },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const avatar: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("🖼️ صورة عضو")
    .addUserOption((o) => o.setName("عضو").setDescription("العضو المراد عرض صورته").setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("عضو") ?? interaction.user;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ صورة ${user.username}`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const roles: Command = {
  data: new SlashCommandBuilder().setName("roles").setDescription("🎭 عرض رتب السيرفر"),
  async execute(interaction) {
    if (!interaction.guild) return;
    const guildRoles = interaction.guild.roles.cache
      .filter((r) => r.id !== interaction.guild!.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => `<@&${r.id}>`)
      .slice(0, 20);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎭 رتب ${interaction.guild.name}`)
      .setDescription(guildRoles.join("\n") || "لا توجد رتب")
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const inviteCmd: Command = {
  data: new SlashCommandBuilder().setName("invite").setDescription("📨 دعوة البوت"),
  async execute(interaction) {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=8&scope=bot%20applications.commands`;
    await interaction.reply({ content: `📨 [اضغط هنا لدعوة البوت](${url})`, ephemeral: true });
  },
};

const setautorole: Command = {
  data: new SlashCommandBuilder()
    .setName("setautorole")
    .setDescription("⚙️ تحديد رتبة تلقائية للأعضاء الجدد")
    .addRoleOption((o) => o.setName("رتبة").setDescription("الرتبة (اتركها فارغة للإلغاء)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const role = interaction.options.getRole("رتبة");
    getConfig(interaction.guildId).autoRoleId = role?.id ?? null;
    await interaction.reply(role ? `✅ سيتم إعطاء <@&${role.id}> للأعضاء الجدد تلقائياً.` : "✅ تم إلغاء الرتبة التلقائية.");
  },
};

const setwelcome: Command = {
  data: new SlashCommandBuilder()
    .setName("setwelcome")
    .setDescription("⚙️ إعداد رسالة الترحيب")
    .addChannelOption((o) => o.setName("قناة").setDescription("قناة الترحيب").setRequired(false))
    .addStringOption((o) => o.setName("رسالة").setDescription("رسالة الترحيب ({user}, {server}, {count})").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const channel = interaction.options.getChannel("قناة");
    const msg = interaction.options.getString("رسالة");
    if (channel) cfg.welcomeChannelId = channel.id;
    if (msg) cfg.welcomeMessage = msg;
    await interaction.reply(`✅ تم تحديث إعدادات الترحيب.\nالقناة: ${cfg.welcomeChannelId ? `<#${cfg.welcomeChannelId}>` : "غير محددة"}\nالرسالة: ${cfg.welcomeMessage}`);
  },
};

const setgoodbye: Command = {
  data: new SlashCommandBuilder()
    .setName("setgoodbye")
    .setDescription("⚙️ إعداد رسالة الوداع")
    .addChannelOption((o) => o.setName("قناة").setDescription("قناة الوداع").setRequired(false))
    .addStringOption((o) => o.setName("رسالة").setDescription("رسالة الوداع ({user}, {server})").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const channel = interaction.options.getChannel("قناة");
    const msg = interaction.options.getString("رسالة");
    if (channel) cfg.goodbyeChannelId = channel.id;
    if (msg) cfg.goodbyeMessage = msg;
    await interaction.reply(`✅ تم تحديث إعدادات الوداع.\nالقناة: ${cfg.goodbyeChannelId ? `<#${cfg.goodbyeChannelId}>` : "غير محددة"}\nالرسالة: ${cfg.goodbyeMessage}`);
  },
};

export const infoCommands: Command[] = [
  ping, botinfo, serverinfo, userinfo, avatar, roles, inviteCmd, setautorole, setwelcome, setgoodbye, setlog,
];
