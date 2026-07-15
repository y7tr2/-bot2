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

const PING_INTERVAL_MS = 3 * 60 * 1000; // 3 دقائق
const PREFIX = "!";

// ─── Self-ping ────────────────────────────────────────────────────────────────

function startSelfPing(url: string) {
  const ping = async () => {
    try {
      const res = await fetch(url);
      logger.info({ status: res.status, url }, "Self-ping sent");
    } catch (err) {
      logger.error({ err, url }, "Self-ping failed");
    }
  };

  void ping();
  setInterval(() => void ping(), PING_INTERVAL_MS);
}

// ─── Owner check ─────────────────────────────────────────────────────────────

async function getOwnerId(client: Client): Promise<string | null> {
  try {
    const app = await client.application?.fetch();
    if (!app) return null;
    if (app.owner instanceof Team) {
      return app.owner.ownerId;
    }
    return app.owner?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function handleCommand(
  msg: Message,
  ownerId: string,
  args: string[],
  cmd: string,
) {
  // Owner-only gate
  if (msg.author.id !== ownerId) return;

  const guild = msg.guild;
  if (!guild) return;

  const channel = msg.channel as TextChannel;

  // ── !nuke ──────────────────────────────────────────────────────────────
  if (cmd === "nuke") {
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

  // ── !kick @user [reason] ───────────────────────────────────────────────
  else if (cmd === "kick") {
    const target = msg.mentions.members?.first();
    if (!target) { await msg.reply("❌ حدد اليوزر").catch(() => {}); return; }
    const reason = args.slice(1).join(" ") || "بدون سبب";
    await target.kick(reason).catch(() => {});
    await msg.react("✅").catch(() => {});
  }

  // ── !ban @user [reason] ────────────────────────────────────────────────
  else if (cmd === "ban") {
    const target = msg.mentions.members?.first();
    if (!target) { await msg.reply("❌ حدد اليوزر").catch(() => {}); return; }
    const reason = args.slice(1).join(" ") || "بدون سبب";
    await target.ban({ reason, deleteMessageSeconds: 60 * 60 * 24 }).catch(() => {});
    await msg.react("✅").catch(() => {});
  }

  // ── !mute @user [minutes] ─────────────────────────────────────────────
  else if (cmd === "mute") {
    const target = msg.mentions.members?.first() as GuildMember | undefined;
    if (!target) { await msg.reply("❌ حدد اليوزر").catch(() => {}); return; }
    const minutes = parseInt(args[1] ?? "10") || 10;
    await target.timeout(minutes * 60 * 1000, "timeout by owner").catch(() => {});
    await msg.react("✅").catch(() => {});
  }

  // ── !unmute @user ──────────────────────────────────────────────────────
  else if (cmd === "unmute") {
    const target = msg.mentions.members?.first() as GuildMember | undefined;
    if (!target) { await msg.reply("❌ حدد اليوزر").catch(() => {}); return; }
    await target.timeout(null).catch(() => {});
    await msg.react("✅").catch(() => {});
  }

  // ── !lock ──────────────────────────────────────────────────────────────
  else if (cmd === "lock") {
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: false,
    }).catch(() => {});
    await msg.react("🔒").catch(() => {});
  }

  // ── !unlock ────────────────────────────────────────────────────────────
  else if (cmd === "unlock") {
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: null,
    }).catch(() => {});
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
    const voiceMembers = guild.members.cache.filter(
      (m) => m.voice.channelId !== null && !m.user.bot,
    );
    await Promise.all(
      voiceMembers.map((m) => m.voice.disconnect("crash by owner").catch(() => {})),
    );
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
  const pingTarget = renderUrl
    ? `${renderUrl.replace(/\/$/, "")}/api/healthz`
    : null;

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
    } else {
      logger.warn("RENDER_URL not set — self-ping disabled");
    }
  });

  client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;
    if (!ownerId) return;

    const [rawCmd, ...args] = msg.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = rawCmd?.toLowerCase() ?? "";

    await handleCommand(msg, ownerId, args, cmd).catch((err) => {
      logger.error({ err, cmd }, "Command error");
    });
  });

  client.on("error", (err) => {
    logger.error({ err }, "Discord client error");
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Failed to login to Discord");
  });
}
