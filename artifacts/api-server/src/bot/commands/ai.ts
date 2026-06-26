import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { Command } from "./types";
import { getConfig, setRespectLevel, setAiChannel } from "../config";
import { askAI, summarizeText, translateText, explainTopic, correctText, debateAI, generateStory, generateDua } from "../ai";

const aiChat: Command = {
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription("🤖 اسأل الذكاء الاصطناعي")
    .addStringOption((o) => o.setName("سؤال").setDescription("اكتب سؤالك أو رسالتك").setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString("سؤال", true);
    if (!interaction.guildId) return;
    const cfg = getConfig(interaction.guildId);
    if (cfg.aiChannelId && interaction.channelId !== cfg.aiChannelId) {
      await interaction.reply({ content: `❌ أوامر الذكاء الاصطناعي مخصصة في <#${cfg.aiChannelId}> فقط.`, ephemeral: true });
      return;
    }
    await interaction.deferReply();
    const answer = await askAI(question, cfg.respectLevel, interaction.client.user.username);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: `🤖 ${interaction.client.user.username}`, iconURL: interaction.client.user.displayAvatarURL() })
      .addFields(
        { name: "❓ السؤال", value: question.slice(0, 1024) },
        { name: "💬 الجواب", value: answer.slice(0, 1024) },
      )
      .setFooter({ text: `مستوى الاحترام: ${cfg.respectLevel}/5` })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};

const setchannel: Command = {
  data: new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("⚙️ تحديد قناة الذكاء الاصطناعي")
    .addChannelOption((o) => o.setName("قناة").setDescription("القناة المخصصة للذكاء الاصطناعي").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const channel = interaction.options.getChannel("قناة");
    setAiChannel(interaction.guildId, channel ? channel.id : null);
    if (channel) {
      await interaction.reply(`✅ تم تحديد <#${channel.id}> كقناة للذكاء الاصطناعي.`);
    } else {
      await interaction.reply("✅ تم إلغاء تقييد قناة الذكاء الاصطناعي.");
    }
  },
};

const setrespect: Command = {
  data: new SlashCommandBuilder()
    .setName("setrespect")
    .setDescription("⚙️ تحديد مستوى الاحترام (1 قليل أدب ← 5 محترم جداً)")
    .addIntegerOption((o) => o.setName("مستوى").setDescription("اختر من 1 إلى 5").setRequired(true).setMinValue(1).setMaxValue(5))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const level = interaction.options.getInteger("مستوى", true);
    setRespectLevel(interaction.guildId, level);
    const labels = ["", "😈 قليل أدب", "😒 متذمر", "😐 محايد", "😊 محترم", "🎩 راقٍ جداً"];
    await interaction.reply(`✅ تم تحديد مستوى الاحترام: **${labels[level]}** (${level}/5)`);
  },
};

const summarize: Command = {
  data: new SlashCommandBuilder()
    .setName("summarize")
    .setDescription("📝 تلخيص نص")
    .addStringOption((o) => o.setName("نص").setDescription("النص المراد تلخيصه").setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const text = interaction.options.getString("نص", true);
    const result = await summarizeText(text);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("📝 تلخيص النص")
      .addFields(
        { name: "النص الأصلي", value: text.slice(0, 512) + (text.length > 512 ? "..." : "") },
        { name: "الملخص", value: result },
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};

const translate: Command = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("🌐 ترجمة نص")
    .addStringOption((o) => o.setName("نص").setDescription("النص المراد ترجمته").setRequired(true))
    .addStringOption((o) => o.setName("لغة").setDescription("اللغة المستهدفة").setRequired(true)
      .addChoices(
        { name: "الإنجليزية", value: "English" },
        { name: "العربية", value: "Arabic" },
        { name: "الفرنسية", value: "French" },
        { name: "الأوردية", value: "Urdu" },
        { name: "التركية", value: "Turkish" },
        { name: "الأندونيسية", value: "Indonesian" },
      )),
  async execute(interaction) {
    await interaction.deferReply();
    const text = interaction.options.getString("نص", true);
    const lang = interaction.options.getString("لغة", true);
    const result = await translateText(text, lang);
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("🌐 الترجمة")
      .addFields(
        { name: "النص الأصلي", value: text.slice(0, 512) },
        { name: `الترجمة إلى ${lang}`, value: result },
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};

const explain: Command = {
  data: new SlashCommandBuilder()
    .setName("explain")
    .setDescription("💡 شرح موضوع")
    .addStringOption((o) => o.setName("موضوع").setDescription("الموضوع المراد شرحه").setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const topic = interaction.options.getString("موضوع", true);
    const result = await explainTopic(topic);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`💡 شرح: ${topic}`)
      .setDescription(result)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};

const correct: Command = {
  data: new SlashCommandBuilder()
    .setName("correct")
    .setDescription("✏️ تصحيح نص (إملاء ونحو)")
    .addStringOption((o) => o.setName("نص").setDescription("النص المراد تصحيحه").setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const text = interaction.options.getString("نص", true);
    const result = await correctText(text);
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("✏️ تصحيح النص")
      .addFields(
        { name: "النص الأصلي", value: text.slice(0, 512) },
        { name: "النص المصحح", value: result },
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};

const debate: Command = {
  data: new SlashCommandBuilder()
    .setName("debate")
    .setDescription("🗣️ ناقش البوت في موضوع")
    .addStringOption((o) => o.setName("موضوع").setDescription("موضوع النقاش").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guildId) return;
    await interaction.deferReply();
    const topic = interaction.options.getString("موضوع", true);
    const cfg = getConfig(interaction.guildId);
    const result = await debateAI(topic, cfg.respectLevel, interaction.client.user.username);
    const embed = new EmbedBuilder()
      .setColor(0xeb459e)
      .setTitle(`🗣️ نقاش: ${topic}`)
      .setDescription(result)
      .setFooter({ text: "البوت يعطي رأيه ولا يمثل رأي المشغّل" })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};

const story: Command = {
  data: new SlashCommandBuilder()
    .setName("story")
    .setDescription("📖 قصة قصيرة هادفة")
    .addStringOption((o) => o.setName("موضوع").setDescription("موضوع القصة").setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const theme = interaction.options.getString("موضوع", true);
    const result = await generateStory(theme);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`📖 قصة: ${theme}`)
      .setDescription(result)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};

const dua: Command = {
  data: new SlashCommandBuilder()
    .setName("dua")
    .setDescription("🤲 دعاء لموقف معين")
    .addStringOption((o) => o.setName("موقف").setDescription("صف موقفك أو حاجتك").setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const situation = interaction.options.getString("موقف", true);
    const result = await generateDua(situation);
    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setTitle("🤲 دعاء")
      .setDescription(result)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};

export const aiCommands: Command[] = [
  aiChat, setchannel, setrespect, summarize, translate, explain, correct, debate, story, dua,
];
