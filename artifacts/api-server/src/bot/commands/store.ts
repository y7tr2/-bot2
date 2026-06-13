import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildMember,
} from "discord.js";
import type { Command } from "./types";
import { getConfig, getBalance, addBalance, type StoreItem } from "../config";

const CURRENCY = "🪙";

function uid(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const store: Command = {
  data: new SlashCommandBuilder()
    .setName("store")
    .setDescription("🏪 عرض المتجر"),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const items = [...cfg.storeItems.values()];
    if (items.length === 0) {
      await interaction.reply({ content: "🏪 المتجر فارغ حالياً — انتظر حتى يضيف الإدارة بضاعة!", ephemeral: true });
      return;
    }
    const bal = getBalance(interaction.guildId, interaction.user.id);
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`🏪 متجر ${interaction.guild?.name}`)
      .setDescription(`💰 رصيدك: **${bal.toLocaleString()} ${CURRENCY}**\n\nللشراء استخدم: \`/store-buy id:<رمز البضاعة>\`\n`)
      .addFields(
        items.map(item => ({
          name: `${item.name}  |  \`${item.id}\``,
          value:
            `📝 ${item.description}\n` +
            `💰 **${item.price.toLocaleString()} ${CURRENCY}**` +
            (item.roleId ? `  |  🎭 <@&${item.roleId}>` : "") +
            `  |  📦 ${item.stock === -1 ? "∞" : `${item.stock - item.sold} متبقي`}`,
        })),
      )
      .setFooter({ text: `${items.length} منتج متاح` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const storeAdd: Command = {
  data: new SlashCommandBuilder()
    .setName("store-add")
    .setDescription("➕ إضافة منتج للمتجر")
    .addStringOption(o => o.setName("اسم").setDescription("اسم المنتج").setRequired(true))
    .addIntegerOption(o => o.setName("سعر").setDescription("السعر بالعملات").setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName("وصف").setDescription("وصف المنتج").setRequired(false))
    .addRoleOption(o => o.setName("رتبة").setDescription("رتبة تُعطى عند الشراء").setRequired(false))
    .addIntegerOption(o => o.setName("مخزون").setDescription("الكمية المتاحة (-1 = غير محدود)").setRequired(false).setMinValue(-1))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const id = uid();
    const item: StoreItem = {
      id,
      name: interaction.options.getString("اسم", true),
      description: interaction.options.getString("وصف") ?? "لا يوجد وصف",
      price: interaction.options.getInteger("سعر", true),
      roleId: interaction.options.getRole("رتبة")?.id ?? null,
      stock: interaction.options.getInteger("مخزون") ?? -1,
      sold: 0,
    };
    getConfig(interaction.guildId).storeItems.set(id, item);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("✅ تمت إضافة المنتج")
      .addFields(
        { name: "📦 الاسم", value: item.name, inline: true },
        { name: "🔖 الرمز", value: `\`${id}\``, inline: true },
        { name: `💰 السعر`, value: `${item.price} ${CURRENCY}`, inline: true },
        { name: "📦 المخزون", value: item.stock === -1 ? "غير محدود" : `${item.stock}`, inline: true },
        ...(item.roleId ? [{ name: "🎭 الجائزة", value: `<@&${item.roleId}>`, inline: true }] : []),
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const storeRemove: Command = {
  data: new SlashCommandBuilder()
    .setName("store-remove")
    .setDescription("🗑️ حذف منتج من المتجر")
    .addStringOption(o => o.setName("id").setDescription("رمز المنتج").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const id = interaction.options.getString("id", true).toUpperCase();
    const items = getConfig(interaction.guildId).storeItems;
    if (!items.has(id)) { await interaction.reply({ content: "❌ لم أجد هذا المنتج.", ephemeral: true }); return; }
    const name = items.get(id)!.name;
    items.delete(id);
    await interaction.reply(`✅ تم حذف **${name}** من المتجر.`);
  },
};

const storeBuy: Command = {
  data: new SlashCommandBuilder()
    .setName("store-buy")
    .setDescription("🛒 شراء منتج من المتجر")
    .addStringOption(o => o.setName("id").setDescription("رمز المنتج (الكود)").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.guild) return;
    const id = interaction.options.getString("id", true).toUpperCase();
    const cfg = getConfig(interaction.guildId);
    const item = cfg.storeItems.get(id);
    if (!item) { await interaction.reply({ content: "❌ لم أجد هذا المنتج. تحقق من الرمز.", ephemeral: true }); return; }
    if (item.stock !== -1 && item.sold >= item.stock) {
      await interaction.reply({ content: "❌ نفد المخزون!", ephemeral: true }); return;
    }
    const bal = getBalance(interaction.guildId, interaction.user.id);
    if (bal < item.price) {
      await interaction.reply({ content: `❌ رصيدك غير كافٍ! لديك **${bal} ${CURRENCY}** وتحتاج **${item.price} ${CURRENCY}**.`, ephemeral: true });
      return;
    }
    addBalance(interaction.guildId, interaction.user.id, -item.price);
    item.sold++;
    if (item.roleId) {
      const member = interaction.member as GuildMember;
      const role = interaction.guild.roles.cache.get(item.roleId);
      if (role) await member.roles.add(role).catch(() => {});
    }
    const newBal = getBalance(interaction.guildId, interaction.user.id);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("🛒 تم الشراء بنجاح!")
      .setDescription(`اشتريت **${item.name}**!`)
      .addFields(
        { name: "💰 المدفوع", value: `${item.price} ${CURRENCY}`, inline: true },
        { name: "💰 الرصيد المتبقي", value: `${newBal.toLocaleString()} ${CURRENCY}`, inline: true },
        ...(item.roleId ? [{ name: "🎭 تم منحك رتبة", value: `<@&${item.roleId}>`, inline: true }] : []),
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const balance: Command = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription(`${CURRENCY} عرض رصيدك`)
    .addUserOption(o => o.setName("عضو").setDescription("عضو آخر (اختياري)").setRequired(false)),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const user = interaction.options.getUser("عضو") ?? interaction.user;
    const bal = getBalance(interaction.guildId, user.id);
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`💰 رصيد ${user.username}`)
      .setDescription(`**${bal.toLocaleString()} ${CURRENCY}**`)
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const daily: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription(`${CURRENCY} استلام المكافأة اليومية`),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    const now = Date.now();
    const lastClaim = cfg.lastDaily.get(interaction.user.id) ?? 0;
    const cooldown = 24 * 60 * 60 * 1000;
    if (now - lastClaim < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastClaim)) / 3600000);
      await interaction.reply({ content: `⏰ يمكنك المطالبة بمكافأتك اليومية بعد **${remaining}** ساعة.`, ephemeral: true });
      return;
    }
    cfg.lastDaily.set(interaction.user.id, now);
    const amount = cfg.dailyAmount;
    const newBal = addBalance(interaction.guildId, interaction.user.id, amount);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("🎁 مكافأة يومية!")
      .setDescription(`حصلت على **${amount} ${CURRENCY}**!`)
      .addFields({ name: "💰 رصيدك الكلي", value: `${newBal.toLocaleString()} ${CURRENCY}` })
      .setFooter({ text: "تعود غداً للمكافأة القادمة!" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const givePoints: Command = {
  data: new SlashCommandBuilder()
    .setName("give-points")
    .setDescription(`${CURRENCY} منح / خصم عملات من عضو`)
    .addUserOption(o => o.setName("عضو").setDescription("العضو").setRequired(true))
    .addIntegerOption(o => o.setName("كمية").setDescription("الكمية (سالب للخصم)").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const user = interaction.options.getUser("عضو", true);
    const amount = interaction.options.getInteger("كمية", true);
    const newBal = addBalance(interaction.guildId, user.id, amount);
    const sign = amount >= 0 ? "+" : "";
    await interaction.reply(`✅ ${sign}${amount} ${CURRENCY} لـ ${user} | رصيده الآن: **${newBal.toLocaleString()} ${CURRENCY}**`);
  },
};

const leaderboard: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("🏆 أغنى أعضاء السيرفر"),
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
    const desc = sorted.map(([id, bal], i) =>
      `${medals[i] ?? `**${i + 1}.**`} <@${id}> — **${bal.toLocaleString()} ${CURRENCY}**`
    ).join("\n");
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`🏆 أغنى أعضاء ${interaction.guild?.name}`)
      .setDescription(desc)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const setDaily: Command = {
  data: new SlashCommandBuilder()
    .setName("set-daily")
    .setDescription("⚙️ تحديد قيمة المكافأة اليومية")
    .addIntegerOption(o => o.setName("كمية").setDescription("قيمة المكافأة اليومية").setRequired(true).setMinValue(1).setMaxValue(100000))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const amount = interaction.options.getInteger("كمية", true);
    getConfig(interaction.guildId).dailyAmount = amount;
    await interaction.reply(`✅ المكافأة اليومية أصبحت **${amount} ${CURRENCY}**.`);
  },
};

export const storeCommands: Command[] = [
  store, storeAdd, storeRemove, storeBuy, balance, daily, givePoints, leaderboard, setDaily,
];
