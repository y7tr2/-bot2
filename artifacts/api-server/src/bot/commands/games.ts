import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "./types";

const JOKES = [
  "واحد راح يشتري سيارة، قاله البايع: هذي كانت ملك وزير. قاله: ليش تبيعها؟ قاله: الوزير ما يدري! 😂",
  "طالب في الاختبار كتب: 'لا أعلم' على كل سؤال. المدرس قال: على الأقل أنت صادق! 😅",
  "ولد قال لأبوه: أبي أبي عندي أخبار وحلوة. قال: قول. قال: رسبت! قال: هذي الوحلوة ولا الحلوة؟! 😂",
  "موظف قال لمديره: أنا مريض وتعبان. المدير: أنا شايفك من الكاميرا تلعب! قال: هذا من التعب! 😂",
  "سألت الكمبيوتر إذا كان يحبني. قال: خطأ 404 المشاعر غير موجودة! 💻",
  "واحد سأل الطبيب: كم عمري؟ قال: 40. قال: ما صدقت! قال: أنا أيضاً! 😂",
  "صاحبي قالي: وش تاكل للإفطار؟ قلت: ما في شي. قال: أنا أيضاً بس أنا نايم! 😂",
  "طفل سأل أبوه: ليش الشمس تطلع من الشرق؟ قال: لأن الغرب ما يطيقها! 😂",
  "موظف طلب إجازة قال: عندي ألم في ظهري. المدير: أنا أعرف، من ثقل المسؤوليات اللي ما تسويها! 😂",
  "واحد طلب من جوجل: كيف أنسى حبيبتي؟ جوجل: هل تقصد حذف السجل؟ 😂",
];

const QUOTES = [
  "لا تيأس فإن اليأس كفر — ابن القيم",
  "السعادة لا تُشترى، إنها تُصنع بالرضا والقناعة",
  "كل يوم جديد فرصة لتكون أفضل مما كنت عليه أمس",
  "النجاح ليس نهاية الطريق، والفشل ليس نهاية الأمل — ونستون تشرشل",
  "اعمل كأنك ستعيش أبداً، وتوب كأنك ستموت غداً",
  "من لم يذق مر التعلم ساعة، تجرع ذل الجهل طول حياته — ابن رشد",
  "الوقت كالسيف إن لم تقطعه قطعك",
  "إذا كان الكلام من فضة، فالسكوت من ذهب",
  "اقرأ كثيراً، فالقراءة نور في ظلمة الجهل",
  "أفضل ما تستثمره هو تطوير نفسك",
];

const WYR_QUESTIONS = [
  { a: "تطير في السماء بدون طيارة", b: "تتنفس تحت الماء بدون معدات" },
  { a: "تعيش بدون إنترنت", b: "تعيش بدون هاتف" },
  { a: "تكون الأذكى في السيرفر", b: "تكون الأقوى في السيرفر" },
  { a: "تأكل نفس الأكل كل يوم", b: "تنام ساعة واحدة فقط كل ليلة" },
  { a: "تعرف تاريخ وفاتك", b: "تعرف سبب وفاتك" },
  { a: "تكون مشهوراً ومكروهاً", b: "تكون مجهولاً ومحبوباً" },
  { a: "تتكلم كل اللغات", b: "تعزف كل الآلات الموسيقية" },
  { a: "ترجع للماضي بدون تغيير", b: "ترى المستقبل بدون تغيير" },
];

const SCRAMBLE_WORDS = [
  { word: "ديسكورد", hint: "تطبيق تواصل" },
  { word: "الكمبيوتر", hint: "جهاز إلكتروني" },
  { word: "السيرفر", hint: "مكان التجمع" },
  { word: "المبرمج", hint: "يكتب الكود" },
  { word: "الذكاء", hint: "صفة عقلية" },
  { word: "الاصطناعي", hint: "غير طبيعي" },
  { word: "البوتات", hint: "برامج تلقائية" },
  { word: "الانترنت", hint: "شبكة عالمية" },
];

// ─── rps ─────────────────────────────────────────────────
const rps: Command = {
  data: new SlashCommandBuilder()
    .setName("rps")
    .setDescription("✂️ حجرة ورقة مقص — العب ضد البوت")
    .addStringOption(o => o.setName("اختيار").setDescription("اختيارك").setRequired(true)
      .addChoices(
        { name: "🪨 حجر", value: "rock" },
        { name: "📄 ورق", value: "paper" },
        { name: "✂️ مقص", value: "scissors" },
      )),
  async execute(interaction) {
    const player = interaction.options.getString("اختيار", true) as "rock" | "paper" | "scissors";
    const choices = ["rock", "paper", "scissors"] as const;
    const bot = choices[Math.floor(Math.random() * 3)];
    const emojis = { rock: "🪨 حجر", paper: "📄 ورق", scissors: "✂️ مقص" };
    let result: string;
    if (player === bot) result = "🤝 تعادل!";
    else if (
      (player === "rock" && bot === "scissors") ||
      (player === "paper" && bot === "rock") ||
      (player === "scissors" && bot === "paper")
    ) result = "🏆 فزت!";
    else result = "😈 فاز البوت!";
    const embed = new EmbedBuilder()
      .setColor(result.includes("فزت") ? 0x57f287 : result.includes("تعادل") ? 0xfee75c : 0xed4245)
      .setTitle("✂️ حجرة ورقة مقص")
      .addFields(
        { name: "أنت", value: emojis[player], inline: true },
        { name: "البوت", value: emojis[bot], inline: true },
        { name: "النتيجة", value: result, inline: false },
      ).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── joke ────────────────────────────────────────────────
const joke: Command = {
  data: new SlashCommandBuilder()
    .setName("joke")
    .setDescription("😂 نكتة عشوائية"),
  async execute(interaction) {
    const j = JOKES[Math.floor(Math.random() * JOKES.length)];
    const embed = new EmbedBuilder().setColor(0xfee75c).setTitle("😂 نكتة").setDescription(j).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── quote ───────────────────────────────────────────────
const quote: Command = {
  data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription("💬 اقتباس ملهم عشوائي"),
  async execute(interaction) {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("💬 اقتباس").setDescription(`*"${q}"*`).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── fact ────────────────────────────────────────────────
const fact: Command = {
  data: new SlashCommandBuilder()
    .setName("fact")
    .setDescription("🔬 معلومة علمية عشوائية"),
  async execute(interaction) {
    await interaction.deferReply();
    const facts = [
      "🌍 الأرض تدور حول محورها بسرعة 1670 كم/ساعة عند خط الاستواء.",
      "🧠 الدماغ البشري يحتوي على حوالي 86 مليار خلية عصبية.",
      "🌊 المحيطات تغطي 71% من سطح الأرض.",
      "⚡ الصاعقة تصل درجة حرارتها إلى 30,000 كلفن — أكثر من سطح الشمس!",
      "🦋 الفراشة تذوق الطعام بقدميها.",
      "🐙 للأخطبوط ثلاثة قلوب وثمانية أذرع ودماغ موزّع في كل ذراع.",
      "🌙 مسافة القمر من الأرض: 384,400 كم.",
      "🐝 النحل يخبر رفاقه بمكان الرحيق عبر رقصة خاصة تسمى رقصة الاهتزاز.",
      "💎 الماس يتكون من الكربون تحت ضغط وحرارة هائلة لملايين السنين.",
      "🦈 القرش الأبيض الكبير يمكن أن يحدد قطرة دم في المياه من مسافة 5 كم.",
    ];
    const f = facts[Math.floor(Math.random() * facts.length)];
    const embed = new EmbedBuilder().setColor(0x57f287).setTitle("🔬 معلومة علمية").setDescription(f).setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};

// ─── math ────────────────────────────────────────────────
const math: Command = {
  data: new SlashCommandBuilder()
    .setName("math")
    .setDescription("🔢 مسألة حسابية — هل تستطيع الإجابة؟"),
  async execute(interaction) {
    const a = Math.floor(Math.random() * 50) + 1;
    const b = Math.floor(Math.random() * 50) + 1;
    const ops = [
      { symbol: "+", result: a + b },
      { symbol: "-", result: a - b },
      { symbol: "×", result: a * b },
    ];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("🔢 مسألة حسابية")
      .setDescription(`**${a} ${op.symbol} ${b} = ?**\n\nعندك 15 ثانية للإجابة!`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    const filter = (m: import("discord.js").Message) =>
      m.author.id === interaction.user.id && m.channelId === interaction.channelId;
    try {
      const collected = await (interaction.channel as any).awaitMessages({ filter, max: 1, time: 15000, errors: ["time"] });
      const answer = parseInt(collected.first()?.content ?? "");
      if (answer === op.result) {
        await interaction.followUp(`✅ صحيح! **${a} ${op.symbol} ${b} = ${op.result}** 🎉`);
      } else {
        await interaction.followUp(`❌ خطأ! الإجابة الصحيحة: **${op.result}**`);
      }
    } catch {
      await interaction.followUp(`⏰ انتهى الوقت! الإجابة: **${op.result}**`);
    }
  },
};

// ─── scramble ────────────────────────────────────────────
const scramble: Command = {
  data: new SlashCommandBuilder()
    .setName("scramble")
    .setDescription("🔤 اخمن الكلمة المبعثرة!"),
  async execute(interaction) {
    const entry = SCRAMBLE_WORDS[Math.floor(Math.random() * SCRAMBLE_WORDS.length)];
    const scrambled = entry.word.split("").sort(() => Math.random() - 0.5).join("");
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔤 الكلمة المبعثرة")
      .setDescription(`**${scrambled}**\n\nتلميح: ${entry.hint}\n\nعندك 20 ثانية!`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    const filter = (m: import("discord.js").Message) =>
      m.author.id === interaction.user.id && m.channelId === interaction.channelId;
    try {
      const collected = await (interaction.channel as any).awaitMessages({ filter, max: 1, time: 20000, errors: ["time"] });
      const answer = collected.first()?.content?.trim() ?? "";
      if (answer === entry.word) {
        await interaction.followUp(`✅ صحيح! الكلمة هي **${entry.word}** 🎉`);
      } else {
        await interaction.followUp(`❌ خطأ! الكلمة الصحيحة: **${entry.word}**`);
      }
    } catch {
      await interaction.followUp(`⏰ انتهى الوقت! الكلمة كانت: **${entry.word}**`);
    }
  },
};

// ─── wyr ─────────────────────────────────────────────────
const wyr: Command = {
  data: new SlashCommandBuilder()
    .setName("wyr")
    .setDescription("🤔 هل تفضّل؟ — Would You Rather"),
  async execute(interaction) {
    const q = WYR_QUESTIONS[Math.floor(Math.random() * WYR_QUESTIONS.length)];
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle("🤔 هل تفضّل؟")
      .addFields(
        { name: "🅰️ الخيار الأول", value: q.a, inline: false },
        { name: "🅱️ الخيار الثاني", value: q.b, inline: false },
      )
      .setFooter({ text: "رد بـ A أو B!" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── reverse ─────────────────────────────────────────────
const reverse: Command = {
  data: new SlashCommandBuilder()
    .setName("reverse")
    .setDescription("🔄 عكس نص أو جملة")
    .addStringOption(o => o.setName("نص").setDescription("النص المراد عكسه").setRequired(true)),
  async execute(interaction) {
    const text = interaction.options.getString("نص", true);
    const reversed = text.split("").reverse().join("");
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔄 عكس النص")
      .addFields(
        { name: "الأصلي", value: text, inline: false },
        { name: "المعكوس", value: reversed, inline: false },
      ).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── calculator ──────────────────────────────────────────
const calculator: Command = {
  data: new SlashCommandBuilder()
    .setName("calc")
    .setDescription("🧮 حاسبة بسيطة")
    .addNumberOption(o => o.setName("الأول").setDescription("الرقم الأول").setRequired(true))
    .addStringOption(o => o.setName("عملية").setDescription("العملية الحسابية").setRequired(true)
      .addChoices(
        { name: "➕ جمع", value: "+" },
        { name: "➖ طرح", value: "-" },
        { name: "✖️ ضرب", value: "*" },
        { name: "➗ قسمة", value: "/" },
        { name: "💪 قوة", value: "^" },
        { name: "% باقي قسمة", value: "%" },
      ))
    .addNumberOption(o => o.setName("الثاني").setDescription("الرقم الثاني").setRequired(true)),
  async execute(interaction) {
    const a = interaction.options.getNumber("الأول", true);
    const op = interaction.options.getString("عملية", true);
    const b = interaction.options.getNumber("الثاني", true);
    let result: number;
    if (op === "+" ) result = a + b;
    else if (op === "-") result = a - b;
    else if (op === "*") result = a * b;
    else if (op === "/") { if (b === 0) { await interaction.reply({ content: "❌ لا يمكن القسمة على صفر!", ephemeral: true }); return; } result = a / b; }
    else if (op === "^") result = Math.pow(a, b);
    else result = a % b;
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("🧮 الحاسبة")
      .setDescription(`**${a} ${op} ${b} = ${result}**`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export const gamesCommands: Command[] = [
  rps, joke, quote, fact, math, scramble, wyr, reverse, calculator,
];
