import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  type TextChannel,
  type GuildMember,
} from "discord.js";
import type { Command } from "./types";
import { getConfig, type GiveawayData } from "../config";

export const snipedMessages = new Map<string, { content: string; author: string; avatar: string; time: number }>();

// ─── autorole ───────────────────────────────────────────
const autorole: Command = {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("🎭 تحديد رتبة تُعطى تلقائياً للأعضاء الجدد")
    .addRoleOption(o => o.setName("رتبة").setDescription("الرتبة التلقائية (اتركها فارغة للإيقاف)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const role = interaction.options.getRole("رتبة");
    getConfig(interaction.guildId).autoRoleId = role?.id ?? null;
    await interaction.reply({ content: role ? `✅ الرتبة التلقائية: <@&${role.id}>` : "✅ تم إيقاف الرتبة التلقائية.", ephemeral: true });
  },
};

// ─── setwelcome ──────────────────────────────────────────
const setwelcome: Command = {
  data: new SlashCommandBuilder()
    .setName("setwelcome")
    .setDescription("👋 إعداد قناة ورسالة الترحيب")
    .addChannelOption(o => o.setName("قناة").setDescription("قناة الترحيب").setRequired(true))
    .addStringOption(o => o.setName("رسالة").setDescription("رسالة الترحيب ({user} للعضو، {server} للسيرفر)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const ch = interaction.options.getChannel("قناة", true);
    const msg = interaction.options.getString("رسالة") ?? "مرحباً {user} في {server}! 🎉";
    const cfg = getConfig(interaction.guildId);
    cfg.welcomeChannelId = ch.id;
    cfg.welcomeMessage = msg;
    await interaction.reply({ content: `✅ قناة الترحيب: <#${ch.id}>\n📝 الرسالة: ${msg}`, ephemeral: true });
  },
};

// ─── setgoodbye ──────────────────────────────────────────
const setgoodbye: Command = {
  data: new SlashCommandBuilder()
    .setName("setgoodbye")
    .setDescription("👋 إعداد قناة ورسالة الوداع")
    .addChannelOption(o => o.setName("قناة").setDescription("قناة الوداع").setRequired(true))
    .addStringOption(o => o.setName("رسالة").setDescription("رسالة الوداع ({user} للعضو، {server} للسيرفر)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const ch = interaction.options.getChannel("قناة", true);
    const msg = interaction.options.getString("رسالة") ?? "وداعاً {user}، نتمنى لك التوفيق. 👋";
    const cfg = getConfig(interaction.guildId);
    cfg.goodbyeChannelId = ch.id;
    cfg.goodbyeMessage = msg;
    await interaction.reply({ content: `✅ قناة الوداع: <#${ch.id}>\n📝 الرسالة: ${msg}`, ephemeral: true });
  },
};

// ─── slowmode ────────────────────────────────────────────
const slowmode: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("🐢 تعيين وضع التباطؤ في القناة")
    .addIntegerOption(o => o.setName("ثوانٍ").setDescription("المدة بالثوانٍ (0 للإيقاف، حتى 21600)").setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption(o => o.setName("قناة").setDescription("القناة (افتراضياً: الحالية)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const secs = interaction.options.getInteger("ثوانٍ", true);
    const ch = (interaction.options.getChannel("قناة") ?? interaction.channel) as TextChannel;
    await ch.setRateLimitPerUser(secs);
    await interaction.reply(secs === 0 ? `✅ تم إيقاف التباطؤ في <#${ch.id}>.` : `🐢 التباطؤ في <#${ch.id}>: **${secs}** ثانية.`);
  },
};

// ─── afk ─────────────────────────────────────────────────
const afk: Command = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("😴 تعيين حالة AFK (غائب)")
    .addStringOption(o => o.setName("سبب").setDescription("سبب الغياب").setRequired(false)),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const reason = interaction.options.getString("سبب") ?? "بدون سبب";
    const cfg = getConfig(interaction.guildId);
    cfg.afkUsers.set(interaction.user.id, reason);
    await interaction.reply(`😴 **${interaction.user.username}** الآن في وضع AFK — ${reason}`);
  },
};

// ─── remind ──────────────────────────────────────────────
const remind: Command = {
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("⏰ تذكير بعد مدة معينة")
    .addIntegerOption(o => o.setName("دقائق").setDescription("عدد الدقائق للتذكير").setRequired(true).setMinValue(1).setMaxValue(1440))
    .addStringOption(o => o.setName("رسالة").setDescription("ما الذي تريد تذكيره؟").setRequired(true)),
  async execute(interaction) {
    const minutes = interaction.options.getInteger("دقائق", true);
    const message = interaction.options.getString("رسالة", true);
    await interaction.reply(`✅ سأذكّرك بـ **${message}** بعد **${minutes}** دقيقة!`);
    setTimeout(async () => {
      try {
        const embed = new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle("⏰ تذكير!")
          .setDescription(message)
          .setTimestamp();
        await (interaction.channel as TextChannel).send({ content: `${interaction.user}`, embeds: [embed] });
      } catch { /* ignore */ }
    }, minutes * 60 * 1000);
  },
};

// ─── report ──────────────────────────────────────────────
const report: Command = {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("🚨 الإبلاغ عن عضو")
    .addUserOption(o => o.setName("عضو").setDescription("العضو المُبلَّغ عنه").setRequired(true))
    .addStringOption(o => o.setName("سبب").setDescription("سبب البلاغ").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const target = interaction.options.getUser("عضو", true);
    const reason = interaction.options.getString("سبب", true);
    const cfg = getConfig(interaction.guildId);
    await interaction.reply({ content: "✅ تم إرسال بلاغك، شكراً لمساهمتك في الحفاظ على السيرفر.", ephemeral: true });
    if (cfg.logChannelId) {
      const logCh = interaction.guild?.channels.cache.get(cfg.logChannelId) as TextChannel | undefined;
      if (logCh) {
        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🚨 بلاغ جديد")
          .addFields(
            { name: "المُبلَّغ", value: `${target} (${target.tag})`, inline: true },
            { name: "المُبلِّغ", value: `${interaction.user} (${interaction.user.tag})`, inline: true },
            { name: "السبب", value: reason },
            { name: "القناة", value: `<#${interaction.channelId}>`, inline: true },
          )
          .setTimestamp();
        await logCh.send({ embeds: [embed] });
      }
    }
  },
};

// ─── setsuggest ───────────────────────────────────────────
const setsuggest: Command = {
  data: new SlashCommandBuilder()
    .setName("setsuggest")
    .setDescription("💡 تحديد قناة الاقتراحات")
    .addChannelOption(o => o.setName("قناة").setDescription("قناة الاقتراحات").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const ch = interaction.options.getChannel("قناة", true);
    getConfig(interaction.guildId).suggestChannelId = ch.id;
    await interaction.reply({ content: `✅ قناة الاقتراحات: <#${ch.id}>`, ephemeral: true });
  },
};

// ─── suggest ─────────────────────────────────────────────
const suggest: Command = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("💡 إرسال اقتراح")
    .addStringOption(o => o.setName("اقتراح").setDescription("اقتراحك").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const text = interaction.options.getString("اقتراح", true);
    if (!cfg.suggestChannelId) {
      await interaction.reply({ content: "❌ لم يتم تحديد قناة الاقتراحات بعد. (استخدم `/setsuggest`)", ephemeral: true });
      return;
    }
    const ch = interaction.guild?.channels.cache.get(cfg.suggestChannelId) as TextChannel | undefined;
    if (!ch) { await interaction.reply({ content: "❌ لم أجد قناة الاقتراحات.", ephemeral: true }); return; }
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("💡 اقتراح جديد")
      .setDescription(text)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .addFields({ name: "📊 التصويت", value: "👍 0 | 👎 0" })
      .setTimestamp();
    const msg = await ch.send({ embeds: [embed] });
    await msg.react("👍");
    await msg.react("👎");
    await interaction.reply({ content: "✅ تم إرسال اقتراحك!", ephemeral: true });
  },
};

// ─── giveaway ────────────────────────────────────────────
const giveaway: Command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("🎉 إطلاق مسابقة")
    .addStringOption(o => o.setName("جائزة").setDescription("الجائزة").setRequired(true))
    .addIntegerOption(o => o.setName("مدة").setDescription("المدة بالدقائق").setRequired(true).setMinValue(1).setMaxValue(10080))
    .addIntegerOption(o => o.setName("فائزون").setDescription("عدد الفائزين (افتراضي: 1)").setRequired(false).setMinValue(1).setMaxValue(10))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const prize = interaction.options.getString("جائزة", true);
    const duration = interaction.options.getInteger("مدة", true);
    const winnersCount = interaction.options.getInteger("فائزون") ?? 1;
    const endTime = Date.now() + duration * 60 * 1000;
    const ch = interaction.channel as TextChannel;
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("🎉 مسابقة!")
      .setDescription(
        `**الجائزة:** ${prize}\n\n` +
        `اضغط على زر **دخول** للمشاركة!\n\n` +
        `⏰ ينتهي: <t:${Math.floor(endTime / 1000)}:R>\n` +
        `🏆 الفائزون: **${winnersCount}**`,
      )
      .setFooter({ text: `${interaction.guild.name} • مسابقة` })
      .setTimestamp(endTime);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("giveaway_enter").setLabel("دخول 🎉").setStyle(ButtonStyle.Success),
    );
    const msg = await ch.send({ embeds: [embed], components: [row] });
    const gData: GiveawayData = {
      channelId: ch.id,
      guildId: interaction.guild.id,
      messageId: msg.id,
      prize,
      endTime,
      winnersCount,
      participants: new Set(),
      ended: false,
    };
    getConfig(interaction.guild.id).giveaways.set(msg.id, gData);
    await interaction.editReply(`✅ تم إطلاق المسابقة في ${ch}!`);
    setTimeout(async () => {
      gData.ended = true;
      const participants = [...gData.participants];
      const embed2 = new EmbedBuilder().setColor(0xed4245).setTimestamp();
      if (participants.length === 0) {
        embed2.setTitle("🎉 انتهت المسابقة!").setDescription(`**الجائزة:** ${prize}\n\n❌ لا يوجد مشاركون.`);
      } else {
        const shuffled = participants.sort(() => Math.random() - 0.5);
        const winners = shuffled.slice(0, Math.min(winnersCount, shuffled.length));
        embed2.setTitle("🎉 انتهت المسابقة!")
          .setDescription(
            `**الجائزة:** ${prize}\n\n` +
            `🏆 **الفائز${winners.length > 1 ? "ون" : ""}:**\n` +
            winners.map(id => `<@${id}>`).join("\n") +
            `\n\n👥 إجمالي المشاركين: ${participants.length}`,
          );
        await ch.send({ content: `🎉 مبروك ${winners.map(id => `<@${id}>`).join(" ")}! فزتم بـ **${prize}**!` });
      }
      try { await msg.edit({ embeds: [embed2], components: [] }); } catch { /* ignore */ }
    }, duration * 60 * 1000);
  },
};

// ─── snipe ───────────────────────────────────────────────
const snipe: Command = {
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("👻 إظهار آخر رسالة محذوفة في هذه القناة"),
  async execute(interaction) {
    const sniped = snipedMessages.get(interaction.channelId);
    if (!sniped) {
      await interaction.reply({ content: "❌ لا توجد رسائل محذوفة مؤخراً في هذه القناة.", ephemeral: true });
      return;
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: sniped.author, iconURL: sniped.avatar })
      .setDescription(sniped.content || "*[رسالة فارغة أو مرفق]*")
      .setFooter({ text: `محذوفة <t:${Math.floor(sniped.time / 1000)}:R>` })
      .setTimestamp(sniped.time);
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── embed ───────────────────────────────────────────────
const embedCmd: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("📝 إرسال embed مخصص")
    .addStringOption(o => o.setName("عنوان").setDescription("عنوان الـ Embed").setRequired(true))
    .addStringOption(o => o.setName("وصف").setDescription("محتوى الـ Embed").setRequired(true))
    .addStringOption(o => o.setName("لون").setDescription("اللون hex مثلاً #ff0000").setRequired(false))
    .addChannelOption(o => o.setName("قناة").setDescription("القناة (افتراضياً: الحالية)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const title = interaction.options.getString("عنوان", true);
    const description = interaction.options.getString("وصف", true);
    const colorStr = interaction.options.getString("لون") ?? "#5865F2";
    const ch = (interaction.options.getChannel("قناة") ?? interaction.channel) as TextChannel;
    const color = parseInt(colorStr.replace("#", ""), 16) || 0x5865f2;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
    await ch.send({ embeds: [embed] });
    await interaction.reply({ content: `✅ تم إرسال الـ Embed في <#${ch.id}>`, ephemeral: true });
  },
};

// ─── roleinfo-me ─────────────────────────────────────────
const myperms: Command = {
  data: new SlashCommandBuilder()
    .setName("myperms")
    .setDescription("🔑 عرض صلاحياتك في القناة الحالية"),
  async execute(interaction) {
    if (!interaction.guild) return;
    const member = interaction.member as GuildMember;
    const perms = member.permissions;
    const list = [
      ["إدارة السيرفر", perms.has(PermissionFlagsBits.ManageGuild)],
      ["حظر الأعضاء", perms.has(PermissionFlagsBits.BanMembers)],
      ["طرد الأعضاء", perms.has(PermissionFlagsBits.KickMembers)],
      ["إدارة الرسائل", perms.has(PermissionFlagsBits.ManageMessages)],
      ["إدارة القنوات", perms.has(PermissionFlagsBits.ManageChannels)],
      ["إدارة الرتب", perms.has(PermissionFlagsBits.ManageRoles)],
      ["مشاهدة سجل التدقيق", perms.has(PermissionFlagsBits.ViewAuditLog)],
      ["المشرف", perms.has(PermissionFlagsBits.Administrator)],
    ] as [string, boolean][];
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🔑 صلاحيات ${interaction.user.username}`)
      .setDescription(list.map(([name, has]) => `${has ? "✅" : "❌"} ${name}`).join("\n"))
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

// ─── channelinfo ──────────────────────────────────────────
const channelinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("channelinfo")
    .setDescription("📋 معلومات عن قناة")
    .addChannelOption(o => o.setName("قناة").setDescription("القناة (افتراضياً: الحالية)").setRequired(false)),
  async execute(interaction) {
    const ch = (interaction.options.getChannel("قناة") ?? interaction.channel) as TextChannel;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 ${ch.name}`)
      .addFields(
        { name: "📋 المعرّف", value: `\`${ch.id}\``, inline: true },
        { name: "📂 النوع", value: ch.type.toString(), inline: true },
        { name: "📅 تاريخ الإنشاء", value: `<t:${Math.floor(ch.createdTimestamp! / 1000)}:D>`, inline: true },
        { name: "📝 الوصف", value: ("topic" in ch && ch.topic) ? ch.topic : "لا يوجد وصف", inline: false },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── invite ───────────────────────────────────────────────
const invite: Command = {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("🔗 رابط دعوة البوت"),
  async execute(interaction) {
    const clientId = interaction.client.user.id;
    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔗 دعوة البوت")
      .setDescription(`[اضغط هنا لدعوة البوت إلى سيرفرك](${url})`)
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export const handleGiveawayButton = async (interaction: import("discord.js").ButtonInteraction): Promise<void> => {
  if (!interaction.guild) return;
  const cfg = getConfig(interaction.guild.id);
  const gData = cfg.giveaways.get(interaction.message.id);
  if (!gData || gData.ended) {
    await interaction.reply({ content: "❌ هذه المسابقة انتهت.", ephemeral: true }); return;
  }
  if (gData.participants.has(interaction.user.id)) {
    await interaction.reply({ content: "❌ أنت مشترك بالفعل!", ephemeral: true }); return;
  }
  gData.participants.add(interaction.user.id);
  await interaction.reply({ content: `✅ تم تسجيلك في المسابقة! إجمالي المشاركين: **${gData.participants.size}**`, ephemeral: true });
};

export const utilityCommands: Command[] = [
  autorole, setwelcome, setgoodbye, slowmode, afk, remind, report,
  setsuggest, suggest, giveaway, snipe, embedCmd, myperms, channelinfo, invite,
];
