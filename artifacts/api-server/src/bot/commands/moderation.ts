import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import type { Command } from "./types";
import { addWarning, getWarnings, clearWarnings as clearW } from "../config";

const kick: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 طرد عضو من السيرفر")
    .addUserOption((o) => o.setName("عضو").setDescription("العضو المراد طرده").setRequired(true))
    .addStringOption((o) => o.setName("سبب").setDescription("سبب الطرد").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const target = interaction.options.getMember("عضو") as GuildMember | null;
    if (!target) { await interaction.reply({ content: "❌ العضو غير موجود.", ephemeral: true }); return; }
    const reason = interaction.options.getString("سبب") ?? "لم يُذكر سبب";
    if (!target.kickable) { await interaction.reply({ content: "❌ لا أستطيع طرد هذا العضو.", ephemeral: true }); return; }
    await target.kick(reason);
    const embed = new EmbedBuilder().setColor(0xed4245).setTitle("👢 تم الطرد")
      .addFields({ name: "العضو", value: target.user.tag }, { name: "السبب", value: reason }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const ban: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 حظر عضو من السيرفر")
    .addUserOption((o) => o.setName("عضو").setDescription("العضو المراد حظره").setRequired(true))
    .addStringOption((o) => o.setName("سبب").setDescription("سبب الحظر").setRequired(false))
    .addIntegerOption((o) => o.setName("مسح").setDescription("مسح رسائل (بالأيام 0-7)").setRequired(false).setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const target = interaction.options.getMember("عضو") as GuildMember | null;
    if (!target) { await interaction.reply({ content: "❌ العضو غير موجود.", ephemeral: true }); return; }
    const reason = interaction.options.getString("سبب") ?? "لم يُذكر سبب";
    const days = interaction.options.getInteger("مسح") ?? 0;
    if (!target.bannable) { await interaction.reply({ content: "❌ لا أستطيع حظر هذا العضو.", ephemeral: true }); return; }
    await target.ban({ reason, deleteMessageSeconds: days * 86400 });
    const embed = new EmbedBuilder().setColor(0xed4245).setTitle("🔨 تم الحظر")
      .addFields({ name: "العضو", value: target.user.tag }, { name: "السبب", value: reason }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const unban: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("✅ رفع حظر عضو")
    .addStringOption((o) => o.setName("معرف").setDescription("معرّف العضو (ID)").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    if (!interaction.guild) return;
    const userId = interaction.options.getString("معرف", true);
    try {
      await interaction.guild.members.unban(userId);
      await interaction.reply(`✅ تم رفع الحظر عن العضو: \`${userId}\``);
    } catch {
      await interaction.reply({ content: "❌ لم أجد هذا العضو في قائمة الحظر.", ephemeral: true });
    }
  },
};

const mute: Command = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("🔇 كتم عضو مؤقتاً")
    .addUserOption((o) => o.setName("عضو").setDescription("العضو المراد كتمه").setRequired(true))
    .addIntegerOption((o) => o.setName("مدة").setDescription("المدة بالدقائق (1-40320)").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption((o) => o.setName("سبب").setDescription("سبب الكتم").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const target = interaction.options.getMember("عضو") as GuildMember | null;
    if (!target) { await interaction.reply({ content: "❌ العضو غير موجود.", ephemeral: true }); return; }
    const minutes = interaction.options.getInteger("مدة", true);
    const reason = interaction.options.getString("سبب") ?? "لم يُذكر سبب";
    await target.timeout(minutes * 60 * 1000, reason);
    const embed = new EmbedBuilder().setColor(0xfee75c).setTitle("🔇 تم الكتم")
      .addFields(
        { name: "العضو", value: target.user.tag },
        { name: "المدة", value: `${minutes} دقيقة` },
        { name: "السبب", value: reason },
      ).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const unmute: Command = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("🔊 رفع كتم عضو")
    .addUserOption((o) => o.setName("عضو").setDescription("العضو المراد رفع كتمه").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const target = interaction.options.getMember("عضو") as GuildMember | null;
    if (!target) { await interaction.reply({ content: "❌ العضو غير موجود.", ephemeral: true }); return; }
    await target.timeout(null);
    await interaction.reply(`✅ تم رفع الكتم عن **${target.user.tag}**.`);
  },
};

const warn: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("⚠️ إنذار عضو")
    .addUserOption((o) => o.setName("عضو").setDescription("العضو المراد إنذاره").setRequired(true))
    .addStringOption((o) => o.setName("سبب").setDescription("سبب الإنذار").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const target = interaction.options.getUser("عضو", true);
    const reason = interaction.options.getString("سبب", true);
    const count = addWarning(interaction.guildId, target.id, reason);
    const embed = new EmbedBuilder().setColor(0xfee75c).setTitle("⚠️ إنذار")
      .addFields(
        { name: "العضو", value: target.tag },
        { name: "السبب", value: reason },
        { name: "مجموع الإنذارات", value: `${count}` },
      ).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const warnings: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("📋 عرض إنذارات عضو")
    .addUserOption((o) => o.setName("عضو").setDescription("العضو").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const target = interaction.options.getUser("عضو", true);
    const warns = getWarnings(interaction.guildId, target.id);
    const embed = new EmbedBuilder().setColor(0xfee75c)
      .setTitle(`📋 إنذارات ${target.tag}`)
      .setDescription(warns.length ? warns.map((w, i) => `**${i + 1}.** ${w}`).join("\n") : "لا توجد إنذارات ✅")
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const clearwarnings: Command = {
  data: new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("🗑️ مسح إنذارات عضو")
    .addUserOption((o) => o.setName("عضو").setDescription("العضو").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const target = interaction.options.getUser("عضو", true);
    clearW(interaction.guildId, target.id);
    await interaction.reply(`✅ تم مسح جميع إنذارات **${target.tag}**.`);
  },
};

const clear: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("🗑️ مسح رسائل من القناة")
    .addIntegerOption((o) => o.setName("عدد").setDescription("عدد الرسائل (1-100)").setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const count = interaction.options.getInteger("عدد", true);
    const channel = interaction.channel;
    if (!channel || !("bulkDelete" in channel)) {
      await interaction.reply({ content: "❌ لا أستطيع مسح الرسائل في هذه القناة.", ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const deleted = await (channel as any).bulkDelete(count, true);
    await interaction.editReply(`✅ تم مسح **${deleted.size}** رسالة.`);
  },
};

const lock: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("🔒 قفل قناة")
    .addChannelOption((o) => o.setName("قناة").setDescription("القناة المراد قفلها (الافتراضية: الحالية)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!interaction.guild) return;
    const ch = (interaction.options.getChannel("قناة") ?? interaction.channel) as any;
    await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    await interaction.reply(`🔒 تم قفل القناة <#${ch.id}>.`);
  },
};

const roleAdd: Command = {
  data: new SlashCommandBuilder()
    .setName("role-add")
    .setDescription("🎭 إضافة رتبة لعضو")
    .addUserOption(o => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addRoleOption(o => o.setName("رتبة").setDescription("الرتبة المراد إضافتها").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    const target = interaction.options.getMember("عضو") as GuildMember | null;
    const role = interaction.options.getRole("رتبة", true);
    if (!target) { await interaction.reply({ content: "❌ العضو غير موجود.", ephemeral: true }); return; }
    if (!interaction.guild) return;
    const guildRole = interaction.guild.roles.cache.get(role.id);
    if (!guildRole) { await interaction.reply({ content: "❌ الرتبة غير موجودة.", ephemeral: true }); return; }
    await target.roles.add(guildRole);
    await interaction.reply(`✅ تم إضافة رتبة <@&${role.id}> لـ ${target.user.tag}.`);
  },
};

const roleRemove: Command = {
  data: new SlashCommandBuilder()
    .setName("role-remove")
    .setDescription("🎭 إزالة رتبة من عضو")
    .addUserOption(o => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addRoleOption(o => o.setName("رتبة").setDescription("الرتبة المراد إزالتها").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    const target = interaction.options.getMember("عضو") as GuildMember | null;
    const role = interaction.options.getRole("رتبة", true);
    if (!target) { await interaction.reply({ content: "❌ العضو غير موجود.", ephemeral: true }); return; }
    if (!interaction.guild) return;
    const guildRole = interaction.guild.roles.cache.get(role.id);
    if (!guildRole) { await interaction.reply({ content: "❌ الرتبة غير موجودة.", ephemeral: true }); return; }
    await target.roles.remove(guildRole);
    await interaction.reply(`✅ تم إزالة رتبة <@&${role.id}> من ${target.user.tag}.`);
  },
};

const nick: Command = {
  data: new SlashCommandBuilder()
    .setName("nick")
    .setDescription("✏️ تغيير لقب عضو")
    .addUserOption(o => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addStringOption(o => o.setName("لقب").setDescription("اللقب الجديد (اتركه فارغاً لإزالة اللقب)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
  async execute(interaction) {
    const target = interaction.options.getMember("عضو") as GuildMember | null;
    const newNick = interaction.options.getString("لقب") ?? null;
    if (!target) { await interaction.reply({ content: "❌ العضو غير موجود.", ephemeral: true }); return; }
    if (!target.manageable) { await interaction.reply({ content: "❌ لا أستطيع تغيير لقب هذا العضو.", ephemeral: true }); return; }
    await target.setNickname(newNick);
    await interaction.reply(newNick ? `✅ تم تغيير لقب **${target.user.tag}** إلى **${newNick}**.` : `✅ تم إزالة لقب **${target.user.tag}**.`);
  },
};

const voicekick: Command = {
  data: new SlashCommandBuilder()
    .setName("voicekick")
    .setDescription("🔊 طرد عضو من قناة الصوت")
    .addUserOption(o => o.setName("عضو").setDescription("العضو المراد طرده من الصوت").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),
  async execute(interaction) {
    const target = interaction.options.getMember("عضو") as GuildMember | null;
    if (!target) { await interaction.reply({ content: "❌ العضو غير موجود.", ephemeral: true }); return; }
    if (!target.voice.channel) { await interaction.reply({ content: "❌ العضو ليس في قناة صوتية.", ephemeral: true }); return; }
    await target.voice.disconnect();
    await interaction.reply(`✅ تم طرد **${target.user.tag}** من قناة الصوت.`);
  },
};

const purge: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("🗑️ حذف رسائل عضو معين من القناة")
    .addUserOption(o => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addIntegerOption(o => o.setName("عدد").setDescription("عدد الرسائل للفحص (1-100)").setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const target = interaction.options.getUser("عضو", true);
    const count = interaction.options.getInteger("عدد", true);
    const channel = interaction.channel;
    if (!channel || !("messages" in channel)) { await interaction.reply({ content: "❌ لا يمكن الحذف في هذه القناة.", ephemeral: true }); return; }
    await interaction.deferReply({ ephemeral: true });
    const messages = await (channel as any).messages.fetch({ limit: count });
    const toDelete = messages.filter((m: import("discord.js").Message) => m.author.id === target.id);
    if (toDelete.size === 0) { await interaction.editReply("❌ لا توجد رسائل لهذا العضو."); return; }
    await (channel as any).bulkDelete(toDelete, true);
    await interaction.editReply(`✅ تم حذف **${toDelete.size}** رسالة لـ ${target.tag}.`);
  },
};

export const moderationCommands: Command[] = [
  kick, ban, unban, mute, unmute, warn, warnings, clearwarnings, clear, lock,
  roleAdd, roleRemove, nick, voicekick, purge,
];
