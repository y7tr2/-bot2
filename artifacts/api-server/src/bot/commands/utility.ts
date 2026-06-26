import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
} from "discord.js";
import type { Command } from "./types";
import { getConfig, addBalance, getBalance } from "../config";

interface SnipedMessage {
  content: string;
  author: string;
  avatar: string;
  time: number;
}
export const snipedMessages = new Map<string, SnipedMessage>();

export async function handleGiveawayButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) return;
  const cfg = getConfig(interaction.guildId);
  const ga = cfg.giveaways.get(interaction.message.id);
  if (!ga || ga.ended) {
    await interaction.reply({ content: "❌ انتهت هذه المسابقة.", ephemeral: true });
    return;
  }
  if (ga.participants.has(interaction.user.id)) {
    ga.participants.delete(interaction.user.id);
    await interaction.reply({ content: "❌ تم إلغاء مشاركتك في المسابقة.", ephemeral: true });
    return;
  }
  ga.participants.add(interaction.user.id);
  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .spliceFields(2, 1, { name: "👥 المشاركون", value: `${ga.participants.size}`, inline: true });
  await interaction.update({ embeds: [embed] });
}

const afk: Command = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("😴 تعيين حالة غائب")
    .addStringOption(o => o.setName("سبب").setDescription("سبب الغياب").setRequired(false)),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const reason = interaction.options.getString("سبب") ?? "غائب";
    getConfig(interaction.guildId).afkUsers.set(interaction.user.id, reason);
    await interaction.reply(`✅ تم تعيينك كغائب. السبب: **${reason}**`);
  },
};

const snipe: Command = {
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("🔍 عرض آخر رسالة محذوفة"),
  async execute(interaction) {
    const sniped = snipedMessages.get(interaction.channelId);
    if (!sniped) {
      await interaction.reply({ content: "❌ لا توجد رسائل محذوفة مؤخراً في هذه القناة.", ephemeral: true });
      return;
    }
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("🔍 رسالة محذوفة")
      .setAuthor({ name: sniped.author, iconURL: sniped.avatar })
      .setDescription(sniped.content || "*(لا يوجد نص — قد تكون صورة أو ملف)*")
      .setFooter({ text: `حُذفت <t:${Math.floor(sniped.time / 1000)}:R>` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const daily: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("💰 استلام مكافأة يومية"),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const last = cfg.lastDaily.get(interaction.user.id) ?? 0;
    const now = Date.now();
    const diff = now - last;
    const cooldown = 22 * 60 * 60 * 1000;
    if (diff < cooldown) {
      const remaining = Math.ceil((cooldown - diff) / (60 * 60 * 1000));
      await interaction.reply({ content: `⏰ يمكنك الاستلام بعد **${remaining}** ساعة.`, ephemeral: true });
      return;
    }
    cfg.lastDaily.set(interaction.user.id, now);
    const amount = cfg.dailyAmount;
    const newBalance = addBalance(interaction.guildId, interaction.user.id, amount);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("💰 مكافأة يومية!")
      .setDescription(`حصلت على **${amount} 🪙**!`)
      .addFields({ name: "💳 رصيدك الآن", value: `${newBalance} 🪙` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const balance: Command = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("💳 عرض رصيدك")
    .addUserOption(o => o.setName("عضو").setDescription("العضو (الافتراضي: أنت)").setRequired(false)),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const user = interaction.options.getUser("عضو") ?? interaction.user;
    const bal = getBalance(interaction.guildId, user.id);
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("💳 الرصيد")
      .setThumbnail(user.displayAvatarURL({ size: 128 }))
      .addFields({ name: user.tag, value: `**${bal} 🪙**` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const pay: Command = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("💸 تحويل عملات لعضو")
    .addUserOption(o => o.setName("عضو").setDescription("المستلم").setRequired(true))
    .addIntegerOption(o => o.setName("مبلغ").setDescription("المبلغ").setRequired(true).setMinValue(1)),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const target = interaction.options.getUser("عضو", true);
    const amount = interaction.options.getInteger("مبلغ", true);
    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "❌ لا تستطيع التحويل لنفسك.", ephemeral: true }); return;
    }
    const senderBal = getBalance(interaction.guildId, interaction.user.id);
    if (senderBal < amount) {
      await interaction.reply({ content: `❌ رصيدك غير كافٍ. رصيدك: **${senderBal} 🪙**`, ephemeral: true }); return;
    }
    addBalance(interaction.guildId, interaction.user.id, -amount);
    addBalance(interaction.guildId, target.id, amount);
    await interaction.reply(`✅ تم تحويل **${amount} 🪙** لـ ${target}.`);
  },
};

const leaderboard: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("🏆 قائمة أثرى الأعضاء"),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const sorted = [...cfg.currency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    if (sorted.length === 0) {
      await interaction.reply({ content: "📊 لا يوجد بيانات بعد.", ephemeral: true }); return;
    }
    const medals = ["🥇", "🥈", "🥉"];
    const description = sorted
      .map(([id, bal], i) => `${medals[i] ?? `**${i + 1}.**`} <@${id}> — **${bal} 🪙**`)
      .join("\n");
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("🏆 قائمة أثرى الأعضاء")
      .setDescription(description)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const setdaily: Command = {
  data: new SlashCommandBuilder()
    .setName("setdaily")
    .setDescription("⚙️ تحديد مبلغ المكافأة اليومية")
    .addIntegerOption(o => o.setName("مبلغ").setDescription("المبلغ اليومي").setRequired(true).setMinValue(1).setMaxValue(100000))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const amount = interaction.options.getInteger("مبلغ", true);
    getConfig(interaction.guildId).dailyAmount = amount;
    await interaction.reply(`✅ تم تحديد المكافأة اليومية بـ **${amount} 🪙**.`);
  },
};

const givecoins: Command = {
  data: new SlashCommandBuilder()
    .setName("givecoins")
    .setDescription("💰 منح عملات لعضو")
    .addUserOption(o => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addIntegerOption(o => o.setName("مبلغ").setDescription("المبلغ").setRequired(true).setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const target = interaction.options.getUser("عضو", true);
    const amount = interaction.options.getInteger("مبلغ", true);
    const newBal = addBalance(interaction.guildId, target.id, amount);
    await interaction.reply(`✅ تم منح **${amount} 🪙** لـ ${target}. رصيده الآن: **${newBal} 🪙**.`);
  },
};

export const utilityCommands: Command[] = [
  afk, snipe, daily, balance, pay, leaderboard, setdaily, givecoins,
];
