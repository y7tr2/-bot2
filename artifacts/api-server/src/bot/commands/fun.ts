import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "./types";

const RIDDLES = [
  { q: "ما هو الشيء الذي كلما أخذت منه كبر؟", a: "الحفرة 🕳️" },
  { q: "ما هو الشيء الذي يسير بلا أرجل؟", a: "الماء 💧" },
  { q: "ما هو الشيء الذي له أسنان ولا يعض؟", a: "المشط 🪮" },
  { q: "ما الذي يملأ الغرفة ولا يأخذ حيزاً؟", a: "الضوء 💡" },
  { q: "أنا في الهواء لكن لا تستطيع إمساكي، ما أنا؟", a: "الصوت 🔊" },
  { q: "كلما نظفتني اتسخت، ما أنا؟", a: "الماء 💧" },
  { q: "لدي مفتاح لكن لا باب لي، ما أنا؟", a: "البيانو 🎹" },
];

const BALL_ANSWERS = [
  "بالتأكيد نعم ✅", "لا شك في ذلك ✅", "يُمكن الاعتماد عليه ✅",
  "كما أرى: نعم ✅", "على الأرجح ✅", "التوقعات جيدة ✅",
  "لا أعرف، اسأل مجدداً 🔮", "لا يمكنني التنبؤ الآن 🔮",
  "من المشكوك فيه 🔮", "لا تعتمد على ذلك ❌",
  "ردّي: لا ❌", "آفاقي تقول لا ❌", "غير محتمل جداً ❌",
];

const eightBall: Command = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("🎱 اسأل الكرة السحرية")
    .addStringOption((o) => o.setName("سؤال").setDescription("سؤالك").setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString("سؤال", true);
    const answer = BALL_ANSWERS[Math.floor(Math.random() * BALL_ANSWERS.length)];
    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setTitle("🎱 الكرة السحرية")
      .addFields(
        { name: "❓ السؤال", value: question },
        { name: "🔮 الجواب", value: answer },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const roll: Command = {
  data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription("🎲 رمي نرد")
    .addIntegerOption((o) =>
      o.setName("وجوه").setDescription("عدد وجوه النرد (افتراضي: 6)").setRequired(false).setMinValue(2).setMaxValue(100),
    ),
  async execute(interaction) {
    const sides = interaction.options.getInteger("وجوه") ?? 6;
    const result = Math.floor(Math.random() * sides) + 1;
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("🎲 رمي النرد")
      .setDescription(`نرد بـ **${sides}** وجه → **${result}**`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const flip: Command = {
  data: new SlashCommandBuilder()
    .setName("flip")
    .setDescription("🪙 رمي عملة"),
  async execute(interaction) {
    const result = Math.random() < 0.5 ? "👑 صورة" : "🔢 كتابة";
    await interaction.reply(`🪙 نتيجة رمي العملة: **${result}**`);
  },
};

const poll: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("📊 إنشاء استفتاء")
    .addStringOption((o) => o.setName("سؤال").setDescription("سؤال الاستفتاء").setRequired(true))
    .addStringOption((o) => o.setName("خيار1").setDescription("الخيار الأول").setRequired(true))
    .addStringOption((o) => o.setName("خيار2").setDescription("الخيار الثاني").setRequired(true))
    .addStringOption((o) => o.setName("خيار3").setDescription("الخيار الثالث").setRequired(false))
    .addStringOption((o) => o.setName("خيار4").setDescription("الخيار الرابع").setRequired(false)),
  async execute(interaction) {
    const question = interaction.options.getString("سؤال", true);
    const options = [
      interaction.options.getString("خيار1", true),
      interaction.options.getString("خيار2", true),
      interaction.options.getString("خيار3"),
      interaction.options.getString("خيار4"),
    ].filter(Boolean) as string[];

    const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];
    const description = options.map((o, i) => `${emojis[i]} ${o}`).join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 ${question}`)
      .setDescription(description)
      .setFooter({ text: `استفتاء من ${interaction.user.tag}` })
      .setTimestamp();

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (let i = 0; i < options.length; i++) {
      await msg.react(emojis[i]);
    }
  },
};

const riddle: Command = {
  data: new SlashCommandBuilder()
    .setName("riddle")
    .setDescription("🧩 أحجية ذكاء"),
  async execute(interaction) {
    const item = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
    const embed = new EmbedBuilder()
      .setColor(0xeb459e)
      .setTitle("🧩 أحجية")
      .setDescription(`**${item.q}**`)
      .setFooter({ text: `الإجابة: ${item.a}` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

const number: Command = {
  data: new SlashCommandBuilder()
    .setName("number")
    .setDescription("🔢 خمّن الرقم (1-100)")
    .addIntegerOption((o) =>
      o.setName("تخمين").setDescription("رقمك من 1 إلى 100").setRequired(true).setMinValue(1).setMaxValue(100),
    ),
  async execute(interaction) {
    const guess = interaction.options.getInteger("تخمين", true);
    const secret = Math.floor(Math.random() * 100) + 1;
    let msg: string;
    if (guess === secret) {
      msg = `🎉 مبروك! خمّنت الرقم الصحيح: **${secret}**`;
    } else if (Math.abs(guess - secret) <= 10) {
      msg = `🔥 قريب جداً! الرقم كان **${secret}**، أنت خمّنت **${guess}**`;
    } else {
      msg = `❌ خطأ! الرقم كان **${secret}**، أنت خمّنت **${guess}**`;
    }
    await interaction.reply(msg);
  },
};

export const funCommands: Command[] = [
  eightBall, roll, flip, poll, riddle, number,
];
