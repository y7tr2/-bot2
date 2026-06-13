import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from "discord.js";
import type { Command } from "./types";

const ATM_LOCATIONS = [
  { name: "🏦 وسط المدينة", desc: "بجانب البنك الرئيسي — المنطقة الوسطى", coords: "X: 120 | Z: -340" },
  { name: "🏪 المول التجاري", desc: "مدخل المول من الجهة الشمالية", coords: "X: -280 | Z: 90" },
  { name: "⛽ محطة الوقود الغربية", desc: "بجانب البمب الغربي على الطريق السريع", coords: "X: -510 | Z: 200" },
  { name: "🏥 أمام المستشفى", desc: "يمين المدخل الرئيسي للمستشفى", coords: "X: 350 | Z: -180" },
  { name: "🚂 محطة القطار", desc: "داخل محطة القطار بالقرب من المخرج", coords: "X: 60 | Z: 420" },
  { name: "🏠 الحي السكني", desc: "عند مفترق الطرق في الحي الشمالي", coords: "X: -150 | Z: -500" },
];

const FIGHT_ZONES = [
  { name: "⚔️ ساحة الحرب الكبرى", desc: "المنطقة الحمراء وسط الخريطة — معارك مكثفة", danger: "🔴 خطر عالي", tips: "ابقَ متحرك وتجنب الأماكن المكشوفة" },
  { name: "🏚️ الأحياء المهجورة", desc: "الحي الجنوبي الشرقي — قتال في الشوارع الضيقة", danger: "🟠 خطر متوسط-عالي", tips: "استخدم الجدران كغطاء" },
  { name: "🌉 الجسر الحديدي", desc: "جسر النهر — معارك في مكان ضيق", danger: "🟠 خطر متوسط", tips: "لا تقف في المنتصف — سهل الاستهداف" },
  { name: "🏭 المصنع القديم", desc: "شمال الخريطة — عدة طوابق للمطاردات", danger: "🟡 خطر متوسط", tips: "الطابق العلوي يعطيك أفضلية" },
  { name: "🌲 الغابة الكثيفة", desc: "غرب الخريطة — مناسبة للكمائن", danger: "🟡 خطر متوسط", tips: "مكان مثالي للاختباء والمباغتة" },
  { name: "🏖️ الشاطئ الجنوبي", desc: "جنوب الخريطة — معارك مفتوحة", danger: "🟢 خطر منخفض", tips: "مناسب للمبتدئين" },
];

const KEY_SPOTS = [
  { name: "🏦 البنك الرئيسي", desc: "وسط المدينة — يمكن سرقته مع فريق", coords: "X: 110 | Z: -330" },
  { name: "🚓 مركز الشرطة", desc: "شرق وسط المدينة — احذر المنطقة", coords: "X: 200 | Z: -300" },
  { name: "🏥 المستشفى", desc: "شمال وسط المدينة — تجديد الصحة", coords: "X: 350 | Z: -180" },
  { name: "🔫 متجر الأسلحة", desc: "جنوب المدينة — شراء الأسلحة", coords: "X: -80 | Z: 310" },
  { name: "🚗 كراج السيارات", desc: "غرب المدينة — استئجار وإصلاح", coords: "X: -400 | Z: 50" },
  { name: "🌟 منطقة الريسبون", desc: "شرق الخريطة — مكان الولادة الرئيسي", coords: "X: 500 | Z: 0" },
];

const FIGHT_TIPS = [
  { name: "🎯 دقة التصويب", value: "صوّب على الرأس دائماً للضرر الأعلى." },
  { name: "🏃 الحركة", value: "لا تقف ثابتاً — الحركة تجعلك صعب الاستهداف." },
  { name: "🛡️ الغطاء", value: "استخدم الجدران والسيارات كغطاء بين الطلقات." },
  { name: "💊 الصحة", value: "احتفظ بإمدادات. راقب مستوى صحتك دائماً." },
  { name: "👥 الفريق", value: "اللعب الجماعي يضاعف فرص الفوز." },
  { name: "🗺️ معرفة الماب", value: "اعرف مسارات الهروب قبل الدخول للقتال." },
  { name: "⚔️ السلاح المناسب", value: "قرب = Shotgun | متوسط = SMG | بعيد = Sniper" },
];

function buildMainPanel(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🗺️ بانل ماب بلوكسبين")
    .setDescription("اضغط على أي زر لتحصل على معلومات **مخفية** خاصة بك 👇")
    .addFields(
      { name: "💳 الصرافات", value: "6 مواقع صرافات في الخريطة", inline: true },
      { name: "⚔️ مناطق الفايتات", value: "6 مناطق قتال بمستويات خطر مختلفة", inline: true },
      { name: "📍 المواقع المهمة", value: "بنك، شرطة، مستشفى، سلاح...", inline: true },
      { name: "💡 نصائح القتال", value: "تكتيكات للمبتدئين والمحترفين", inline: true },
      { name: "📊 معلومات الماب", value: "إحصائيات الخريطة الكاملة", inline: true },
    )
    .setFooter({ text: "Block Spin Map | بلوكسبين" })
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("bloxpin_atm")
      .setLabel("💳 أماكن الصرافات")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("bloxpin_fights")
      .setLabel("⚔️ مناطق الفايتات")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("bloxpin_spots")
      .setLabel("📍 المواقع المهمة")
      .setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("bloxpin_tips")
      .setLabel("💡 نصائح القتال")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bloxpin_info")
      .setLabel("📊 معلومات الماب")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}

export async function handleBloxpinButton(interaction: ButtonInteraction): Promise<void> {
  const id = interaction.customId;

  if (id === "bloxpin_atm") {
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("💳 مواقع الصرافات")
      .setDescription(`يوجد **${ATM_LOCATIONS.length}** صرافات في ماب بلوكسبين:`)
      .addFields(ATM_LOCATIONS.map((a) => ({
        name: a.name,
        value: `📍 ${a.desc}\n\`${a.coords}\``,
        inline: false,
      })))
      .setFooter({ text: "💡 الصرافات تعمل 24/7 في اللعبة | هذه الرسالة مخفية عليك فقط" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  else if (id === "bloxpin_fights") {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("⚔️ مناطق الفايتات")
      .setDescription("مناطق القتال مرتّبة من الأعلى خطورة للأقل:")
      .addFields(FIGHT_ZONES.map((z) => ({
        name: z.name,
        value: `${z.danger}\n📝 ${z.desc}\n💡 ${z.tips}`,
        inline: false,
      })))
      .setFooter({ text: "⚠️ كن حذراً في المناطق الحمراء | هذه الرسالة مخفية عليك فقط" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  else if (id === "bloxpin_spots") {
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("📍 المواقع المهمة")
      .addFields(KEY_SPOTS.map((s) => ({
        name: s.name,
        value: `📝 ${s.desc}\n\`${s.coords}\``,
        inline: false,
      })))
      .setFooter({ text: "Block Spin Map | هذه الرسالة مخفية عليك فقط" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  else if (id === "bloxpin_tips") {
    const embed = new EmbedBuilder()
      .setColor(0xeb459e)
      .setTitle("💡 نصائح القتال")
      .addFields(FIGHT_TIPS.map((t) => ({ name: t.name, value: t.value, inline: false })))
      .setFooter({ text: "⚡ تدرّب وستصبح أقوى! | هذه الرسالة مخفية عليك فقط" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  else if (id === "bloxpin_info") {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📊 تفاصيل ماب بلوكسبين")
      .addFields(
        { name: "🗺️ حجم الخريطة", value: "1200 × 1200 وحدة", inline: true },
        { name: "🏙️ المناطق الرئيسية", value: "6 مناطق", inline: true },
        { name: "💳 عدد الصرافات", value: "6 صرافات", inline: true },
        { name: "⚔️ مناطق القتال", value: "6 مناطق", inline: true },
        { name: "🚗 المركبات", value: "سيارات، موتوسيكلات، شاحنات", inline: true },
        { name: "🏦 البنوك", value: "1 رئيسي + 2 فروع", inline: true },
        { name: "🌅 دورة الوقت", value: "نهار/ليل كل 30 دقيقة", inline: true },
        { name: "☁️ الطقس", value: "يتغير عشوائياً", inline: true },
        { name: "👥 أقصى لاعبين", value: "50 لاعب / سيرفر", inline: true },
      )
      .setFooter({ text: "بلوكسبين | هذه الرسالة مخفية عليك فقط" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

const mapPanelCmd: Command = {
  data: new SlashCommandBuilder()
    .setName("map")
    .setDescription("🗺️ بانل ماب بلوكسبين التفاعلي"),
  async execute(interaction) {
    const panel = buildMainPanel();
    await interaction.reply(panel);
  },
};

export const bloxpinCommands: Command[] = [mapPanelCmd];
