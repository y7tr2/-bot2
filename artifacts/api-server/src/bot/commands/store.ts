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
      await interaction.reply({ content: "🏪 المتجر فارغ حالياً.", ephemeral: true });
      return;
    }
    const bal = getBalance(interaction.guildId, interaction.user.id);
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`🏪 متجر ${interaction.guild?.name}`)
      .setDescription(`💰 رصيدك: **${bal.toLocaleString()} ${CURRENCY}**\n\nللشراء: \`/store-buy\`\n`)
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
      .setFooter({ text: `${items.length} منتج` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const storeAdd: Command = {
  data: new SlashCommandBuilder()
    .setName("store-add")
    .setDescription("➕ إضافة منتج للمتجر")
    .addStringOption(o => o.setName("اسم").setDescription("اسم المنتج").setRequired(true))
    .addIntegerOption(o => o.setName("سعر").setDescription("السعر").setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName("وصف").setDescription("وصف المنتج").setRequired(false))
    .addRoleOption(o => o.setName("رتبة").setDescription("رتبة تُعطى عند الشراء").setRequired(false))
    .addIntegerOption(o => o.setName("مخزون").setDescription("الكمية (-1 = غير محدود)").setRequired(false).setMinValue(-1))
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
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const storeBuy: Command = {
  data: new SlashCommandBuilder()
    .setName("store-buy")
    .setDescription("🛒 شراء منتج")
    .addStringOption(o => o.setName("id").setDescription("رمز المنتج").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.guild) return;
    const id = interaction.options.getString("id", true).toUpperCase();
    const cfg = getConfig(interaction.guildId);
    const item = cfg.storeItems.get(id);
    if (!item) {
      await interaction.reply({ content: "❌ المنتج غير موجود.", ephemeral: true }); return;
    }
    if (item.stock !== -1 && item.sold >= item.stock) {
      await interaction.reply({ content: "❌ نفد المخزون.", ephemeral: true }); return;
    }
    const bal = getBalance(interaction.guildId, interaction.user.id);
    if (bal < item.price) {
      await interaction.reply({ content: `❌ رصيدك غير كافٍ. تحتاج **${item.price} ${CURRENCY}** ورصيدك **${bal} ${CURRENCY}**.`, ephemeral: true }); return;
    }
    addBalance(interaction.guildId, interaction.user.id, -item.price);
    item.sold++;
    if (item.roleId) {
      const role = interaction.guild.roles.cache.get(item.roleId);
      const member = interaction.member as GuildMember;
      if (role && member) await member.roles.add(role).catch(() => {});
    }
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("✅ تمت عملية الشراء!")
      .addFields(
        { name: "📦 المنتج", value: item.name, inline: true },
        { name: "💰 المدفوع", value: `${item.price} ${CURRENCY}`, inline: true },
        { name: "💳 الرصيد المتبقي", value: `${getBalance(interaction.guildId, interaction.user.id)} ${CURRENCY}`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const storeRemove: Command = {
  data: new SlashCommandBuilder()
    .setName("store-remove")
    .setDescription("🗑️ إزالة منتج من المتجر")
    .addStringOption(o => o.setName("id").setDescription("رمز المنتج").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const id = interaction.options.getString("id", true).toUpperCase();
    const cfg = getConfig(interaction.guildId);
    if (!cfg.storeItems.has(id)) {
      await interaction.reply({ content: "❌ المنتج غير موجود.", ephemeral: true }); return;
    }
    cfg.storeItems.delete(id);
    await interaction.reply(`✅ تم حذف المنتج \`${id}\`.`);
  },
};

export const storeCommands: Command[] = [store, storeAdd, storeBuy, storeRemove];
