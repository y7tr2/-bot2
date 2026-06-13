import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
} from "discord.js";
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
      .setTitle(`📚 قائمة أوامر ${interaction.client.user.username}`)
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
      .setDescription("فيما يلي جميع الأوامر مقسّمة حسب الفئة:")
      .addFields(
        { name: "🤖 الذكاء الاصطناعي (10)", value: "`/ai` `/setchannel` `/setrespect` `/summarize` `/translate` `/explain` `/correct` `/debate` `/story` `/dua`" },
        { name: "🕌 إسلامية (10)", value: "`/quran` `/hadith` `/prayer` `/islamicquote` `/hijri` `/names` `/asmaallah` `/islamicfact` `/tasbih` `/trivia`" },
        { name: "🛡️ إدارة (10)", value: "`/kick` `/ban` `/unban` `/mute` `/unmute` `/warn` `/warnings` `/clearwarnings` `/clear` `/lock`" },
        { name: "ℹ️ معلومات (10)", value: "`/help` `/ping` `/serverinfo` `/userinfo` `/avatar` `/roleinfo` `/members` `/maker` `/uptime` `/botconfig`" },
        { name: "🎲 ترفيه (6)", value: "`/8ball` `/roll` `/flip` `/poll` `/riddle` `/number`" },
        { name: "⚙️ ادمن (4)", value: "`/broadcast` `/unlock` `/setlog` `/map`" },
        { name: "🎫 نظام التذاكر (8)", value: "`/ticket-setup` `/ticket-setrole` `/ticket-setcategory` `/ticket-setlog` `/ticket-close` `/ticket-add` `/ticket-remove` `/ticket-list`" },
      )
      .setFooter({ text: `إجمالي الأوامر: 58 أمر • ${interaction.client.user.username}` })
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
    const api = Math.round(interaction.client.ws.ping);
    const color = latency < 100 ? 0x57f287 : latency < 300 ? 0xfee75c : 0xed4245;
    const status = latency < 100 ? "⚡ ممتاز" : latency < 300 ? "✅ جيد" : "⚠️ بطيء";
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "⏱️ زمن الاستجابة", value: `${latency}ms`, inline: true },
        { name: "🌐 زمن API", value: `${api}ms`, inline: true },
        { name: "📊 الحالة", value: status, inline: true },
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
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = guild.memberCount - bots;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🏠 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .addFields(
        { name: "📋 المعرّف", value: guild.id, inline: true },
        { name: "👑 المالك", value: `<@${guild.ownerId}>`, inline: true },
        { name: "📅 تاريخ الإنشاء", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "👥 الأعضاء", value: `${guild.memberCount} (${humans} إنسان / ${bots} بوت)`, inline: false },
        { name: "💬 القنوات", value: `${guild.channels.cache.size}`, inline: true },
        { name: "🎭 الرتب", value: `${guild.roles.cache.size}`, inline: true },
        { name: "😄 الإيموجي", value: `${guild.emojis.cache.size}`, inline: true },
        { name: "🔒 التحقق", value: guild.verificationLevel.toString(), inline: true },
        { name: "🌍 المنطقة", value: "auto", inline: true },
        { name: "💎 Boosts", value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const userinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("👤 معلومات عضو")
    .addUserOption(o => o.setName("عضو").setDescription("اختر العضو").setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("عضو") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(user.id);
    const roles = member?.roles.cache
      .filter(r => r.id !== interaction.guild?.roles.everyone.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`)
      .slice(0, 5)
      .join(" ") || "لا يوجد";
    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || 0x5865f2)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "📋 المعرّف", value: `\`${user.id}\``, inline: true },
        { name: "🤖 بوت؟", value: user.bot ? "نعم" : "لا", inline: true },
        { name: "📅 تاريخ إنشاء الحساب", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: false },
        ...(member ? [
          { name: "📥 تاريخ الانضمام", value: `<t:${Math.floor((member.joinedTimestamp ?? 0) / 1000)}:D>`, inline: true },
          { name: "🎭 الرتبة الأعلى", value: member.roles.highest.name, inline: true },
          { name: "🎭 الرتب", value: roles, inline: false },
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
    .addUserOption(o => o.setName("عضو").setDescription("اختر العضو").setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("عضو") ?? interaction.user;
    const url = user.displayAvatarURL({ size: 512, extension: "png" });
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ صورة ${user.tag}`)
      .setDescription(`[رابط الصورة](${url})`)
      .setImage(url)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const roleinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("🎭 معلومات رتبة")
    .addRoleOption(o => o.setName("رتبة").setDescription("اختر الرتبة").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guild) return;
    const roleId = interaction.options.getRole("رتبة", true).id;
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) { await interaction.reply({ content: "❌ لم أجد الرتبة.", ephemeral: true }); return; }
    const embed = new EmbedBuilder()
      .setColor(role.color || 0x5865f2)
      .setTitle(`🎭 ${role.name}`)
      .addFields(
        { name: "📋 المعرّف", value: `\`${role.id}\``, inline: true },
        { name: "🎨 اللون", value: role.hexColor, inline: true },
        { name: "📅 تاريخ الإنشاء", value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "👥 عدد الأعضاء", value: `${role.members.size}`, inline: true },
        { name: "📌 مثبتة", value: role.hoist ? "✅ نعم" : "❌ لا", inline: true },
        { name: "💬 قابلة للإشارة", value: role.mentionable ? "✅ نعم" : "❌ لا", inline: true },
        { name: "🤖 للبوتات", value: role.managed ? "✅ نعم" : "❌ لا", inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const members: Command = {
  data: new SlashCommandBuilder()
    .setName("members")
    .setDescription("👥 إحصائيات أعضاء السيرفر"),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = guild.memberCount - bots;
    const online = guild.members.cache.filter(m => ["online", "idle", "dnd"].includes(m.presence?.status ?? "")).size;
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`👥 إحصائيات أعضاء ${guild.name}`)
      .addFields(
        { name: "👥 إجمالي الأعضاء", value: `${guild.memberCount}`, inline: true },
        { name: "🧑 بشر", value: `${humans}`, inline: true },
        { name: "🤖 بوتات", value: `${bots}`, inline: true },
        { name: "🟢 متصل الآن", value: `${online}`, inline: true },
        { name: "⚫ غير متصل", value: `${guild.memberCount - online}`, inline: true },
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
    const client = interaction.client;
    const ms = Date.now() - startTime;
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const uptimeStr = d > 0 ? `${d}ي ${h}س ${m}د` : h > 0 ? `${h}س ${m}د` : `${m} دقيقة`;

    const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    const ping = Math.round(client.ws.ping);
    const pingEmoji = ping < 100 ? "🟢" : ping < 300 ? "🟡" : "🔴";

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: `${client.user.username}`, iconURL: client.user.displayAvatarURL() })
      .setTitle("🤖 معلومات البوت الكاملة")
      .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
      .setDescription(
        `**بوت ديسكورد متكامل بالذكاء الاصطناعي**\n` +
        `58 أمر • نظام تكت احترافي • ذكاء اصطناعي GPT-4o-mini`,
      )
      .addFields(
        { name: "🛠️ المطور", value: "**y.7tr2**", inline: true },
        { name: "⚙️ المكتبة", value: "discord.js v14", inline: true },
        { name: "🤖 الذكاء الاصطناعي", value: "GPT-4o-mini", inline: true },
        { name: "🌐 السيرفرات", value: `${client.guilds.cache.size}`, inline: true },
        { name: "👥 المستخدمون", value: `${totalUsers.toLocaleString()}`, inline: true },
        { name: "📊 الأوامر", value: "58 أمر", inline: true },
        { name: `${pingEmoji} Ping`, value: `${ping}ms`, inline: true },
        { name: "⏱️ وقت التشغيل", value: uptimeStr, inline: true },
        { name: "📡 حالة البوت", value: "🟢 شغّال", inline: true },
        { name: "✨ المميزات", value:
          "🎫 نظام تذاكر دعم احترافي\n" +
          "🤖 ذكاء اصطناعي مع 5 مستويات أسلوب\n" +
          "🕌 أوامر إسلامية متكاملة\n" +
          "🛡️ إدارة سيرفر شاملة\n" +
          "🎮 نظام Bloxpin التفاعلي\n" +
          "🎲 ألعاب وترفيه",
          inline: false,
        },
      )
      .setFooter({ text: `Node.js ${process.version} • discord.js v14` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("أوامر البوت")
        .setEmoji("📚")
        .setStyle(ButtonStyle.Primary)
        .setCustomId("maker_help_noop"),
      new ButtonBuilder()
        .setLabel("y.7tr2")
        .setEmoji("🛠️")
        .setStyle(ButtonStyle.Secondary)
        .setCustomId("maker_dev_noop"),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
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
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("⏱️ وقت تشغيل البوت")
      .setDescription(`**${d}** يوم و **${h}** ساعة و **${m}** دقيقة و **${s}** ثانية`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
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
      .setTitle("⚙️ إعدادات البوت الكاملة")
      .addFields(
        { name: "🎭 مستوى الاحترام", value: `${labels[cfg.respectLevel]} (${cfg.respectLevel}/5)`, inline: true },
        { name: "🤖 قناة الذكاء الاصطناعي", value: cfg.aiChannelId ? `<#${cfg.aiChannelId}>` : "جميع القنوات", inline: true },
        { name: "📋 قناة السجل", value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "غير محدد", inline: true },
        { name: "🎫 رتبة الدعم", value: cfg.supportRoleId ? `<@&${cfg.supportRoleId}>` : "غير محدد", inline: true },
        { name: "📁 تصنيف التذاكر", value: cfg.ticketCategoryId ? `<#${cfg.ticketCategoryId}>` : "غير محدد", inline: true },
        { name: "📋 سجل التذاكر", value: cfg.ticketLogChannelId ? `<#${cfg.ticketLogChannelId}>` : "غير محدد", inline: true },
        { name: "🎫 إجمالي التذاكر", value: `${cfg.ticketCount}`, inline: true },
        { name: "🔓 تذاكر مفتوحة", value: `${cfg.openTickets.size}`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const setlog: Command = {
  data: new SlashCommandBuilder()
    .setName("setlog")
    .setDescription("📋 تحديد قناة السجل")
    .addChannelOption(o => o.setName("قناة").setDescription("قناة السجل").setRequired(true))
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
