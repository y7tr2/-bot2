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
  type VoiceChannel,
  type CategoryChannel,
} from "discord.js";
import type { Command } from "./types";

export const DECORATION_STYLES: Record<string, { name: string; prefix: string; suffix: string; emoji: string }> = {
  classic:  { name: "كلاسيك",   prefix: "〔",  suffix: "〕",  emoji: "🔷" },
  royal:    { name: "ملكي",     prefix: "「",  suffix: "」",  emoji: "👑" },
  stars:    { name: "نجوم",     prefix: "✦",   suffix: "✦",   emoji: "⭐" },
  arrows:   { name: "سهام",     prefix: "⟫",   suffix: "⟪",   emoji: "🏹" },
  diamond:  { name: "ماس",      prefix: "◈",   suffix: "◈",   emoji: "💎" },
  fire:     { name: "نار",      prefix: "🔥",   suffix: "🔥",   emoji: "🔥" },
  moon:     { name: "قمر",      prefix: "🌙",   suffix: "🌙",   emoji: "🌙" },
  wave:     { name: "موجة",     prefix: "〜",   suffix: "〜",   emoji: "🌊" },
  crown:    { name: "تاج",      prefix: "✿",   suffix: "✿",   emoji: "🌸" },
  shield:   { name: "درع",      prefix: "⚔️",   suffix: "⚔️",   emoji: "🛡️" },
};

interface PendingDecoration {
  style: string;
  channelIds: string[];
  requesterId: string;
  guildId: string;
  expiresAt: number;
}

export const pendingDecorations = new Map<string, PendingDecoration>();

function cleanChannelName(name: string): string {
  const prefixes = Object.values(DECORATION_STYLES).map(s => s.prefix);
  const suffixes = Object.values(DECORATION_STYLES).map(s => s.suffix);
  let clean = name;
  for (const p of prefixes) clean = clean.replace(new RegExp(`^${escapeRegex(p)}[-‑]?`, "u"), "");
  for (const s of suffixes) clean = clean.replace(new RegExp(`[-‑]?${escapeRegex(s)}$`, "u"), "");
  return clean.trim().replace(/^[-]+|[-]+$/g, "").trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decorateName(raw: string, prefix: string, suffix: string): string {
  const clean = cleanChannelName(raw);
  const result = `${prefix}${clean}${suffix}`;
  return result.slice(0, 100);
}

type DecoratableChannel = TextChannel | VoiceChannel | CategoryChannel;

function getDecoratableChannels(guild: import("discord.js").Guild): DecoratableChannel[] {
  return [...guild.channels.cache.values()].filter(
    (c): c is DecoratableChannel =>
      c.type === ChannelType.GuildText ||
      c.type === ChannelType.GuildVoice ||
      c.type === ChannelType.GuildCategory,
  );
}

const decorate: Command = {
  data: new SlashCommandBuilder()
    .setName("decorate")
    .setDescription("✨ تزخرف أسماء القنوات بأسلوب احترافي")
    .addStringOption(o =>
      o.setName("style")
        .setDescription("اختر نوع الزخرفة")
        .setRequired(true)
        .addChoices(
          { name: "🔷 كلاسيك  〔  〕",  value: "classic"  },
          { name: "👑 ملكي  「  」",      value: "royal"    },
          { name: "⭐ نجوم  ✦  ✦",       value: "stars"    },
          { name: "🏹 سهام  ⟫  ⟪",       value: "arrows"   },
          { name: "💎 ماس  ◈  ◈",         value: "diamond"  },
          { name: "🔥 نار  🔥  🔥",       value: "fire"     },
          { name: "🌙 قمر  🌙  🌙",       value: "moon"     },
          { name: "🌊 موجة  〜  〜",      value: "wave"     },
          { name: "🌸 زهور  ✿  ✿",       value: "crown"    },
          { name: "⚔️ درع  ⚔️  ⚔️",      value: "shield"   },
        ),
    )
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("قناة محددة — إذا تركتها فارغة سيتم تزخرف جميع القنوات")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!interaction.guild) return;

    const styleKey = interaction.options.getString("style", true);
    const style = DECORATION_STYLES[styleKey];
    const targetChannel = interaction.options.getChannel("channel");

    let channelIds: string[] = [];

    if (targetChannel) {
      const ch = interaction.guild.channels.cache.get(targetChannel.id);
      if (!ch) {
        await interaction.reply({ content: "❌ لم أجد هذه القناة.", ephemeral: true });
        return;
      }
      if (
        ch.type !== ChannelType.GuildText &&
        ch.type !== ChannelType.GuildVoice &&
        ch.type !== ChannelType.GuildCategory
      ) {
        await interaction.reply({ content: "❌ لا يمكن تزخرف هذا النوع من القنوات.", ephemeral: true });
        return;
      }
      channelIds = [ch.id];
    } else {
      channelIds = getDecoratableChannels(interaction.guild).map(c => c.id);
    }

    if (channelIds.length === 0) {
      await interaction.reply({ content: "❌ لا توجد قنوات قابلة للتزخرف.", ephemeral: true });
      return;
    }

    const pendingKey = `${interaction.id}`;
    pendingDecorations.set(pendingKey, {
      style: styleKey,
      channelIds,
      requesterId: interaction.user.id,
      guildId: interaction.guild.id,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    setTimeout(() => pendingDecorations.delete(pendingKey), 5 * 60 * 1000);

    const channels = channelIds
      .map(id => interaction.guild!.channels.cache.get(id))
      .filter(Boolean);

    const preview = channels
      .slice(0, 15)
      .map(ch => `• \`${cleanChannelName(ch!.name)}\` → \`${decorateName(ch!.name, style.prefix, style.suffix)}\``)
      .join("\n");

    const moreCount = channels.length - 15;

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${style.emoji} تأكيد تزخرف القنوات`)
      .setDescription(
        `**الأسلوب المختار:** ${style.name} \`${style.prefix}اسم القناة${style.suffix}\`\n\n` +
        `**القنوات التي سيتم تزخرفها (${channels.length} قناة):**\n` +
        preview +
        (moreCount > 0 ? `\n*... و${moreCount} قناة أخرى*` : ""),
      )
      .addFields({
        name: "⚠️ تنبيه",
        value: "هذا الإجراء سيغير أسماء القنوات المذكورة أعلاه. هل تريد المتابعة؟",
      })
      .setFooter({ text: `طُلب بواسطة ${interaction.user.tag} • ينتهي بعد 5 دقائق` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`decorate_confirm_${pendingKey}`)
        .setLabel("✅ تأكيد التزخرف")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`decorate_cancel_${pendingKey}`)
        .setLabel("❌ إلغاء")
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [confirmEmbed], components: [row] });
  },
};

export async function handleDecorationButton(interaction: ButtonInteraction): Promise<void> {
  const { customId, guild, user } = interaction;
  if (!guild) return;

  const isConfirm = customId.startsWith("decorate_confirm_");
  const isCancel = customId.startsWith("decorate_cancel_");

  const pendingKey = isConfirm
    ? customId.replace("decorate_confirm_", "")
    : customId.replace("decorate_cancel_", "");

  const pending = pendingDecorations.get(pendingKey);

  if (!pending) {
    await interaction.reply({ content: "❌ انتهت صلاحية هذا الطلب.", ephemeral: true });
    return;
  }

  if (pending.requesterId !== user.id) {
    await interaction.reply({ content: "❌ فقط من طلب الزخرفة يمكنه التأكيد.", ephemeral: true });
    return;
  }

  if (Date.now() > pending.expiresAt) {
    pendingDecorations.delete(pendingKey);
    await interaction.reply({ content: "❌ انتهت صلاحية هذا الطلب.", ephemeral: true });
    return;
  }

  if (isCancel) {
    pendingDecorations.delete(pendingKey);
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ تم إلغاء التزخرف")
          .setDescription("تم إلغاء عملية تزخرف القنوات.")
          .setTimestamp(),
      ],
      components: [],
    });
    return;
  }

  pendingDecorations.delete(pendingKey);

  const style = DECORATION_STYLES[pending.style];
  if (!style) {
    await interaction.reply({ content: "❌ نوع الزخرفة غير صالح.", ephemeral: true });
    return;
  }

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(`${style.emoji} جاري التزخرف...`)
        .setDescription(`يتم الآن تزخرف **${pending.channelIds.length}** قناة...\nقد يستغرق ذلك بضع ثوانٍ.`)
        .setTimestamp(),
    ],
    components: [],
  });

  let success = 0;
  let failed = 0;

  for (const channelId of pending.channelIds) {
    const ch = guild.channels.cache.get(channelId) as DecoratableChannel | undefined;
    if (!ch) { failed++; continue; }
    try {
      const newName = decorateName(ch.name, style.prefix, style.suffix);
      await ch.setName(newName, `تزخرفة بواسطة ${user.tag}`);
      success++;
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      failed++;
    }
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(success > 0 ? 0x57f287 : 0xed4245)
    .setTitle(`${style.emoji} اكتملت عملية التزخرف!`)
    .setDescription(
      `**الأسلوب:** ${style.name} \`${style.prefix}اسم${style.suffix}\`\n\n` +
      `✅ **نجح تزخرف:** ${success} قناة\n` +
      (failed > 0 ? `❌ **فشل تزخرف:** ${failed} قناة (عدم صلاحيات أو قنوات محمية)\n` : ""),
    )
    .setFooter({ text: `نُفّذ بواسطة ${user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [resultEmbed], components: [] });
}

export const decorationCommands: Command[] = [decorate];
