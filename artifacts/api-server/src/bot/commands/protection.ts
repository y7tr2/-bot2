import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
} from "discord.js";
import type { Command } from "./types";
import { getConfig } from "../config";

export const LINK_REGEX_EXPORT = /(https?:\/\/|discord\.gg\/|discord\.com\/invite\/)/i;

interface SpamEntry { count: number; lastMessage: number; }
const spamMap = new Map<string, SpamEntry>();
interface RaidEntry { count: number; firstJoin: number; }
const raidMap = new Map<string, RaidEntry>();
interface NukeEntry { count: number; firstAction: number; }
const nukeMap = new Map<string, NukeEntry>();

export async function handleAntiSpam(member: GuildMember, channelId: string): Promise<boolean> {
  const cfg = getConfig(member.guild.id);
  if (!cfg.protection.antiSpam) return false;
  const key = `${member.guild.id}-${member.id}-${channelId}`;
  const now = Date.now();
  const entry = spamMap.get(key) ?? { count: 0, lastMessage: now };
  if (now - entry.lastMessage < cfg.protection.antiSpamInterval * 1000) {
    entry.count++;
  } else {
    entry.count = 1;
    entry.lastMessage = now;
  }
  entry.lastMessage = now;
  spamMap.set(key, entry);
  if (entry.count >= cfg.protection.antiSpamMax) {
    spamMap.delete(key);
    try {
      await member.timeout(60_000, "Anti-Spam");
    } catch { /* no perms */ }
    return true;
  }
  return false;
}

export async function handleAntiRaid(member: GuildMember): Promise<void> {
  const cfg = getConfig(member.guild.id);
  if (!cfg.protection.antiRaid) return;
  const key = member.guild.id;
  const now = Date.now();
  const entry = raidMap.get(key) ?? { count: 0, firstJoin: now };
  if (now - entry.firstJoin < cfg.protection.antiRaidInterval * 1000) {
    entry.count++;
  } else {
    entry.count = 1;
    entry.firstJoin = now;
  }
  raidMap.set(key, entry);
  if (entry.count >= cfg.protection.antiRaidMax) {
    raidMap.delete(key);
    try {
      await member.kick("Anti-Raid: طوفان انضمامات");
    } catch { /* no perms */ }
  }
}

export async function handleAntiNuke(guildId: string, userId: string, guild: Guild): Promise<void> {
  const cfg = getConfig(guildId);
  if (!cfg.protection.antiNuke) return;
  if (cfg.protection.whitelist.has(userId)) return;
  const key = `${guildId}-${userId}`;
  const now = Date.now();
  const entry = nukeMap.get(key) ?? { count: 0, firstAction: now };
  if (now - entry.firstAction < 30_000) {
    entry.count++;
  } else {
    entry.count = 1;
    entry.firstAction = now;
  }
  nukeMap.set(key, entry);
  if (entry.count >= 3) {
    nukeMap.delete(key);
    try {
      await guild.members.ban(userId, { reason: "Anti-Nuke: تدمير مشبوه" });
    } catch { /* no perms */ }
  }
}

const protection: Command = {
  data: new SlashCommandBuilder()
    .setName("protection")
    .setDescription("🛡️ إعدادات الحماية")
    .addStringOption(o => o.setName("نوع").setDescription("نوع الحماية").setRequired(true)
      .addChoices(
        { name: "🚫 مكافحة السبام", value: "antispam" },
        { name: "🌊 مكافحة الريد", value: "antiraid" },
        { name: "🔗 مكافحة الروابط", value: "antilink" },
        { name: "📢 مكافحة المنشنات", value: "antimention" },
        { name: "💣 مكافحة النيوك", value: "antinuke" },
      ))
    .addBooleanOption(o => o.setName("تفعيل").setDescription("تفعيل أو تعطيل").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const type = interaction.options.getString("نوع", true);
    const enable = interaction.options.getBoolean("تفعيل", true);
    const p = getConfig(interaction.guildId).protection;
    const map: Record<string, keyof typeof p> = {
      antispam: "antiSpam",
      antiraid: "antiRaid",
      antilink: "antiLink",
      antimention: "antiMention",
      antinuke: "antiNuke",
    };
    const key = map[type];
    if (!key) return;
    (p as any)[key] = enable;
    await interaction.reply(`✅ تم ${enable ? "تفعيل" : "تعطيل"} **${type}**.`);
  },
};

const whitelist: Command = {
  data: new SlashCommandBuilder()
    .setName("whitelist")
    .setDescription("⬜ إضافة عضو/رتبة لقائمة الاستثناء")
    .addUserOption(o => o.setName("عضو").setDescription("العضو").setRequired(false))
    .addRoleOption(o => o.setName("رتبة").setDescription("الرتبة").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const user = interaction.options.getUser("عضو");
    const role = interaction.options.getRole("رتبة");
    if (!user && !role) { await interaction.reply({ content: "❌ حدد عضواً أو رتبة.", ephemeral: true }); return; }
    const p = getConfig(interaction.guildId).protection;
    if (user) p.whitelist.add(user.id);
    if (role) p.whitelist.add(role.id);
    await interaction.reply(`✅ تمت إضافة ${user ? user.tag : `<@&${role!.id}>`} لقائمة الاستثناء.`);
  },
};

const protectionStatus: Command = {
  data: new SlashCommandBuilder()
    .setName("protection-status")
    .setDescription("🛡️ عرض حالة الحماية")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const p = getConfig(interaction.guildId).protection;
    const fmt = (v: boolean) => v ? "✅ مفعّل" : "❌ معطّل";
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🛡️ حالة الحماية")
      .addFields(
        { name: "🚫 Anti-Spam", value: fmt(p.antiSpam), inline: true },
        { name: "🌊 Anti-Raid", value: fmt(p.antiRaid), inline: true },
        { name: "🔗 Anti-Link", value: fmt(p.antiLink), inline: true },
        { name: "📢 Anti-Mention", value: fmt(p.antiMention), inline: true },
        { name: "💣 Anti-Nuke", value: fmt(p.antiNuke), inline: true },
        { name: "⬜ القائمة البيضاء", value: `${p.whitelist.size} مدخل`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export const protectionCommands: Command[] = [protection, whitelist, protectionStatus];
