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

// ─── Smart emoji detection ──────────────────────────────────────────────────

const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

const KEYWORD_EMOJI: [RegExp, string][] = [
  [/ويلكم|welcome|ترحيب|ضيوف/i,           "🛬"],
  [/تريد|ترادينج|تبادل|trade/i,             "🔁"],
  [/شات|دردشة|chat|كلام/i,                  "💬"],
  [/متجر|تقييم|shop|store/i,                "🛒"],
  [/دفع|طرق.?دفع|payment|pay/i,            "🏦"],
  [/مخزون|منتج|تجديد|stock|product/i,      "📦"],
  [/إعلان|اعلان|news|announce/i,            "📢"],
  [/قواعد|rules|توجيهات/i,                  "📋"],
  [/صوت|voice|فويس/i,                       "🔊"],
  [/موسيقى|music|ميوزيك/i,                  "🎵"],
  [/صور|images|pics|media/i,                "🖼️"],
  [/مساعد|دعم|support|help/i,               "🆘"],
  [/بوت|bot|commands|أوامر/i,               "🤖"],
  [/إدارة|ادمن|admin|staff/i,               "⚙️"],
  [/هداي|مسابق|give|giveaway/i,             "🎁"],
  [/تكت|ticket/i,                           "🎫"],
  [/سجل|log/i,                              "📝"],
  [/عام|general/i,                          "💬"],
  [/ربح|profit|ماني|money/i,                "💰"],
  [/فن|art|إبداع/i,                         "🎨"],
  [/رياض|sport/i,                           "⚽"],
  [/ديني|إسلامي|قرآن/i,                    "🕌"],
  [/تقني|تكنول|tech/i,                      "💻"],
  [/خبر|break/i,                            "⚡"],
  [/ضيوف|visitor/i,                         "👥"],
  [/حدث|event/i,                            "📅"],
  [/توظيف|job|hire/i,                       "💼"],
  [/اقتراح|suggest/i,                       "💡"],
  [/قسم|section|categor/i,                  "📂"],
  [/سكوار|square/i,                         "🟦"],
];

function extractEmoji(name: string): string | null {
  const matches = name.match(EMOJI_REGEX);
  return matches?.[0] ?? null;
}

function guessEmoji(name: string): string {
  const found = extractEmoji(name);
  if (found) return found;
  for (const [pattern, emoji] of KEYWORD_EMOJI) {
    if (pattern.test(name)) return emoji;
  }
  return "✦";
}

// ─── Name cleaning ──────────────────────────────────────────────────────────

const DECORATION_PREFIXES = [
  /^ا\.\s*#ೃ⁀➷\p{Emoji_Presentation}*/u,
  /^#－「[^」]*」〡/u,
  /^・/,
  /^#・/,
  /^【[^】]*】\s*/,
  /^〔/,
  /^「/,
  /^✦+/,
  /^◈+/,
  /^[🔥🌙🌊🌸⚔️⭐🏹💎👑🔷]+/u,
  /^#[-－_\s]+/,
  /^[\-・]+/,
];

const DECORATION_SUFFIXES = [
  /-͟͟͞͞➳\s*$/,
  /・〢・[^\s]*$/,
  /〕$/,
  /」$/,
  /✦+$/,
  /◈+$/,
  /[🔥🌙🌊🌸⚔️⭐🏹💎👑🔷]+$/u,
  /[\-・]+$/,
];

function cleanChannelName(name: string): string {
  let clean = name;
  // Strip prefix decorations
  for (const rx of DECORATION_PREFIXES) {
    clean = clean.replace(rx, "");
  }
  // Strip suffix decorations
  for (const rx of DECORATION_SUFFIXES) {
    clean = clean.replace(rx, "");
  }
  // Strip remaining standalone decoration chars
  clean = clean
    .replace(/[〔〕「」【】・〢〡◈✦]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean || name.trim();
}

// Split cleaned name into word parts for dot-separated patterns
function splitToParts(clean: string): string[] {
  return clean
    .split(/[\s・\-]+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

// ─── Style definitions ──────────────────────────────────────────────────────

export const DECORATION_STYLES: Record<
  string,
  {
    name: string;
    emoji: string;
    build: (parts: string[], icon: string) => string;
    preview: string;
  }
> = {
  dots_arrow: {
    name: "نقاط وسهم",
    emoji: "🔁",
    build: (parts, icon) => `・${parts.join("・")}・〢・${icon}-͟͟͞͞➳`,
    preview: "・اسم・القناة・〢・emoji-͟͟͞͞➳",
  },
  nature_arrow: {
    name: "سهم طبيعي",
    emoji: "📦",
    build: (parts, icon) => `ا. #ೃ⁀➷${icon}・${parts.join("・")}`,
    preview: "ا. #ೃ⁀➷emoji・اسم・القناة",
  },
  jp_bracket: {
    name: "براكيت ياباني",
    emoji: "🏦",
    build: (parts, icon) => `#－「${icon}」〡${parts.join("・")}`,
    preview: "#－「emoji」〡اسم・القناة",
  },
  jp_bracket_plain: {
    name: "براكيت بسيط",
    emoji: "🛒",
    build: (parts, icon) => `#－「${icon}」〡${parts.join("-")}`,
    preview: "#－「emoji」〡اسم-القناة",
  },
  dot_classic: {
    name: "نقاط كلاسيك",
    emoji: "💬",
    build: (parts, icon) => `・${parts.join("・")}・${icon}`,
    preview: "・اسم・القناة・emoji",
  },
  classic: {
    name: "كلاسيك",
    emoji: "🔷",
    build: (parts, _icon) => `〔${parts.join("・")}〕`,
    preview: "〔اسم・القناة〕",
  },
  royal: {
    name: "ملكي",
    emoji: "👑",
    build: (parts, _icon) => `「${parts.join("・")}」`,
    preview: "「اسم・القناة」",
  },
  stars: {
    name: "نجوم",
    emoji: "⭐",
    build: (parts, icon) => `✦${icon}・${parts.join("・")}・✦`,
    preview: "✦emoji・اسم・القناة✦",
  },
  diamond: {
    name: "ماس",
    emoji: "💎",
    build: (parts, icon) => `◈${icon}・${parts.join("・")}・◈`,
    preview: "◈emoji・اسم・القناة◈",
  },
  fire: {
    name: "نار",
    emoji: "🔥",
    build: (parts, icon) => `🔥${icon}${parts.join("・")}🔥`,
    preview: "🔥emoji・اسم・القناة🔥",
  },
};

// ─── Pending store ───────────────────────────────────────────────────────────

interface PendingDecoration {
  style: string;
  channelIds: string[];
  requesterId: string;
  guildId: string;
  expiresAt: number;
}

export const pendingDecorations = new Map<string, PendingDecoration>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

type DecoratableChannel = TextChannel | VoiceChannel | CategoryChannel;

function getDecoratableChannels(guild: import("discord.js").Guild): DecoratableChannel[] {
  return [...guild.channels.cache.values()].filter(
    (c): c is DecoratableChannel =>
      c.type === ChannelType.GuildText ||
      c.type === ChannelType.GuildVoice ||
      c.type === ChannelType.GuildCategory,
  );
}

function buildNewName(rawName: string, styleKey: string): string {
  const style = DECORATION_STYLES[styleKey];
  if (!style) return rawName;

  const clean = cleanChannelName(rawName);
  const icon = guessEmoji(rawName); // use original name for emoji detection
  const parts = splitToParts(clean);

  if (parts.length === 0) return rawName;

  const result = style.build(parts, icon);
  return result.slice(0, 100);
}

// ─── Command ─────────────────────────────────────────────────────────────────

const decorate: Command = {
  data: new SlashCommandBuilder()
    .setName("decorate")
    .setDescription("✨ تزخرف أسماء القنوات بأسلوب ذكي")
    .addStringOption(o =>
      o.setName("style")
        .setDescription("اختر أسلوب الزخرفة")
        .setRequired(true)
        .addChoices(
          { name: "🔁 نقاط وسهم  ・اسم・〢・emoji-͟͟͞͞➳",          value: "dots_arrow"       },
          { name: "📦 سهم طبيعي  ا. #ೃ⁀➷emoji・اسم",              value: "nature_arrow"     },
          { name: "🏦 براكيت  #－「emoji」〡اسم",                    value: "jp_bracket"       },
          { name: "🛒 براكيت بسيط  #－「emoji」〡اسم-قناة",          value: "jp_bracket_plain" },
          { name: "💬 نقاط كلاسيك  ・اسم・emoji",                   value: "dot_classic"      },
          { name: "🔷 كلاسيك  〔اسم〕",                              value: "classic"          },
          { name: "👑 ملكي  「اسم」",                                 value: "royal"            },
          { name: "⭐ نجوم  ✦emoji・اسم✦",                           value: "stars"            },
          { name: "💎 ماس  ◈emoji・اسم◈",                            value: "diamond"          },
          { name: "🔥 نار  🔥emoji・اسم🔥",                          value: "fire"             },
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

    const pendingKey = interaction.id;
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
      .slice(0, 12)
      .map(ch => {
        const newName = buildNewName(ch!.name, styleKey);
        return `• \`${ch!.name}\`\n  → \`${newName}\``;
      })
      .join("\n");

    const moreCount = channels.length - 12;

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${style.emoji} تأكيد تزخرف القنوات`)
      .setDescription(
        `**الأسلوب:** ${style.name}\n` +
        `**المثال:** \`${style.preview}\`\n\n` +
        `**معاينة (${channels.length} قناة):**\n${preview}` +
        (moreCount > 0 ? `\n*... و${moreCount} قناة إضافية*` : ""),
      )
      .addFields({
        name: "💡 الذكاء التلقائي",
        value: "البوت يستخرج الإيموجي من اسم القناة تلقائياً، أو يختار المناسب حسب الكلمات",
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

// ─── Button handler ───────────────────────────────────────────────────────────

export async function handleDecorationButton(interaction: ButtonInteraction): Promise<void> {
  const { customId, guild, user } = interaction;
  if (!guild) return;

  const isConfirm = customId.startsWith("decorate_confirm_");
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

  if (!isConfirm) {
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
        .setDescription(`يتم الآن تزخرف **${pending.channelIds.length}** قناة بأسلوب ذكي...\nقد يستغرق ذلك بضع ثوانٍ.`)
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
      const newName = buildNewName(ch.name, pending.style);
      await ch.setName(newName, `زخرفة بواسطة ${user.tag}`);
      success++;
      await new Promise(r => setTimeout(r, 1100));
    } catch {
      failed++;
    }
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(success > 0 ? 0x57f287 : 0xed4245)
    .setTitle(`${style.emoji} اكتملت الزخرفة!`)
    .setDescription(
      `**الأسلوب:** ${style.name}\n\n` +
      `✅ **نجح:** ${success} قناة\n` +
      (failed > 0 ? `❌ **فشل:** ${failed} قناة (قنوات محمية أو لا صلاحيات)\n` : ""),
    )
    .setFooter({ text: `نُفّذ بواسطة ${user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [resultEmbed], components: [] });
}

export const decorationCommands: Command[] = [decorate];
