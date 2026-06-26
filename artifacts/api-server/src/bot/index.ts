import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import { logger } from "../lib/logger";
import { loadCommands, type Command } from "./commands/index";
import { onReady } from "./events/ready";
import { onInteractionCreate } from "./events/interaction";
import { onGuildMemberAdd } from "./events/memberAdd";
import { onGuildMemberRemove } from "./events/memberRemove";
import { onMessageCreate } from "./events/messageCreate";
import { onMessageDelete } from "./events/messageDelete";
import { startSelfPing } from "./selfping";
import { handleAntiNuke } from "./commands/protection";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.Reaction],
});

const commands = new Collection<string, Command>();

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN is not set — bot will not start");
    return;
  }

  const allCommands = loadCommands(commands);

  client.once("ready", () => onReady(client, allCommands));
  client.on("interactionCreate", (i) => onInteractionCreate(i, commands));
  client.on("guildMemberAdd", onGuildMemberAdd);
  client.on("guildMemberRemove", onGuildMemberRemove);
  client.on("messageCreate", onMessageCreate);
  client.on("messageDelete", onMessageDelete);

  client.on("channelDelete", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    try {
      const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: 12 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      await handleAntiNuke(channel.guild.id, entry.executor.id, channel.guild);
    } catch { /* no audit log perms */ }
  });

  client.on("roleDelete", async (role) => {
    try {
      const logs = await role.guild.fetchAuditLogs({ limit: 1, type: 32 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      await handleAntiNuke(role.guild.id, entry.executor.id, role.guild);
    } catch { /* no audit log perms */ }
  });

  client.on("guildBanAdd", async (ban) => {
    try {
      const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: 22 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      await handleAntiNuke(ban.guild.id, entry.executor.id, ban.guild);
    } catch { /* no audit log perms */ }
  });

  await client.login(token);
  logger.info("Discord bot logged in successfully");

  const renderUrl = process.env["RENDER_URL"];
  if (renderUrl) {
    startSelfPing(renderUrl);
  } else {
    logger.info("RENDER_URL not set — self-ping disabled");
  }
}
