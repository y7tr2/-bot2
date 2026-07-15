import { Client, GatewayIntentBits } from "discord.js";
import { logger } from "./lib/logger";

const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 دقيقة

function startSelfPing(url: string) {
  const ping = async () => {
    try {
      const res = await fetch(url);
      logger.info({ status: res.status, url }, "Self-ping sent");
    } catch (err) {
      logger.error({ err, url }, "Self-ping failed");
    }
  };

  // بينق فوري عند البدء
  void ping();
  // ثم كل 14 دقيقة
  setInterval(() => void ping(), PING_INTERVAL_MS);
}

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

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once("ready", (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot is online");

    if (pingTarget) {
      logger.info({ pingTarget }, "Starting self-ping");
      startSelfPing(pingTarget);
    } else {
      logger.warn("RENDER_URL not set — self-ping disabled");
    }
  });

  client.on("error", (err) => {
    logger.error({ err }, "Discord client error");
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Failed to login to Discord");
  });
}
