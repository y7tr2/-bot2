import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import { logger } from "../lib/logger";
import { loadCommands, type Command } from "./commands/index";
import { onReady } from "./events/ready";
import { onInteractionCreate } from "./events/interaction";
import { onGuildMemberAdd } from "./events/memberAdd";
import { onGuildMemberRemove } from "./events/memberRemove";
import { onMessageCreate } from "./events/messageCreate";
import { startSelfPing } from "./selfping";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
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

  await client.login(token);
  logger.info("Discord bot logged in successfully");

  const renderUrl = process.env["RENDER_URL"];
  if (renderUrl) {
    startSelfPing(renderUrl);
  } else {
    logger.info("RENDER_URL not set — self-ping disabled (set it after deploying to Render)");
  }
}
