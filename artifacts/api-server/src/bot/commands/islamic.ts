import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "./types";

const ISLAMIC_QUOTES = [
  "إنما الأعمال بالنيات — صحيح البخاري",
  "المسلم من سلم المسلمون من لسانه ويده — صحيح البخاري",
  "لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه — متفق عليه",
  "الدنيا سجن المؤمن وجنة الكافر — صحيح مسلم",
  "من كان يؤمن بالله واليوم الآخر فليقل خيراً أو ليصمت — متفق عليه",
  "اتق الله حيثما كنت، وأتبع السيئة الحسنة تمحها، وخالق الناس بخلق حسن — الترمذي",
  "ازهد في الدنيا يحبك الله، وازهد فيما عند الناس يحبك الناس — ابن ماجه",
  "من صمت نجا — الترمذي",
  "خير الناس أنفعهم للناس — الطبراني",
  "الكلمة الطيبة صدقة — متفق عليه",
  "الصبر نصف الإيمان — البيهقي",
  "طلب العلم فريضة على كل مسلم — ابن ماجه",
];

const ISLAMIC_FACTS = [
  "القرآن الكريم يحتوي على 114 سورة و6236 آية.",
  "الإسلام هو ثاني أكبر الأديان في العالم بأكثر من 1.8 مليار مسلم.",
  "مكة المكرمة هي أقدس مدينة في الإسلام، وفيها المسجد الحرام.",
  "الصلوات الخمس فُرضت في ليلة الإسراء والمعراج.",
  "الهجرة النبوية من مكة إلى المدينة كانت في عام 622م، وهو بداية التقويم الهجري.",
  "أسماء الله الحسنى تسعة وتسعون اسماً.",
  "زمزم هو أقدم بئر مستمرة في العالم، وتقع في المسجد الحرام.",
  "القرآن الكريم نزل على مدى 23 عاماً.",
  "المسجد النبوي في المدينة المنورة أُسس في السنة الأولى من الهجرة.",
  "الحج يُقام في ذي الحجة وهو الشهر الثاني عشر من التقويم الهجري.",
];

const ASMA_ALLAH = [
  "الله - اسم الجلالة", "الرحمن - الرحمة الشاملة", "الرحيم - الرحمة الخاصة",
  "الملك - المالك المطلق", "القدوس - المنزّه عن كل نقص", "السلام - مصدر السلام",
  "المؤمن - المصدق لأنبيائه", "المهيمن - الرقيب على كل شيء", "العزيز - الغالب القوي",
  "الجبار - الذي جبر كسر خلقه", "المتكبر - المتعالي بكبريائه", "الخالق - موجد الأشياء",
  "الباري - المميّز بعضها عن بعض", "المصوّر - المعطي للصور", "الغفار - كثير المغفرة",
  "القهار - الغالب على كل شيء", "الوهاب - كثير العطاء", "الرزاق - المعطي للأرزاق",
  "الفتاح - فاتح أبواب الرزق", "العليم - المحيط علمه بكل شيء",
];

const RIDDLES = [
  { r: "ما هو الشيء الذي كلما أخذت منه كبر؟", a: "الحفرة 🕳️" },
  { r: "ما هو الشيء الذي يسير بلا أرجل؟", a: "الماء 💧" },
  { r: "ما هو الشيء الذي له أسنان ولا يعض؟", a: "المشط 🪮" },
  { r: "ما هو الشيء الذي يُملأ كل صباح ويُفرَّغ كل ليلة؟", a: "يوم عملك 📅" },
  { r: "أنا في الهواء لكن لا تستطيع إمساكي، ما أنا؟", a: "الصوت 🔊" },
];

const quran: Command = {
  data: new SlashCommandBuilder()
    .setName("quran")
    .setDescription("📖 آية قرآنية")
    .addIntegerOption((o) => o.setName("سورة").setDescription("رقم السورة (1-114)").setRequired(true).setMinValue(1).setMaxValue(114))
    .addIntegerOption((o) => o.setName("آية").setDescription("رقم الآية").setRequired(true).setMinValue(1)),
  async execute(interaction) {
    await interaction.deferReply();
    const surah = interaction.options.getInteger("سورة", true);
    const ayah = interaction.options.getInteger("آية", true);
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ar.alafasy`);
      const data = await res.json() as any;
      if (data.code !== 200) {
        await interaction.editReply("❌ رقم الآية أو السورة غير صحيح.");
        return;
      }
      const ayahData = data.data;
      const embed = new EmbedBuilder()
        .setColor(0x2f8b4e)
        .setTitle(`📖 سورة ${ayahData.surah.name} — الآية ${ayah}`)
        .setDescription(`﴿ ${ayahData.text} ﴾`)
        .setFooter({ text: `سورة ${ayahData.surah.englishName} — آية ${ayah}/${ayahData.surah.numberOfAyahs}` })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply("⚠️ تعذّر جلب الآية، تحقق من الرقم وأعد المحاولة.");
    }
  },
};

const hadith: Command = {
  data: new SlashCommandBuilder()
    .setName("hadith")
    .setDescription("📜 حديث نبوي عشوائي"),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const num = Math.floor(Math.random() * 100) + 1;
      const res = await fetch(`https://api.hadith.gading.dev/books/bukhari/${num}`);
      const data = await res.json() as any;
      if (!data?.data?.contents?.arab) throw new Error("no data");
      const embed = new EmbedBuilder()
        .setColor(0xf0c040)
        .setTitle("📜 حديث من صحيح البخاري")
        .setDescription(`"${data.data.contents.arab}"`)
        .setFooter({ text: `رقم الحديث: ${num}` })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch {
      const embed = new EmbedBuilder()
        .setColor(0xf0c040)
        .setTitle("📜 حديث نبوي شريف")
        .setDescription(`"${ISLAMIC_QUOTES[Math.floor(Math.random() * ISLAMIC_QUOTES.length)]}"`)
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

const prayer: Command = {
  data: new SlashCommandBuilder()
    .setName("prayer")
    .setDescription("🕌 مواقيت الصلاة")
    .addStringOption((o) => o.setName("مدينة").setDescription("اسم المدينة").setRequired(true))
    .addStringOption((o) => o.setName("دولة").setDescription("اسم الدولة").setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply();
    const city = interaction.options.getString("مدينة", true);
    const country = interaction.options.getString("دولة") ?? "";
    try {
      const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=4`;
      const res = await fetch(url);
      const data = await res.json() as any;
      if (data.code !== 200) throw new Error("bad response");
      const t = data.data.timings;
      const embed = new EmbedBuilder()
        .setColor(0x2f8b4e)
        .setTitle(`🕌 مواقيت الصلاة في ${city}`)
        .addFields(
          { name: "🌙 الفجر", value: t.Fajr, inline: true },
          { name: "☀️ الشروق", value: t.Sunrise, inline: true },
          { name: "🌤 الظهر", value: t.Dhuhr, inline: true },
          { name: "🌅 العصر", value: t.Asr, inline: true },
          { name: "🌆 المغرب", value: t.Maghrib, inline: true },
          { name: "🌃 العشاء", value: t.Isha, inline: true },
        )
        .setFooter({ text: "المصدر: aladhan.com" })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply("⚠️ تعذّر جلب مواقيت الصلاة. تحقق من اسم المدينة.");
    }
  },
};

const islamicquote: Command = {
  data: new SlashCommandBuilder()
    .setName("islamicquote")
    .setDescription("💎 حكمة إسلامية عشوائية"),
  async execute(interaction) {
    const quote = ISLAMIC_QUOTES[Math.floor(Math.random() * ISLAMIC_QUOTES.length)];
    const embed = new EmbedBuilder()
      .setColor(0x2f8b4e)
      .setTitle("💎 حكمة إسلامية")
      .setDescription(`"${quote}"`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const hijri: Command = {
  data: new SlashCommandBuilder()
    .setName("hijri")
    .setDescription("📅 التاريخ الهجري اليوم"),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const res = await fetch("https://api.aladhan.com/v1/gToH");
      const data = await res.json() as any;
      const h = data.data.hijri;
      const embed = new EmbedBuilder()
        .setColor(0x2f8b4e)
        .setTitle("📅 التاريخ الهجري")
        .setDescription(`**${h.day} ${h.month.ar} ${h.year} هـ**\n${h.day} ${h.month.en} ${h.year} AH`)
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply("⚠️ تعذّر جلب التاريخ الهجري.");
    }
  },
};

const islamicnames: Command = {
  data: new SlashCommandBuilder()
    .setName("names")
    .setDescription("👶 أسماء إسلامية")
    .addStringOption((o) =>
      o.setName("جنس").setDescription("ذكر أم أنثى").setRequired(true)
        .addChoices({ name: "ذكر", value: "male" }, { name: "أنثى", value: "female" }),
    ),
  async execute(interaction) {
    const gender = interaction.options.getString("جنس", true);
    const maleNames = ["محمد", "عبدالله", "إبراهيم", "عمر", "علي", "يوسف", "أحمد", "خالد", "سلمان", "عبدالرحمن", "مصعب", "بلال", "حمزة", "طارق", "زياد"];
    const femaleNames = ["فاطمة", "عائشة", "خديجة", "مريم", "زينب", "أسماء", "سارة", "هند", "نورة", "لمى", "رقية", "أميرة", "ريم", "دلال", "رهف"];
    const names = gender === "male" ? maleNames : femaleNames;
    const selected = names.sort(() => 0.5 - Math.random()).slice(0, 8);
    const embed = new EmbedBuilder()
      .setColor(0xeb459e)
      .setTitle(`👶 أسماء إسلامية ${gender === "male" ? "للذكور" : "للإناث"}`)
      .setDescription(selected.join(" • "))
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const asmaallah: Command = {
  data: new SlashCommandBuilder()
    .setName("asmaallah")
    .setDescription("✨ اسم من أسماء الله الحسنى"),
  async execute(interaction) {
    const name = ASMA_ALLAH[Math.floor(Math.random() * ASMA_ALLAH.length)];
    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle("✨ أسماء الله الحسنى")
      .setDescription(`**${name}**`)
      .setFooter({ text: "لله الأسماء الحسنى فادعوه بها" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const islamicfact: Command = {
  data: new SlashCommandBuilder()
    .setName("islamicfact")
    .setDescription("🔎 معلومة إسلامية"),
  async execute(interaction) {
    const fact = ISLAMIC_FACTS[Math.floor(Math.random() * ISLAMIC_FACTS.length)];
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔎 هل تعلم؟")
      .setDescription(fact)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const tasbih: Command = {
  data: new SlashCommandBuilder()
    .setName("tasbih")
    .setDescription("📿 التسبيح (33 مرة)")
    .addStringOption((o) =>
      o.setName("ذكر").setDescription("الذكر المراد").setRequired(true)
        .addChoices(
          { name: "سبحان الله", value: "سبحان الله" },
          { name: "الحمد لله", value: "الحمد لله" },
          { name: "الله أكبر", value: "الله أكبر" },
          { name: "لا إله إلا الله", value: "لا إله إلا الله" },
          { name: "استغفر الله", value: "أستغفر الله" },
        ),
    ),
  async execute(interaction) {
    const dhikr = interaction.options.getString("ذكر", true);
    const repeated = Array(33).fill(dhikr).join(" | ");
    const embed = new EmbedBuilder()
      .setColor(0x2f8b4e)
      .setTitle(`📿 ${dhikr}`)
      .setDescription(repeated.slice(0, 2000))
      .setFooter({ text: "33 مرة • سبّح الله بكرةً وأصيلاً" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const trivia: Command = {
  data: new SlashCommandBuilder()
    .setName("trivia")
    .setDescription("❓ سؤال ثقافي إسلامي"),
  async execute(interaction) {
    const questions = [
      { q: "كم عدد سور القرآن الكريم؟", a: "114 سورة" },
      { q: "ما هي أطول سورة في القرآن الكريم؟", a: "سورة البقرة" },
      { q: "ما هي أقصر سورة في القرآن الكريم؟", a: "سورة الكوثر" },
      { q: "كم عدد أركان الإسلام؟", a: "5 أركان" },
      { q: "في أي شهر نزل القرآن الكريم؟", a: "رمضان المبارك" },
      { q: "ما هو أول ما نزل من القرآن الكريم؟", a: "﴿اقرأ باسم ربك﴾ — سورة العلق" },
      { q: "ما اسم أم المؤمنين التي تزوجها النبي ﷺ أولاً؟", a: "السيدة خديجة بنت خويلد رضي الله عنها" },
      { q: "كم عدد الصلوات المفروضة في اليوم؟", a: "5 صلوات" },
    ];
    const item = questions[Math.floor(Math.random() * questions.length)];
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("❓ سؤال ثقافي إسلامي")
      .setDescription(`**${item.q}**`)
      .setFooter({ text: `الإجابة: ${item.a}` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export const islamicCommands: Command[] = [
  quran, hadith, prayer, islamicquote, hijri, islamicnames, asmaallah, islamicfact, tasbih, trivia,
];
