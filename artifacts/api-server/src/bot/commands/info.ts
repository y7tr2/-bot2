import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { getConfig, setLogChannel } from "../config";

const startTime = Date.now();

const help: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📚 قائمة جميع الأوامر"),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📚 قائمة الأوامر")
      .setDescription("فيما يلي جميع الأوامر المتاحة مقسّمة حسب الفئة:")
      .addFields(
        { name: "🤖 الذكاء الاصطناعي (10)", value: "`/ai` `/setchannel` `/setrespect` `/summarize` `/translate` `/explain` `/correct` `/debate` `/story` `/dua`" },
        { name: "🕌 إسلامية (10)", value: "`/quran` `/hadith` `/prayer` `/islamicquote` `/hijri` `/names` `/asmaallah` `/islamicfact` `/tasbih` `/trivia`" },
        { name: "🛡️ إدارة (10)", value: "`/kick` `/ban` `/unban` `/mute` `/unmute` `/warn` `/warnings` `/clearwarnings` `/clear` `/lock`" },
        { name: "ℹ️ معلومات (10)", value: "`/help` `/ping` `/serverinfo` `/userinfo` `/avatar` `/roleinfo` `/members` `/maker` `/uptime` `/botconfig`" },
        { name: "🎲 ترفيه (7)", value: "`/8ball` `/roll` `/flip` `/poll` `/trivia` `/riddle` `/number`" },
        { name: "⚙️ ادمن (3)", value: "`/broadcast` `/unlock` `/setlog`" },
      )
      .setFooter({ text: `إجمالي: 50 أمر | ${interaction.client.user.username}` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const ping: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 اختبار سرعة البوت"),
  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;
    const embed = new EmbedBuilder()
      .setColor(latency < 100 ? 0x57f287 : latency < 300 ? 0xfee75c : 0xed4245)
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "⏱️ زمن الاستجابة", value: `${latency}ms`, inline: true },
        { name: "🌐 زمن API", value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const serverinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("🏠 معلومات السيرفر"),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    await guild.fetch();
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🏠 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: "📋 المعرّف", value: guild.id, inline: true },
        { name: "👑 المالك", value: `<@${guild.ownerId}>`, inline: true },
        { name: "📅 تاريخ الإنشاء", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "👥 الأعضاء", value: `${guild.memberCount}`, inline: true },
        { name: "💬 القنوات", value: `${guild.channels.cache.size}`, inline: true },
        { name: "🎭 الرتب", value: `${guild.roles.cache.size}`, inline: true },
        { name: "😄 الإيموجي", value: `${guild.emojis.cache.size}`, inline: true },
        { name: "🔒 التحقق", value: guild.verificationLevel.toString(), inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const userinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("👤 معلومات عضو")
    .addUserOption((o) => o.setName("عضو").setDescription("اختر العضو").setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("عضو") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(user.id);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "📋 المعرّف", value: user.id, inline: true },
        { name: "📅 تاريخ الإنشاء", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
        ...(member ? [
          { name: "📥 تاريخ الانضمام", value: `<t:${Math.floor((member.joinedTimestamp ?? 0) / 1000)}:D>`, inline: true },
          { name: "🎭 الرتبة الأعلى", value: member.roles.highest.name, inline: true },
        ] : []),
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const avatar: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("🖼️ عرض صورة عضو")
    .addUserOption((o) => o.setName("عضو").setDescription("اختر العضو").setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("عضو") ?? interaction.user;
    const url = user.displayAvatarURL({ size: 512, extension: "png" });
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ صورة ${user.tag}`)
      .setImage(url)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const roleinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("🎭 معلومات رتبة")
    .addRoleOption((o) => o.setName("رتبة").setDescription("اختر الرتبة").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guild) return;
    const roleId = interaction.options.getRole("رتبة", true).id;
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) { await interaction.reply({ content: "❌ لم أجد الرتبة.", ephemeral: true }); return; }
    const embed = new EmbedBuilder()
      .setColor(role.color || 0x5865f2)
      .setTitle(`🎭 ${role.name}`)
      .addFields(
        { name: "📋 المعرّف", value: role.id, inline: true },
        { name: "🎨 اللون", value: role.hexColor, inline: true },
        { name: "📅 تاريخ الإنشاء", value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "👥 الأعضاء", value: `${role.members.size}`, inline: true },
        { name: "📌 مثبتة", value: role.hoist ? "نعم" : "لا", inline: true },
        { name: "💬 قابلة للإشارة", value: role.mentionable ? "نعم" : "لا", inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const members: Command = {
  data: new SlashCommandBuilder()
    .setName("members")
    .setDescription("👥 عدد أعضاء السيرفر"),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    const online = guild.members.cache.filter((m) => m.presence?.status !== "offline").size;
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("👥 إحصائيات الأعضاء")
      .addFields(
        { name: "إجمالي الأعضاء", value: `${guild.memberCount}`, inline: true },
        { name: "متصل الآن", value: `${online}`, inline: true },
        { name: "البوتات", value: `${guild.members.cache.filter((m) => m.user.bot).size}`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const maker: Command = {
  data: new SlashCommandBuilder()
    .setName("maker")
    .setDescription("🤖 معلومات البوت وصانعه"),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🤖 ${interaction.client.user.username}`)
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
      .setDescription("بوت ديسكورد متكامل بالذكاء الاصطناعي • 50 أمر • مناسب للشريعة الإسلامية")
      .addFields(
        { name: "🛠️ المطور", value: "y.7tr2", inline: true },
        { name: "⚙️ المكتبة", value: "discord.js v14", inline: true },
        { name: "🤖 الذكاء الاصطناعي", value: "OpenAI GPT-4o-mini", inline: true },
        { name: "🌐 السيرفرات", value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: "📊 الأوامر", value: "50 أمر", inline: true },
        { name: "⏱️ وقت التشغيل", value: `${Math.floor((Date.now() - startTime) / 60000)} دقيقة`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const uptime: Command = {
  data: new SlashCommandBuilder()
    .setName("uptime")
    .setDescription("⏱️ وقت تشغيل البوت"),
  async execute(interaction) {
    const ms = Date.now() - startTime;
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    await interaction.reply(`⏱️ وقت التشغيل: **${d}** يوم و **${h}** ساعة و **${m}** دقيقة و **${s}** ثانية`);
  },
};

const botconfig: Command = {
  data: new SlashCommandBuilder()
    .setName("botconfig")
    .setDescription("⚙️ عرض إعدادات البوت في هذا السيرفر"),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const labels = ["", "😈 قليل أدب", "😒 متذمر", "😐 محايد", "😊 محترم", "🎩 راقٍ جداً"];
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("⚙️ إعدادات البوت")
      .addFields(
        { name: "🎭 مستوى الاحترام", value: `${labels[cfg.respectLevel]} (${cfg.respectLevel}/5)`, inline: true },
        { name: "🤖 قناة الذكاء الاصطناعي", value: cfg.aiChannelId ? `<#${cfg.aiChannelId}>` : "جميع القنوات", inline: true },
        { name: "📋 قناة السجل", value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "غير محدد", inline: true },
        { name: "👋 قناة الترحيب", value: cfg.welcomeChannelId ? `<#${cfg.welcomeChannelId}>` : "غير محدد", inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const setlog: Command = {
  data: new SlashCommandBuilder()
    .setName("setlog")
    .setDescription("📋 تحديد قناة السجل")
    .addChannelOption((o) => o.setName("قناة").setDescription("قناة السجل").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const ch = interaction.options.getChannel("قناة", true);
    setLogChannel(interaction.guildId, ch.id);
    await interaction.reply(`✅ تم تحديد <#${ch.id}> كقناة للسجل.`);
  },
};

export const infoCommands: Command[] = [
  help, ping, serverinfo, userinfo, avatar, roleinfo, members, maker, uptime, botconfig,
];
