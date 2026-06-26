import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "./types";

const ATHKAR = [
  "سبحان الله وبحمده — سبحان الله العظيم",
  "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير",
  "اللهم صلِّ وسلم وبارك على نبينا محمد ﷺ",
  "أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم وأتوب إليه",
  "سبحان الله (33) والحمد لله (33) والله أكبر (33) ولا إله إلا الله وحده لا شريك له",
  "حسبي الله لا إله إلا هو، عليه توكلت وهو رب العرش العظيم",
  "اللهم إنك عفو كريم تحب العفو فاعفُ عنا",
  "لا حول ولا قوة إلا بالله العلي العظيم",
  "اللهم اغفر لي وارحمني واهدني وعافني وارزقني",
  "رضيت بالله رباً وبالإسلام ديناً وبمحمد ﷺ نبياً ورسولاً",
];

const AYAT = [
  { text: "إِنَّ مَعَ الْعُسْرِ يُسْرًا", ref: "الشرح: 6" },
  { text: "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا", ref: "الطلاق: 2" },
  { text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا", ref: "الشرح: 5" },
  { text: "وَاللَّهُ غَالِبٌ عَلَىٰ أَمْرِهِ وَلَٰكِنَّ أَكْثَرَ النَّاسِ لَا يَعْلَمُونَ", ref: "يوسف: 21" },
  { text: "يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ", ref: "البقرة: 153" },
  { text: "وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ", ref: "الحديد: 4" },
  { text: "إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ", ref: "الرعد: 11" },
  { text: "وَقُل رَّبِّ زِدْنِي عِلْمًا", ref: "طه: 114" },
];

const PRAYER_TIMES_NOTE = "لتعرف أوقات الصلاة الدقيقة في مدينتك، استخدم تطبيق أذان أو الموقع الرسمي لوزارة الشؤون الدينية.";

const athkar: Command = {
  data: new SlashCommandBuilder().setName("athkar").setDescription("📿 ذكر عشوائي من الأذكار"),
  async execute(interaction) {
    const zikr = ATHKAR[Math.floor(Math.random() * ATHKAR.length)];
    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setTitle("📿 ذكر")
      .setDescription(`**${zikr}**`)
      .setFooter({ text: "اللهم اجعلنا من الذاكرين" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const ayah: Command = {
  data: new SlashCommandBuilder().setName("ayah").setDescription("📖 آية قرآنية عشوائية"),
  async execute(interaction) {
    const item = AYAT[Math.floor(Math.random() * AYAT.length)];
    const embed = new EmbedBuilder()
      .setColor(0x27ae60)
      .setTitle("📖 آية قرآنية")
      .setDescription(`**﴿ ${item.text} ﴾**`)
      .setFooter({ text: `سورة ${item.ref}` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const prayer: Command = {
  data: new SlashCommandBuilder()
    .setName("prayer")
    .setDescription("🕌 أوقات الصلاة"),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const res = await fetch(
        `https://api.aladhan.com/v1/timingsByCity?city=Riyadh&country=SA&method=4`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as any;
      const t = data.data?.timings;
      const date = data.data?.date?.readable ?? "";
      const embed = new EmbedBuilder()
        .setColor(0x27ae60)
        .setTitle("🕌 أوقات الصلاة — الرياض")
        .setDescription(`📅 **${date}**`)
        .addFields(
          { name: "🌅 الفجر", value: t.Fajr, inline: true },
          { name: "☀️ الشروق", value: t.Sunrise, inline: true },
          { name: "🌤️ الظهر", value: t.Dhuhr, inline: true },
          { name: "🌇 العصر", value: t.Asr, inline: true },
          { name: "🌆 المغرب", value: t.Maghrib, inline: true },
          { name: "🌙 العشاء", value: t.Isha, inline: true },
        )
        .setFooter({ text: "المصدر: aladhan.com" })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: `🕌 ${PRAYER_TIMES_NOTE}` });
    }
  },
};

const hijri: Command = {
  data: new SlashCommandBuilder().setName("hijri").setDescription("📅 التاريخ الهجري اليوم"),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const res = await fetch(`https://api.aladhan.com/v1/gToH?date=${new Date().toLocaleDateString("en-GB")}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error();
      const data = await res.json() as any;
      const h = data.data?.hijri;
      const g = data.data?.gregorian;
      const embed = new EmbedBuilder()
        .setColor(0x27ae60)
        .setTitle("📅 التاريخ الهجري")
        .addFields(
          { name: "🌙 التاريخ الهجري", value: `${h?.date} — ${h?.month?.ar} ${h?.year} هـ`, inline: false },
          { name: "☀️ التاريخ الميلادي", value: `${g?.date} — ${g?.month?.en} ${g?.year}`, inline: false },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch {
      const now = new Date();
      await interaction.editReply({ content: `📅 التاريخ الميلادي: ${now.toLocaleDateString("ar-SA")}` });
    }
  },
};

export const islamicCommands: Command[] = [athkar, ayah, prayer, hijri];
