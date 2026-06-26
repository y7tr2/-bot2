import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
} from "discord.js";
import type { Command } from "./types";

interface SuggestionVote {
  up: Set<string>;
  down: Set<string>;
  authorId: string;
  text: string;
}

const suggestions = new Map<string, SuggestionVote>();

const suggest: Command = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("💡 إرسال اقتراح")
    .addStringOption((o) => o.setName("اقتراح").setDescription("اكتب اقتراحك").setRequired(true)),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const text = interaction.options.getString("اقتراح", true);
    const cfg = (await import("../config")).getConfig(interaction.guildId);
    const channelId = cfg.suggestChannelId ?? interaction.channelId;
    const channel = interaction.guild?.channels.cache.get(channelId) as any;
    if (!channel) { await interaction.reply({ content: "❌ قناة الاقتراحات غير محددة.", ephemeral: true }); return; }
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("💡 اقتراح جديد")
      .setDescription(text)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .addFields(
        { name: "👍 موافق", value: "0", inline: true },
        { name: "👎 غير موافق", value: "0", inline: true },
      )
      .setTimestamp();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`bloxpin_vote_up`).setLabel("👍 موافق").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bloxpin_vote_down`).setLabel("👎 غير موافق").setStyle(ButtonStyle.Danger),
    );
    const msg = await channel.send({ embeds: [embed], components: [row] });
    suggestions.set(msg.id, { up: new Set(), down: new Set(), authorId: interaction.user.id, text });
    await interaction.reply({ content: `✅ تم إرسال اقتراحك إلى <#${channelId}>.`, ephemeral: true });
  },
};

const setsuggest: Command = {
  data: new SlashCommandBuilder()
    .setName("setsuggest")
    .setDescription("⚙️ تحديد قناة الاقتراحات")
    .addChannelOption((o) => o.setName("قناة").setDescription("القناة المخصصة للاقتراحات").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) return;
    const channel = interaction.options.getChannel("قناة", true);
    (await import("../config")).getConfig(interaction.guildId).suggestChannelId = channel.id;
    await interaction.reply(`✅ تم تعيين <#${channel.id}> كقناة للاقتراحات.`);
  },
};

const giveaway: Command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("🎉 إنشاء مسابقة")
    .addStringOption((o) => o.setName("جائزة").setDescription("الجائزة").setRequired(true))
    .addIntegerOption((o) => o.setName("مدة").setDescription("المدة بالدقائق").setRequired(true).setMinValue(1).setMaxValue(10080))
    .addIntegerOption((o) => o.setName("فائزون").setDescription("عدد الفائزين").setRequired(false).setMinValue(1).setMaxValue(20))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guild || !interaction.guildId) return;
    const prize = interaction.options.getString("جائزة", true);
    const durationMin = interaction.options.getInteger("مدة", true);
    const winnersCount = interaction.options.getInteger("فائزون") ?? 1;
    const endTime = Date.now() + durationMin * 60 * 1000;
    const cfg = (await import("../config")).getConfig(interaction.guildId);
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle("🎉 مسابقة!")
      .setDescription(`**الجائزة:** ${prize}`)
      .addFields(
        { name: "🏆 عدد الفائزين", value: `${winnersCount}`, inline: true },
        { name: "⏰ تنتهي", value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
        { name: "👥 المشاركون", value: "0", inline: true },
      )
      .setFooter({ text: "اضغط 🎉 للمشاركة!" })
      .setTimestamp();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("giveaway_enter").setLabel("🎉 اشترك").setStyle(ButtonStyle.Primary),
    );
    const msg = await (interaction.channel as any).send({ embeds: [embed], components: [row] });
    cfg.giveaways.set(msg.id, {
      channelId: msg.channelId,
      guildId: interaction.guildId,
      messageId: msg.id,
      prize,
      endTime,
      winnersCount,
      participants: new Set(),
      ended: false,
    });
    await interaction.reply({ content: `✅ تم إنشاء المسابقة! [اذهب إليها](${msg.url})`, ephemeral: true });
    setTimeout(async () => {
      const ga = cfg.giveaways.get(msg.id);
      if (!ga || ga.ended) return;
      ga.ended = true;
      const participants = [...ga.participants];
      if (participants.length === 0) {
        await msg.edit({ embeds: [embed.setColor(0xed4245).setTitle("🎉 انتهت المسابقة — لا مشاركين")], components: [] });
        return;
      }
      const winners = participants.sort(() => Math.random() - 0.5).slice(0, ga.winnersCount);
      const winnerMentions = winners.map((id) => `<@${id}>`).join(", ");
      await msg.edit({
        embeds: [embed.setColor(0x57f287).setTitle("🏆 انتهت المسابقة!").setDescription(`**الجائزة:** ${ga.prize}\n\n🏅 **الفائزون:** ${winnerMentions}`)],
        components: [],
      });
      await (msg.channel as any).send({ content: `🎉 مبروك ${winnerMentions}! فزتم بـ **${ga.prize}**!` });
    }, durationMin * 60 * 1000);
  },
};

export async function handleBloxpinButton(interaction: ButtonInteraction): Promise<void> {
  const { customId, message } = interaction;
  if (customId === "bloxpin_vote_up" || customId === "bloxpin_vote_down") {
    const vote = suggestions.get(message.id);
    if (!vote) { await interaction.reply({ content: "❌ هذا الاقتراح قديم.", ephemeral: true }); return; }
    const isUp = customId === "bloxpin_vote_up";
    const userId = interaction.user.id;
    if (isUp) {
      if (vote.up.has(userId)) { vote.up.delete(userId); }
      else { vote.up.add(userId); vote.down.delete(userId); }
    } else {
      if (vote.down.has(userId)) { vote.down.delete(userId); }
      else { vote.down.add(userId); vote.up.delete(userId); }
    }
    const embed = EmbedBuilder.from(message.embeds[0])
      .spliceFields(0, 2,
        { name: "👍 موافق", value: `${vote.up.size}`, inline: true },
        { name: "👎 غير موافق", value: `${vote.down.size}`, inline: true },
      );
    await interaction.update({ embeds: [embed] });
  }
}

export const bloxpinCommands: Command[] = [suggest, setsuggest, giveaway];
