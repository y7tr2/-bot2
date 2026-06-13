import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ButtonInteraction,
  type TextChannel,
} from "discord.js";
import type { Command } from "./types";
import { getConfig, type TicketData } from "../config";

function fmt(n: number) {
  return n.toString().padStart(4, "0");
}

function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} يوم و ${h % 24} ساعة`;
  if (h > 0) return `${h} ساعة و ${m % 60} دقيقة`;
  return `${m} دقيقة`;
}

export async function closeTicket(
  channel: TextChannel,
  guildId: string,
  ticket: TicketData,
  reason: string,
  closedBy: string,
): Promise<void> {
  const cfg = getConfig(guildId);

  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse().filter(m => !m.author.bot);

  let transcript = `╔══════════════════════════════════════╗\n`;
  transcript += `║       تذكرة رقم #${fmt(ticket.number)}             ║\n`;
  transcript += `╚══════════════════════════════════════╝\n\n`;
  transcript += `صاحب التذكرة : ${ticket.userId}\n`;
  transcript += `أُغلقت بواسطة: ${closedBy}\n`;
  transcript += `السبب        : ${reason}\n`;
  transcript += `المدة        : ${fmtDuration(Date.now() - ticket.createdAt)}\n`;
  if (ticket.claimedBy) transcript += `استلمها      : ${ticket.claimedBy}\n`;
  transcript += `التاريخ      : ${new Date().toLocaleString("ar-SA")}\n`;
  transcript += `\n${"─".repeat(50)}\n\n`;

  for (const msg of sorted) {
    transcript += `[${msg.author.tag}] ${msg.createdAt.toLocaleTimeString("ar-SA")}\n`;
    if (msg.content) transcript += `${msg.content}\n`;
    if (msg.attachments.size > 0) transcript += `[مرفق: ${[...msg.attachments.values()].map(a => a.url).join(", ")}]\n`;
    transcript += "\n";
  }

  if (cfg.ticketLogChannelId) {
    const logCh = channel.guild.channels.cache.get(cfg.ticketLogChannelId) as TextChannel | undefined;
    if (logCh) {
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`📋 تذكرة #${fmt(ticket.number)} — مغلقة`)
        .setThumbnail(channel.guild.iconURL() ?? null)
        .addFields(
          { name: "👤 صاحب التذكرة", value: `<@${ticket.userId}>`, inline: true },
          { name: "🔒 أُغلقت بواسطة", value: closedBy, inline: true },
          { name: "⏱️ المدة", value: fmtDuration(Date.now() - ticket.createdAt), inline: true },
          { name: "📝 السبب", value: reason },
          ...(ticket.claimedBy ? [{ name: "🤝 استلمها", value: ticket.claimedBy, inline: true }] : []),
          { name: "💬 الرسائل", value: `${sorted.length} رسالة`, inline: true },
        )
        .setTimestamp();
      await logCh.send({
        embeds: [embed],
        files: [{ attachment: Buffer.from(transcript, "utf8"), name: `ticket-${fmt(ticket.number)}.txt` }],
      });
    }
  }

  cfg.openTickets.delete(channel.id);
  setTimeout(() => channel.delete("ticket closed").catch(() => {}), 5000);
}

export async function handleTicketButton(interaction: ButtonInteraction): Promise<void> {
  const { customId, guild, user, channelId } = interaction;
  if (!guild) return;
  const cfg = getConfig(guild.id);

  if (customId === "ticket_open") {
    const existing = [...cfg.openTickets.entries()].find(([, t]) => t.userId === user.id);
    if (existing) {
      await interaction.reply({ content: `❌ لديك تذكرة مفتوحة بالفعل: <#${existing[0]}>`, ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    cfg.ticketCount += 1;
    const num = cfg.ticketCount;

    const overwrites: object[] = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    ];
    if (cfg.supportRoleId) {
      overwrites.push({
        id: cfg.supportRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles],
      });
    }

    const createOptions: Record<string, unknown> = {
      name: `🎫│ticket-${fmt(num)}`,
      type: ChannelType.GuildText,
      topic: `تذكرة ${user.tag} | ${user.id}`,
      permissionOverwrites: overwrites,
    };
    if (cfg.ticketCategoryId) createOptions["parent"] = cfg.ticketCategoryId;

    const ticketCh = await guild.channels.create(createOptions as Parameters<typeof guild.channels.create>[0]) as TextChannel;

    const ticketData: TicketData = { userId: user.id, number: num, claimedBy: null, createdAt: Date.now() };
    cfg.openTickets.set(ticketCh.id, ticketData);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`🎫 تذكرة #${fmt(num)}`)
      .setDescription(
        `مرحباً ${user}! 👋\n\n` +
        `تم فتح تذكرتك بنجاح، اشرح مشكلتك بالتفصيل وسيتواصل معك فريق الدعم في أقرب وقت.\n\n` +
        `> 📌 للإغلاق اضغط **إغلاق** أو استخدم \`/ticket-close\`\n` +
        `> 🤝 يمكن لفريق الدعم **استلام** التذكرة`,
      )
      .addFields(
        { name: "👤 صاحب التذكرة", value: `${user}`, inline: true },
        { name: "🔢 رقم التذكرة", value: `#${fmt(num)}`, inline: true },
        { name: "📅 تاريخ الفتح", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
      )
      .setFooter({ text: `${guild.name} • نظام التذاكر` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_claim").setLabel("استلام التذكرة 🤝").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ticket_close").setLabel("إغلاق التذكرة 🔒").setStyle(ButtonStyle.Danger),
    );

    const mention = cfg.supportRoleId ? `${user} <@&${cfg.supportRoleId}>` : `${user}`;
    await ticketCh.send({ content: mention, embeds: [embed], components: [row] });
    await interaction.editReply({ content: `✅ تم فتح تذكرتك بنجاح! ${ticketCh}` });
    return;
  }

  if (customId === "ticket_claim") {
    const ticket = cfg.openTickets.get(channelId);
    if (!ticket) { await interaction.reply({ content: "❌ هذه ليست تذكرة.", ephemeral: true }); return; }
    if (ticket.claimedBy) {
      await interaction.reply({ content: `❌ التذكرة مستلمة بالفعل من **${ticket.claimedBy}**.`, ephemeral: true });
      return;
    }
    ticket.claimedBy = user.tag;
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setDescription(`🤝 **${user}** استلم هذه التذكرة وسيساعدك قريباً!`);
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (customId === "ticket_close") {
    const ticket = cfg.openTickets.get(channelId);
    if (!ticket) { await interaction.reply({ content: "❌ هذه ليست تذكرة.", ephemeral: true }); return; }

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("⚠️ تأكيد إغلاق التذكرة")
      .setDescription("هل تريد إغلاق هذه التذكرة؟\nسيتم حفظ نسخة كاملة من المحادثة في قناة السجل.");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_confirm_close").setLabel("تأكيد الإغلاق ✅").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ticket_cancel_close").setLabel("إلغاء ❌").setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ embeds: [confirmEmbed], components: [row] });
    return;
  }

  if (customId === "ticket_confirm_close") {
    const ticket = cfg.openTickets.get(channelId);
    if (!ticket) { await interaction.reply({ content: "❌ هذه ليست تذكرة.", ephemeral: true }); return; }
    await interaction.reply({ content: "🔒 جاري إغلاق التذكرة وحفظ المحادثة... سيتم حذف القناة خلال 5 ثوانٍ." });
    await closeTicket(interaction.channel as TextChannel, guild.id, ticket, "أُغلقت من الزر", user.tag);
    return;
  }

  if (customId === "ticket_cancel_close") {
    await interaction.reply({ content: "✅ تم إلغاء الإغلاق.", ephemeral: true });
    return;
  }
}

const ticketSetup: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-setup")
    .setDescription("🎫 إنشاء لوحة التذاكر")
    .addChannelOption(o => o.setName("قناة").setDescription("القناة التي ستظهر فيها اللوحة").setRequired(true))
    .addStringOption(o => o.setName("عنوان").setDescription("عنوان لوحة التذاكر").setRequired(false))
    .addStringOption(o => o.setName("وصف").setDescription("وصف لوحة التذاكر").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guild) return;
    const ch = interaction.options.getChannel("قناة", true);
    const title = interaction.options.getString("عنوان") ?? "🎫 نظام التذاكر";
    const desc = interaction.options.getString("وصف") ??
      "هل تحتاج مساعدة؟ اضغط على الزر أدناه لفتح تذكرة وسيتواصل معك فريق الدعم في أقرب وقت!";

    const channel = interaction.guild.channels.cache.get(ch.id) as TextChannel;
    if (!channel) { await interaction.reply({ content: "❌ لم أجد القناة.", ephemeral: true }); return; }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(title)
      .setDescription(desc)
      .addFields({
        name: "📋 كيف يعمل النظام",
        value:
          "**1️⃣** اضغط على زر **فتح تذكرة** أدناه\n" +
          "**2️⃣** تُنشأ قناة خاصة بك فقط وبفريق الدعم\n" +
          "**3️⃣** اشرح مشكلتك وسيرد عليك الفريق\n" +
          "**4️⃣** أغلق التذكرة عند الانتهاء ✅",
      })
      .setThumbnail(interaction.guild.iconURL({ size: 256 }) ?? null)
      .setFooter({ text: `${interaction.guild.name} • نظام دعم التذاكر` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("فتح تذكرة")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Primary),
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ تم إنشاء لوحة التذاكر في ${channel}`, ephemeral: true });
  },
};

const ticketRole: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-setrole")
    .setDescription("🎫 تحديد رتبة فريق الدعم")
    .addRoleOption(o => o.setName("رتبة").setDescription("رتبة فريق الدعم").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const role = interaction.options.getRole("رتبة", true);
    getConfig(interaction.guildId).supportRoleId = role.id;
    await interaction.reply({ content: `✅ تم تحديد <@&${role.id}> كرتبة دعم للتذاكر.`, ephemeral: true });
  },
};

const ticketCategory: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-setcategory")
    .setDescription("🎫 تحديد تصنيف قنوات التذاكر")
    .addChannelOption(o => o.setName("تصنيف").setDescription("تصنيف (Category) التذاكر").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cat = interaction.options.getChannel("تصنيف", true);
    getConfig(interaction.guildId).ticketCategoryId = cat.id;
    await interaction.reply({ content: `✅ تم تحديد التصنيف لقنوات التذاكر.`, ephemeral: true });
  },
};

const ticketLog: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-setlog")
    .setDescription("🎫 تحديد قناة سجل التذاكر")
    .addChannelOption(o => o.setName("قناة").setDescription("قناة لحفظ سجلات التذاكر المغلقة").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const ch = interaction.options.getChannel("قناة", true);
    getConfig(interaction.guildId).ticketLogChannelId = ch.id;
    await interaction.reply({ content: `✅ تم تحديد <#${ch.id}> كقناة سجل للتذاكر.`, ephemeral: true });
  },
};

const ticketClose: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-close")
    .setDescription("🔒 إغلاق التذكرة الحالية")
    .addStringOption(o => o.setName("سبب").setDescription("سبب الإغلاق").setRequired(false)),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.channelId) return;
    const cfg = getConfig(interaction.guildId);
    const ticket = cfg.openTickets.get(interaction.channelId);
    if (!ticket) { await interaction.reply({ content: "❌ هذه القناة ليست تذكرة.", ephemeral: true }); return; }
    const reason = interaction.options.getString("سبب") ?? "لا يوجد سبب محدد";
    await interaction.reply({ content: "🔒 جاري الإغلاق... القناة ستُحذف خلال 5 ثوانٍ." });
    await closeTicket(interaction.channel as TextChannel, interaction.guildId, ticket, reason, interaction.user.tag);
  },
};

const ticketAdd: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-add")
    .setDescription("➕ إضافة عضو إلى التذكرة")
    .addUserOption(o => o.setName("عضو").setDescription("العضو المراد إضافته").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.channelId) return;
    const cfg = getConfig(interaction.guildId);
    if (!cfg.openTickets.has(interaction.channelId)) {
      await interaction.reply({ content: "❌ هذه القناة ليست تذكرة.", ephemeral: true }); return;
    }
    const user = interaction.options.getUser("عضو", true);
    const ch = interaction.channel as TextChannel;
    await ch.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    await interaction.reply({ content: `✅ تم إضافة ${user} إلى التذكرة.` });
  },
};

const ticketRemove: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-remove")
    .setDescription("➖ إزالة عضو من التذكرة")
    .addUserOption(o => o.setName("عضو").setDescription("العضو المراد إزالته").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.channelId) return;
    const cfg = getConfig(interaction.guildId);
    if (!cfg.openTickets.has(interaction.channelId)) {
      await interaction.reply({ content: "❌ هذه القناة ليست تذكرة.", ephemeral: true }); return;
    }
    const user = interaction.options.getUser("عضو", true);
    const ch = interaction.channel as TextChannel;
    await ch.permissionOverwrites.delete(user.id);
    await interaction.reply({ content: `✅ تم إزالة ${user} من التذكرة.` });
  },
};

const ticketList: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-list")
    .setDescription("📋 عرض قائمة التذاكر المفتوحة")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const tickets = [...cfg.openTickets.entries()];
    if (tickets.length === 0) {
      await interaction.reply({ content: "✅ لا توجد تذاكر مفتوحة حالياً.", ephemeral: true }); return;
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 التذاكر المفتوحة (${tickets.length})`)
      .setDescription(
        tickets.map(([chId, t]) =>
          `**#${fmt(t.number)}** — <#${chId}> — <@${t.userId}> ${t.claimedBy ? `— 🤝 ${t.claimedBy}` : "— ⏳ بانتظار"}`
        ).join("\n")
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

// ── Ticket Panel (resend) ───────────────────────────────────────────────────
const ticketPanel: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("📤 إعادة إرسال لوحة التذاكر")
    .addChannelOption(o => o.setName("قناة").setDescription("القناة (افتراضي: الحالية)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const target = (interaction.options.getChannel("قناة") ?? interaction.channel) as TextChannel;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎫 نظام التذاكر")
      .setDescription("لفتح تذكرة دعم، اضغط على الزر أدناه وسيتم إنشاء قناة خاصة بك فوراً.")
      .setFooter({ text: interaction.guild?.name ?? "", iconURL: interaction.guild?.iconURL() ?? undefined })
      .setTimestamp();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_open").setLabel("🎫 فتح تذكرة").setStyle(ButtonStyle.Primary),
    );
    await target.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ تم إرسال لوحة التذاكر في <#${target.id}>`, ephemeral: true });
  },
};

// ── Ticket Stats ────────────────────────────────────────────────────────────
const ticketStats: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-stats")
    .setDescription("📊 إحصائيات نظام التذاكر")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const open = cfg.openTickets.size;
    const total = cfg.ticketCount;
    const claimed = [...cfg.openTickets.values()].filter(t => t.claimedBy).length;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📊 إحصائيات التذاكر")
      .addFields(
        { name: "🎫 إجمالي التذاكر", value: `${total}`, inline: true },
        { name: "🟢 مفتوحة", value: `${open}`, inline: true },
        { name: "🤝 مُستلَمة", value: `${claimed}`, inline: true },
        { name: "✅ مغلقة", value: `${total - open}`, inline: true },
        { name: "⏳ بانتظار دعم", value: `${open - claimed}`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

// ── Ticket Rename ───────────────────────────────────────────────────────────
const ticketRename: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket-rename")
    .setDescription("✏️ تغيير اسم قناة التذكرة الحالية")
    .addStringOption(o => o.setName("اسم").setDescription("الاسم الجديد").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.channel) return;
    const cfg = getConfig(interaction.guildId);
    if (!cfg.openTickets.has(interaction.channelId)) {
      await interaction.reply({ content: "❌ هذه القناة ليست تذكرة.", ephemeral: true }); return;
    }
    const newName = interaction.options.getString("اسم", true).toLowerCase().replace(/\s+/g, "-");
    await (interaction.channel as TextChannel).setName(`🎫-${newName}`);
    await interaction.reply(`✅ تم تغيير اسم التذكرة إلى **🎫-${newName}**`);
  },
};

export const ticketCommands: Command[] = [
  ticketSetup, ticketRole, ticketCategory, ticketLog,
  ticketClose, ticketAdd, ticketRemove, ticketList,
  ticketPanel, ticketStats, ticketRename,
];
