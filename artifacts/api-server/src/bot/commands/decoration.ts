import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ButtonInteraction,
  type AutocompleteInteraction,
  type TextChannel,
  type VoiceChannel,
  type CategoryChannel,
  type Guild,
} from "discord.js";
import type { Command } from "./types";

// ─── Smart emoji detection ──────────────────────────────────────────────────

const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

const KEYWORD_EMOJI: [RegExp, string][] = [
  [/ويلكم|welcome|ترحيب|ضيوف/i,            "🛬"],
  [/تريد|ترادينج|تبادل|trade/i,              "🔁"],
  [/شات|دردشة|chat|كلام/i,                   "💬"],
  [/متجر|تقييم|shop|store/i,                 "🛒"],
  [/دفع|طرق.?دفع|payment|pay/i,             "🏦"],
  [/مخزون|منتج|تجديد|stock|product/i,       "📦"],
  [/إعلان|اعلان|news|announce/i,             "📢"],
  [/قواعد|rules|توجيهات/i,                   "📋"],
  [/صوت|voice|فويس/i,                        "🔊"],
  [/موسيقى|music|ميوزيك/i,                   "🎵"],
  [/صور|images|pics|media/i,                 "🖼️"],
  [/مساعد|دعم|support|help/i,                "🆘"],
  [/بوت|bot|commands|أوامر/i,                "🤖"],
  [/إدارة|ادمن|admin|staff/i,                "⚙️"],
  [/هداي|مسابق|give|giveaway/i,              "🎁"],
  [/تكت|ticket/i,                            "🎫"],
  [/سجل|log/i,                               "📝"],
  [/عام|general/i,                           "💬"],
  [/ربح|profit|ماني|money/i,                 "💰"],
  [/فن|art|إبداع/i,                          "🎨"],
  [/رياض|sport/i,                            "⚽"],
  [/ديني|إسلامي|قرآن/i,                     "🕌"],
  [/تقني|تكنول|tech/i,                       "💻"],
  [/خبر|break/i,                             "⚡"],
  [/ضيوف|visitor/i,                          "👥"],
  [/حدث|event/i,                             "📅"],
  [/توظيف|job|hire/i,                        "💼"],
  [/اقتراح|suggest/i,                        "💡"],
  [/قسم|section|categor/i,                   "📂"],
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
  /^ا\.\s*#ೃ⁀➷[\s\S]{0,5}/u,
  /^#－「[^」]*」〡/u,
  /^・/,
  /^#・/,
  /^【[^】]*】\s*/,
  /^〔/,
  /^「/,
  /^『/,
  /^《/,
  /^✦+/,
  /^◈+/,
  /^✿\s*/,
  /^✧\s*/,
  /^❁\s*/,
  /^♛\s*/,
  /^∞\s*/,
  /^⊹\s*/,
  /^★彡\s*/,
  /^≋\s*/,
  /^─+\s*/,
  /^│\s*/,
  /^‹\s*/,
  /^«\s*/,
  /^➣\s*/,
  /^⚡/u,
  /^⚔\s*/,
  /^[🔥🌙🌊🌸⭐🏹💎👑🔷]+/u,
  /^#[-－_\s]+/,
  /^[\-・]+/,
];

const DECORATION_SUFFIXES = [
  /-͟͟͞͞➳\s*$/,
  /・〢・[^\s]*$/,
  /〕$/,
  /」$/,
  /』$/,
  /》$/,
  /✦+$/,
  /◈+$/,
  /\s*✿$/,
  /\s*✧$/,
  /\s*❁$/,
  /\s*♛$/,
  /\s*∞$/,
  /\s*⊹$/,
  /\s*彡★$/,
  /\s*≋$/,
  /\s*─+$/,
  /\s*│$/,
  /\s*›$/,
  /\s*»$/,
  /\s*⟩[^\s]*$/,
  /\s*⚡$/u,
  /\s*⚔$/,
  /[🔥🌙🌊🌸⭐🏹💎👑🔷]+$/u,
  /[\-・]+$/,
];

function cleanChannelName(name: string): string {
  let clean = name;
  for (const rx of DECORATION_PREFIXES) clean = clean.replace(rx, "");
  for (const rx of DECORATION_SUFFIXES) clean = clean.replace(rx, "");
  clean = clean
    .replace(/[〔〕「」『』【】《》・〢〡◈✦✿✧❁♛∞⊹≋]+/g, " ")
    .replace(EMOJI_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || name.trim();
}

function splitToParts(clean: string): string[] {
  return clean
    .split(/[\s・\-]+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

// ─── Style definitions (30 styles) ──────────────────────────────────────────

export const DECORATION_STYLES: Record<
  string,
  { name: string; category: string; emoji: string; build: (parts: string[], icon: string) => string; preview: string }
> = {
  // ── نقاط وسهام ──────────────────────────────────────────────────────────
  dots_arrow:        { category: "نقاط وسهام",    name: "نقاط وسهم",         emoji: "🔁", build: (p, i) => `・${p.join("・")}・〢・${i}-͟͟͞͞➳`,            preview: "・اسم・قناة・〢・emoji-͟͟͞͞➳"       },
  nature_arrow:      { category: "نقاط وسهام",    name: "سهم طبيعي",          emoji: "📦", build: (p, i) => `ا. #ೃ⁀➷${i}・${p.join("・")}`,              preview: "ا. #ೃ⁀➷emoji・اسم・قناة"         },
  dot_classic:       { category: "نقاط وسهام",    name: "نقاط كلاسيك",        emoji: "💬", build: (p, i) => `・${p.join("・")}・${i}`,                     preview: "・اسم・قناة・emoji"               },
  dot_prefix:        { category: "نقاط وسهام",    name: "نقطة أمام",           emoji: "🌸", build: (p, i) => `${i}・${p.join("・")}`,                      preview: "emoji・اسم・قناة"                },
  dash_arrow:        { category: "نقاط وسهام",    name: "سهم سداسي",          emoji: "⚡", build: (p, i) => `➣ ${i}・${p.join("・")}`,                    preview: "➣ emoji・اسم・قناة"              },
  arrow_right:       { category: "نقاط وسهام",    name: "سهم يمين",           emoji: "🎯", build: (p, i) => `${p.join("・")} ⟩ ${i}`,                    preview: "اسم・قناة ⟩ emoji"               },
  double_dot:        { category: "نقاط وسهام",    name: "نقطتان",             emoji: "✨", build: (p, i) => `・${i}・${p.join("・")}・`,                   preview: "・emoji・اسم・قناة・"             },
  dot_line:          { category: "نقاط وسهام",    name: "نقطة وخط",           emoji: "💫", build: (p, i) => `${i}・${p.join("・")}〡`,                     preview: "emoji・اسم・قناة〡"              },

  // ── براكيت ياباني ────────────────────────────────────────────────────────
  jp_bracket:        { category: "براكيت",        name: "براكيت",             emoji: "🏦", build: (p, i) => `#－「${i}」〡${p.join("・")}`,                 preview: "#－「emoji」〡اسم・قناة"         },
  jp_bracket_plain:  { category: "براكيت",        name: "براكيت شرطة",        emoji: "🛒", build: (p, i) => `#－「${i}」〡${p.join("-")}`,                  preview: "#－「emoji」〡اسم-قناة"          },
  double_bracket:    { category: "براكيت",        name: "دبل براكيت",         emoji: "🎫", build: (p, i) => `『${i}・${p.join("・")}』`,                   preview: "『emoji・اسم・قناة』"            },
  angle_bracket:     { category: "براكيت",        name: "زاوية مزدوجة",       emoji: "📂", build: (p, i) => `《${i}・${p.join("・")}》`,                    preview: "《emoji・اسم・قناة》"            },
  corner_bracket:    { category: "براكيت",        name: "كورنر",              emoji: "📋", build: (p, i) => `「${i}」 ${p.join("・")}`,                    preview: "「emoji」 اسم・قناة"             },
  hash_bracket:      { category: "براكيت",        name: "هاشتاق براكيت",      emoji: "🔖", build: (p, i) => `#「${i}・${p.join("・")}」`,                  preview: "#「emoji・اسم・قناة」"           },

  // ── كلاسيك ───────────────────────────────────────────────────────────────
  classic:           { category: "كلاسيك",        name: "كلاسيك",             emoji: "🔷", build: (p, _) => `〔${p.join("・")}〕`,                          preview: "〔اسم・قناة〕"                   },
  royal:             { category: "كلاسيك",        name: "ملكي",               emoji: "👑", build: (p, _) => `「${p.join("・")}」`,                           preview: "「اسم・قناة」"                   },
  guillemets:        { category: "كلاسيك",        name: "غيّومه",             emoji: "✨", build: (p, i) => `‹ ${i}・${p.join("・")} ›`,                    preview: "‹ emoji・اسم・قناة ›"            },
  double_guillemets: { category: "كلاسيك",        name: "غيّومه مزدوجة",      emoji: "💫", build: (p, i) => `« ${i}・${p.join("・")} »`,                    preview: "« emoji・اسم・قناة »"            },
  hash_classic:      { category: "كلاسيك",        name: "هاش كلاسيك",         emoji: "🔹", build: (p, i) => `# ${i}・${p.join("・")}`,                     preview: "# emoji・اسم・قناة"              },

  // ── نجوم وأشكال ──────────────────────────────────────────────────────────
  stars:             { category: "نجوم وأشكال",   name: "نجوم",               emoji: "⭐", build: (p, i) => `✦${i}・${p.join("・")}✦`,                    preview: "✦emoji・اسم・قناة✦"             },
  diamond:           { category: "نجوم وأشكال",   name: "ماس",                emoji: "💎", build: (p, i) => `◈${i}・${p.join("・")}◈`,                    preview: "◈emoji・اسم・قناة◈"             },
  lotus:             { category: "نجوم وأشكال",   name: "لوتس",               emoji: "🌸", build: (p, i) => `✿ ${i}・${p.join("・")} ✿`,                   preview: "✿ emoji・اسم・قناة ✿"           },
  sparkle:           { category: "نجوم وأشكال",   name: "بريق",               emoji: "✨", build: (p, i) => `✧ ${i}・${p.join("・")} ✧`,                   preview: "✧ emoji・اسم・قناة ✧"           },
  crown:             { category: "نجوم وأشكال",   name: "تاج",                emoji: "♛", build: (p, i) => `♛ ${i}・${p.join("・")} ♛`,                   preview: "♛ emoji・اسم・قناة ♛"           },
  floral:            { category: "نجوم وأشكال",   name: "زهري",               emoji: "❁", build: (p, i) => `❁ ${i}・${p.join("・")} ❁`,                   preview: "❁ emoji・اسم・قناة ❁"           },
  infinity:          { category: "نجوم وأشكال",   name: "لانهائي",            emoji: "🔄", build: (p, i) => `∞ ${i}・${p.join("・")} ∞`,                    preview: "∞ emoji・اسم・قناة ∞"           },
  chain:             { category: "نجوم وأشكال",   name: "سلسلة",              emoji: "🔗", build: (p, i) => `⊹ ${i}・${p.join("・")} ⊹`,                   preview: "⊹ emoji・اسم・قناة ⊹"           },

  // ── طاقة وخطوط ───────────────────────────────────────────────────────────
  fire:              { category: "طاقة وخطوط",    name: "نار",                emoji: "🔥", build: (p, i) => `🔥${i}${p.join("・")}🔥`,                     preview: "🔥emoji・اسم・قناة🔥"           },
  lightning:         { category: "طاقة وخطوط",    name: "برق",                emoji: "⚡", build: (p, i) => `⚡${i}・${p.join("・")}⚡`,                   preview: "⚡emoji・اسم・قناة⚡"           },
  sword:             { category: "طاقة وخطوط",    name: "سيف",                emoji: "⚔️", build: (p, i) => `⚔ ${i}・${p.join("・")} ⚔`,                  preview: "⚔ emoji・اسم・قناة ⚔"          },
  dash_line:         { category: "طاقة وخطوط",    name: "خط مزدوج",           emoji: "〰", build: (p, i) => `─── ${i}・${p.join("・")} ───`,               preview: "─── emoji・اسم・قناة ───"       },
  pipe:              { category: "طاقة وخطوط",    name: "خط عمودي",           emoji: "│", build: (p, i) => `│ ${i}・${p.join("・")} │`,                    preview: "│ emoji・اسم・قناة │"           },
  star_jp:           { category: "طاقة وخطوط",    name: "ستار ياباني",        emoji: "★", build: (p, i) => `★彡 ${i}・${p.join("・")} 彡★`,               preview: "★彡 emoji・اسم・قناة 彡★"       },
  wave:              { category: "طاقة وخطوط",    name: "موجة",               emoji: "🌊", build: (p, i) => `≋ ${i}・${p.join("・")} ≋`,                    preview: "≋ emoji・اسم・قناة ≋"           },
};

export const STYLE_LIST = Object.entries(DECORATION_STYLES).map(([id, s]) => ({
  id,
  name: s.name,
  category: s.category,
  emoji: s.emoji,
  preview: s.preview,
}));

// Autocomplete handler (called from interaction.ts)
export function handleStyleAutocomplete(interaction: AutocompleteInteraction): void {
  const focused = interaction.options.getFocused().toLowerCase();
  const results = STYLE_LIST.filter(
    s =>
      s.name.includes(focused) ||
      s.id.includes(focused) ||
      s.category.includes(focused) ||
      s.preview.includes(focused),
  )
    .slice(0, 25)
    .map(s => ({ name: `${s.emoji} ${s.name} — ${s.preview}`, value: s.id }));

  void interaction.respond(results);
}

// ─── Pending store ───────────────────────────────────────────────────────────

interface PendingEdit {
  kind: "edit";
  style: string;
  channelIds: string[];
  requesterId: string;
  guildId: string;
  expiresAt: number;
}
interface PendingCreate {
  kind: "create";
  style: string;
  rawName: string;
  channelType: "text" | "voice";
  categoryId?: string;
  requesterId: string;
  guildId: string;
  expiresAt: number;
}

type PendingDecoration = PendingEdit | PendingCreate;
export const pendingDecorations = new Map<string, PendingDecoration>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

type DecoratableChannel = TextChannel | VoiceChannel | CategoryChannel;

function getDecoratableChannels(guild: Guild): DecoratableChannel[] {
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
  const icon = guessEmoji(rawName);
  const parts = splitToParts(clean);
  if (parts.length === 0) return rawName;
  return style.build(parts, icon).slice(0, 100);
}

function confirmRow(key: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`decorate_confirm_${key}`)
      .setLabel("✅ تأكيد")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`decorate_cancel_${key}`)
      .setLabel("❌ إلغاء")
      .setStyle(ButtonStyle.Danger),
  );
}

// ─── Command ─────────────────────────────────────────────────────────────────

const decorate: Command = {
  data: new SlashCommandBuilder()
    .setName("decorate")
    .setDescription("✨ تزخرف وإدارة أسماء القنوات")
    .addSubcommand(s =>
      s.setName("edit")
        .setDescription("تغيير زخرفة القنوات الموجودة")
        .addStringOption(o =>
          o.setName("style")
            .setDescription("ابحث عن أسلوب الزخرفة (اكتب اسمه)")
            .setRequired(true)
            .setAutocomplete(true))
        .addChannelOption(o =>
          o.setName("channel")
            .setDescription("قناة محددة — اتركها فارغة لتزخرف الكل")
            .setRequired(false)),
    )
    .addSubcommand(s =>
      s.setName("create")
        .setDescription("إنشاء قناة جديدة باسمك وزخرفة ذكية")
        .addStringOption(o =>
          o.setName("name")
            .setDescription("اسم القناة (مثال: الشات العام)")
            .setRequired(true))
        .addStringOption(o =>
          o.setName("style")
            .setDescription("ابحث عن أسلوب الزخرفة (اكتب اسمه)")
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(o =>
          o.setName("type")
            .setDescription("نوع القناة")
            .setRequired(false)
            .addChoices(
              { name: "💬 نصي",  value: "text"  },
              { name: "🔊 صوتي", value: "voice" },
            ))
        .addChannelOption(o =>
          o.setName("category")
            .setDescription("الفئة (اختياري)")
            .setRequired(false)),
    )
    .addSubcommand(s =>
      s.setName("styles")
        .setDescription("عرض جميع أساليب الزخرفة المتاحة"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();

    // ── /decorate styles ───────────────────────────────────────────────────
    if (sub === "styles") {
      const categories = [...new Set(STYLE_LIST.map(s => s.category))];

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("✨ أساليب الزخرفة المتاحة")
        .setDescription(
          `إجمالي **${STYLE_LIST.length} أسلوب** — استخدم \`/decorate edit\` أو \`/decorate create\` واكتب اسم الأسلوب للبحث.`,
        );

      for (const cat of categories) {
        const styles = STYLE_LIST.filter(s => s.category === cat);
        embed.addFields({
          name: `── ${cat} ──`,
          value: styles
            .map(s => `**${s.emoji} ${s.name}**\n\`${s.preview}\``)
            .join("\n"),
          inline: false,
        });
      }

      embed.setFooter({ text: "الإيموجي يُختار تلقائياً من اسم القناة" });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── /decorate edit ─────────────────────────────────────────────────────
    if (sub === "edit") {
      const styleKey = interaction.options.getString("style", true);
      const style = DECORATION_STYLES[styleKey];

      if (!style) {
        await interaction.reply({
          content: `❌ أسلوب غير موجود: \`${styleKey}\`\nاستخدم \`/decorate styles\` لرؤية القائمة الكاملة.`,
          ephemeral: true,
        });
        return;
      }

      const targetChannel = interaction.options.getChannel("channel");
      let channelIds: string[] = [];

      if (targetChannel) {
        const ch = interaction.guild.channels.cache.get(targetChannel.id);
        if (!ch ||
          (ch.type !== ChannelType.GuildText &&
            ch.type !== ChannelType.GuildVoice &&
            ch.type !== ChannelType.GuildCategory)) {
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
        kind: "edit",
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
        .slice(0, 10)
        .map(ch => `• \`${ch!.name}\`\n  → \`${buildNewName(ch!.name, styleKey)}\``)
        .join("\n");
      const moreCount = channels.length - 10;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${style.emoji} تأكيد تزخرف القنوات`)
        .setDescription(
          `**الأسلوب:** ${style.name}\n**المثال:** \`${style.preview}\`\n\n` +
          `**معاينة (${channels.length} قناة):**\n${preview}` +
          (moreCount > 0 ? `\n*... و${moreCount} قناة إضافية*` : ""),
        )
        .addFields({
          name: "💡 الذكاء التلقائي",
          value: "البوت يستخرج الإيموجي من اسم القناة أو يختاره حسب الكلمات",
        })
        .setFooter({ text: `طُلب بواسطة ${interaction.user.tag} • ينتهي بعد 5 دقائق` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], components: [confirmRow(pendingKey)] });
      return;
    }

    // ── /decorate create ───────────────────────────────────────────────────
    if (sub === "create") {
      const rawName  = interaction.options.getString("name", true).trim();
      const styleKey = interaction.options.getString("style", true);
      const style    = DECORATION_STYLES[styleKey];

      if (!style) {
        await interaction.reply({
          content: `❌ أسلوب غير موجود: \`${styleKey}\`\nاستخدم \`/decorate styles\` لرؤية القائمة الكاملة.`,
          ephemeral: true,
        });
        return;
      }

      const typeOpt = (interaction.options.getString("type") ?? "text") as "text" | "voice";
      const catOpt  = interaction.options.getChannel("category");

      const decoratedName = buildNewName(rawName, styleKey);
      const catName = catOpt
        ? (interaction.guild.channels.cache.get(catOpt.id)?.name ?? String(catOpt.name))
        : "بدون فئة";

      const pendingKey = interaction.id;
      pendingDecorations.set(pendingKey, {
        kind: "create",
        style: styleKey,
        rawName,
        channelType: typeOpt,
        categoryId: catOpt?.id,
        requesterId: interaction.user.id,
        guildId: interaction.guild.id,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      setTimeout(() => pendingDecorations.delete(pendingKey), 5 * 60 * 1000);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${style.emoji} تأكيد إنشاء القناة`)
        .addFields(
          { name: "الاسم الذي أدخلته",  value: `\`${rawName}\``,                                             inline: true },
          { name: "الاسم بعد الزخرفة",  value: `\`${decoratedName}\``,                                       inline: true },
          { name: "\u200b",             value: "\u200b",                                                      inline: true },
          { name: "النوع",              value: typeOpt === "voice" ? "🔊 صوتي" : "💬 نصي",                   inline: true },
          { name: "الفئة",              value: catName,                                                       inline: true },
          { name: "الأسلوب",            value: style.name,                                                   inline: true },
        )
        .setFooter({ text: `طُلب بواسطة ${interaction.user.tag} • ينتهي بعد 5 دقائق` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], components: [confirmRow(pendingKey)] });
    }
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
    await interaction.reply({ content: "❌ فقط من طلب العملية يمكنه التأكيد.", ephemeral: true });
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
          .setTitle("❌ تم الإلغاء")
          .setDescription("تم إلغاء العملية.")
          .setTimestamp(),
      ],
      components: [],
    });
    return;
  }

  pendingDecorations.delete(pendingKey);
  const style = DECORATION_STYLES[pending.style];
  if (!style) {
    await interaction.reply({ content: "❌ أسلوب الزخرفة غير صالح.", ephemeral: true });
    return;
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  if (pending.kind === "edit") {
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
    let failed  = 0;

    for (const channelId of pending.channelIds) {
      const ch = guild.channels.cache.get(channelId) as DecoratableChannel | undefined;
      if (!ch) { failed++; continue; }
      try {
        await ch.setName(buildNewName(ch.name, pending.style), `زخرفة بواسطة ${user.tag}`);
        success++;
        await new Promise(r => setTimeout(r, 1100));
      } catch { failed++; }
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(success > 0 ? 0x57f287 : 0xed4245)
          .setTitle(`${style.emoji} اكتملت الزخرفة!`)
          .setDescription(
            `**الأسلوب:** ${style.name}\n\n` +
            `✅ **نجح:** ${success} قناة\n` +
            (failed > 0 ? `❌ **فشل:** ${failed} قناة\n` : ""),
          )
          .setFooter({ text: `نُفّذ بواسطة ${user.tag}` })
          .setTimestamp(),
      ],
      components: [],
    });
    return;
  }

  // ── Create ────────────────────────────────────────────────────────────────
  if (pending.kind === "create") {
    const decoratedName = buildNewName(pending.rawName, pending.style);
    const chType  = pending.channelType === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
    const category = pending.categoryId ? guild.channels.cache.get(pending.categoryId) : undefined;
    const parentId = category?.type === ChannelType.GuildCategory ? category.id : undefined;

    try {
      const created = await guild.channels.create({
        name: decoratedName,
        type: chType,
        ...(parentId ? { parent: parentId } : {}),
        reason: `أنشأها ${user.tag} عبر /decorate create`,
      });

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle(`${style.emoji} تم إنشاء القناة!`)
            .addFields(
              { name: "القناة",   value: `<#${created.id}>`,                                             inline: true },
              { name: "الاسم",    value: `\`${decoratedName}\``,                                         inline: true },
              { name: "الأسلوب", value: style.name,                                                     inline: true },
              { name: "النوع",    value: pending.channelType === "voice" ? "🔊 صوتي" : "💬 نصي",        inline: true },
              { name: "الفئة",    value: parentId ? `<#${parentId}>` : "بدون فئة",                      inline: true },
            )
            .setFooter({ text: `أنشأها ${user.tag}` })
            .setTimestamp(),
        ],
        components: [],
      });
    } catch {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("❌ فشل إنشاء القناة")
            .setDescription("تأكد أن البوت يملك صلاحية **إدارة القنوات**.")
            .setTimestamp(),
        ],
        components: [],
      });
    }
  }
}

export const decorationCommands: Command[] = [decorate];
