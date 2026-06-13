import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildMember,
  type TextChannel,
  type Guild,
} from "discord.js";
import type { Command } from "./types";
import { getConfig } from "../config";

// ── Module-level trackers (ephemeral, reset on restart) ────────────────────
export const spamMap = new Map<string, number[]>();     // `guildId:userId` → timestamps
export const raidMap = new Map<string, number[]>();     // guildId → join timestamps
export const nukeMap = new Map<string, number[]>();     // `guildId:userId` → action timestamps

// ── Helpers ─────────────────────────────────────────────────────────────────
const LINK_REGEX = /https?:\/\/\S+|discord\.gg\/\S+|discord\.com\/invite\/\S+/i;

async function sendProtectionLog(guild: Guild, title: string, description: string, color = 0xed4245) {
  const cfg = getConfig(guild.id);
  const logId = cfg.logChannelId;
  if (!logId) return;
  const ch = guild.channels.cache.get(logId) as TextChannel | undefined;
  if (!ch) return;
  const embed = new EmbedBuilder().setColor(color).setTitle(`🛡️ ${title}`).setDescription(description).setTimestamp();
  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function handleAntiSpam(member: GuildMember, channelId: string): Promise<boolean> {
  const cfg = getConfig(member.guild.id);
  if (!cfg.protection.antiSpam) return false;
  if (cfg.protection.whitelist.has(member.id)) return false;

  const key = `${member.guild.id}:${member.id}`;
  const now = Date.now();
  const interval = cfg.protection.antiSpamInterval * 1000;
  const times = (spamMap.get(key) ?? []).filter(t => now - t < interval);
  times.push(now);
  spamMap.set(key, times);

  if (times.length >= cfg.protection.antiSpamMax) {
    spamMap.delete(key);
    try {
      await member.timeout(10 * 60 * 1000, "Anti-Spam: رسائل متكررة");
      await sendProtectionLog(member.guild, "Anti-Spam", `${member} تم كتمه تلقائياً بسبب الرسائل المتكررة في <#${channelId}>`);
    } catch { /* no perms */ }
    return true;
  }
  return false;
}

export async function handleAntiRaid(member: GuildMember): Promise<void> {
  const cfg = getConfig(member.guild.id);
  if (!cfg.protection.antiRaid) return;

  const now = Date.now();
  const interval = cfg.protection.antiRaidInterval * 1000;
  const joins = (raidMap.get(member.guild.id) ?? []).filter(t => now - t < interval);
  joins.push(now);
  raidMap.set(member.guild.id, joins);

  if (joins.length >= cfg.protection.antiRaidMax) {
    raidMap.delete(member.guild.id);
    await sendProtectionLog(member.guild, "⚠️ Anti-Raid — وضع الطوارئ",
      `تم رصد **${joins.length}** انضمام في ${cfg.protection.antiRaidInterval} ثانية!\nجاري قفل السيرفر...`, 0xff0000);
    // Lock all text channels
    for (const [, ch] of member.guild.channels.cache) {
      if (ch.isTextBased() && "permissionOverwrites" in ch) {
        await (ch as TextChannel).permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: false })
          .catch(() => {});
      }
    }
  }
}

export async function handleAntiNuke(guildId: string, userId: string, guild: Guild): Promise<void> {
  const cfg = getConfig(guildId);
  if (!cfg.protection.antiNuke) return;
  if (cfg.protection.whitelist.has(userId)) return;

  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const actions = (nukeMap.get(key) ?? []).filter(t => now - t < 60_000);
  actions.push(now);
  nukeMap.set(key, actions);

  if (actions.length >= 3) {
    nukeMap.delete(key);
    const member = guild.members.cache.get(userId);
    if (member) {
      const rolesToRemove = member.roles.cache.filter(r =>
        r.permissions.has(PermissionFlagsBits.Administrator) ||
        r.permissions.has(PermissionFlagsBits.ManageChannels) ||
        r.permissions.has(PermissionFlagsBits.BanMembers),
      );
      for (const [, role] of rolesToRemove) {
        await member.roles.remove(role).catch(() => {});
      }
      await sendProtectionLog(guild, "🚨 Anti-Nuke — تم التحييد",
        `${member} تم سحب صلاحياته تلقائياً بسبب ${actions.length} إجراءات خطيرة خلال دقيقة!`, 0xff0000);
    }
  }
}

// ── Commands ────────────────────────────────────────────────────────────────

const protection: Command = {
  data: new SlashCommandBuilder()
    .setName("protection")
    .setDescription("🛡️ عرض حالة نظام الحماية")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const p = getConfig(interaction.guildId).protection;
    const on = "🟢 مفعّل", off = "🔴 مُعطَّل";
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🛡️ نظام الحماية")
      .addFields(
        { name: "🔄 Anti-Spam", value: `${p.antiSpam ? on : off}\nالحد: ${p.antiSpamMax} رسالة / ${p.antiSpamInterval}ث`, inline: true },
        { name: "🚨 Anti-Raid", value: `${p.antiRaid ? on : off}\nالحد: ${p.antiRaidMax} انضمام / ${p.antiRaidInterval}ث`, inline: true },
        { name: "🔗 Anti-Link", value: p.antiLink ? on : off, inline: true },
        { name: "📢 Anti-Mention", value: `${p.antiMention ? on : off}\nالحد: ${p.antiMentionMax}`, inline: true },
        { name: "💣 Anti-Nuke", value: p.antiNuke ? on : off, inline: true },
        { name: "📋 Whitelist", value: `${p.whitelist.size} عنصر`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const antispam: Command = {
  data: new SlashCommandBuilder()
    .setName("antispam")
    .setDescription("🔄 إعداد مكافح السبام")
    .addBooleanOption(o => o.setName("تفعيل").setDescription("تفعيل أو إيقاف").setRequired(true))
    .addIntegerOption(o => o.setName("حد").setDescription("عدد الرسائل قبل الكتم (افتراضي 5)").setRequired(false).setMinValue(3).setMaxValue(20))
    .addIntegerOption(o => o.setName("فترة").setDescription("الفترة بالثواني (افتراضي 4)").setRequired(false).setMinValue(2).setMaxValue(30))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const p = getConfig(interaction.guildId).protection;
    p.antiSpam = interaction.options.getBoolean("تفعيل", true);
    if (interaction.options.getInteger("حد")) p.antiSpamMax = interaction.options.getInteger("حد")!;
    if (interaction.options.getInteger("فترة")) p.antiSpamInterval = interaction.options.getInteger("فترة")!;
    await interaction.reply(`🔄 Anti-Spam: ${p.antiSpam ? "🟢 مفعّل" : "🔴 مُعطَّل"} | الحد: ${p.antiSpamMax} رسالة / ${p.antiSpamInterval}ث`);
  },
};

const antiraid: Command = {
  data: new SlashCommandBuilder()
    .setName("antiraid")
    .setDescription("🚨 إعداد مكافح الريد")
    .addBooleanOption(o => o.setName("تفعيل").setDescription("تفعيل أو إيقاف").setRequired(true))
    .addIntegerOption(o => o.setName("حد").setDescription("عدد الانضمامات قبل الطوارئ (افتراضي 8)").setRequired(false).setMinValue(3).setMaxValue(30))
    .addIntegerOption(o => o.setName("فترة").setDescription("الفترة بالثواني (افتراضي 10)").setRequired(false).setMinValue(5).setMaxValue(60))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const p = getConfig(interaction.guildId).protection;
    p.antiRaid = interaction.options.getBoolean("تفعيل", true);
    if (interaction.options.getInteger("حد")) p.antiRaidMax = interaction.options.getInteger("حد")!;
    if (interaction.options.getInteger("فترة")) p.antiRaidInterval = interaction.options.getInteger("فترة")!;
    await interaction.reply(`🚨 Anti-Raid: ${p.antiRaid ? "🟢 مفعّل" : "🔴 مُعطَّل"} | الحد: ${p.antiRaidMax} انضمام / ${p.antiRaidInterval}ث`);
  },
};

const antilink: Command = {
  data: new SlashCommandBuilder()
    .setName("antilink")
    .setDescription("🔗 تفعيل / إيقاف مكافح الروابط")
    .addBooleanOption(o => o.setName("تفعيل").setDescription("تفعيل أو إيقاف").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    getConfig(interaction.guildId).protection.antiLink = interaction.options.getBoolean("تفعيل", true);
    await interaction.reply(`🔗 Anti-Link: ${interaction.options.getBoolean("تفعيل", true) ? "🟢 مفعّل" : "🔴 مُعطَّل"}`);
  },
};

const antinuke: Command = {
  data: new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("💣 تفعيل / إيقاف مكافح النيوك")
    .addBooleanOption(o => o.setName("تفعيل").setDescription("تفعيل أو إيقاف").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    getConfig(interaction.guildId).protection.antiNuke = interaction.options.getBoolean("تفعيل", true);
    await interaction.reply(`💣 Anti-Nuke: ${interaction.options.getBoolean("تفعيل", true) ? "🟢 مفعّل" : "🔴 مُعطَّل"}`);
  },
};

const antimention: Command = {
  data: new SlashCommandBuilder()
    .setName("antimention")
    .setDescription("📢 إعداد مكافح المنشنات العشوائية")
    .addBooleanOption(o => o.setName("تفعيل").setDescription("تفعيل أو إيقاف").setRequired(true))
    .addIntegerOption(o => o.setName("حد").setDescription("أقصى عدد منشنات (افتراضي 5)").setRequired(false).setMinValue(2).setMaxValue(20))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const p = getConfig(interaction.guildId).protection;
    p.antiMention = interaction.options.getBoolean("تفعيل", true);
    if (interaction.options.getInteger("حد")) p.antiMentionMax = interaction.options.getInteger("حد")!;
    await interaction.reply(`📢 Anti-Mention: ${p.antiMention ? "🟢 مفعّل" : "🔴 مُعطَّل"} | الحد: ${p.antiMentionMax}`);
  },
};

const whitelistAdd: Command = {
  data: new SlashCommandBuilder()
    .setName("whitelist-add")
    .setDescription("✅ إضافة عضو أو رتبة لقائمة استثناءات الحماية")
    .addMentionableOption(o => o.setName("عنصر").setDescription("عضو أو رتبة").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const target = interaction.options.getMentionable("عنصر", true);
    const id = "id" in target ? target.id : (target as any).id;
    getConfig(interaction.guildId).protection.whitelist.add(id);
    await interaction.reply(`✅ تمت إضافة <@${id}> إلى قائمة الاستثناءات.`);
  },
};

const whitelistRemove: Command = {
  data: new SlashCommandBuilder()
    .setName("whitelist-remove")
    .setDescription("❌ إزالة عنصر من قائمة استثناءات الحماية")
    .addMentionableOption(o => o.setName("عنصر").setDescription("عضو أو رتبة").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const target = interaction.options.getMentionable("عنصر", true);
    const id = "id" in target ? target.id : (target as any).id;
    getConfig(interaction.guildId).protection.whitelist.delete(id);
    await interaction.reply(`✅ تمت إزالة <@${id}> من قائمة الاستثناءات.`);
  },
};

const lockdown: Command = {
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("🔒 قفل / فتح جميع قنوات السيرفر")
    .addBooleanOption(o => o.setName("قفل").setDescription("true للقفل، false للفتح").setRequired(true))
    .addStringOption(o => o.setName("سبب").setDescription("سبب القفل").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guild) return;
    await interaction.deferReply();
    const doLock = interaction.options.getBoolean("قفل", true);
    const reason = interaction.options.getString("سبب") ?? (doLock ? "قفل تلقائي" : "فتح تلقائي");
    let count = 0;
    for (const [, ch] of interaction.guild.channels.cache) {
      if (ch.isTextBased() && "permissionOverwrites" in ch) {
        await (ch as TextChannel).permissionOverwrites
          .edit(interaction.guild.roles.everyone, { SendMessages: doLock ? false : null })
          .catch(() => {});
        count++;
      }
    }
    const embed = new EmbedBuilder()
      .setColor(doLock ? 0xed4245 : 0x57f287)
      .setTitle(doLock ? "🔒 تم قفل السيرفر" : "🔓 تم فتح السيرفر")
      .addFields(
        { name: "📋 السبب", value: reason, inline: true },
        { name: "📊 القنوات المتأثرة", value: `${count}`, inline: true },
        { name: "👤 بواسطة", value: `${interaction.user}`, inline: true },
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    await sendProtectionLog(interaction.guild, doLock ? "🔒 Lockdown مفعّل" : "🔓 Lockdown مُنهى",
      `بواسطة ${interaction.user.tag} — السبب: ${reason}`, doLock ? 0xed4245 : 0x57f287);
  },
};

export const LINK_REGEX_EXPORT = LINK_REGEX;

export const protectionCommands: Command[] = [
  protection, antispam, antiraid, antilink, antinuke, antimention,
  whitelistAdd, whitelistRemove, lockdown,
];
