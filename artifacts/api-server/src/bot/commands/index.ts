import type { Collection } from "discord.js";
import type { Command } from "./types";
import { aiCommands } from "./ai";
import { islamicCommands } from "./islamic";
import { moderationCommands } from "./moderation";
import { infoCommands } from "./info";
import { funCommands } from "./fun";
import { adminCommands } from "./admin";
import { bloxpinCommands } from "./bloxpin";
import { ticketCommands } from "./ticket";
import { utilityCommands } from "./utility";
import { gamesCommands } from "./games";
import { protectionCommands } from "./protection";
import { storeCommands } from "./store";
import { decorationCommands } from "./decoration";

export type { Command };

export function loadCommands(collection: Collection<string, Command>): Command[] {
  const all: Command[] = [
    ...aiCommands,
    ...islamicCommands,
    ...moderationCommands,
    ...infoCommands,
    ...funCommands,
    ...adminCommands,
    ...bloxpinCommands,
    ...ticketCommands,
    ...utilityCommands,
    ...gamesCommands,
    ...protectionCommands,
    ...storeCommands,
    ...decorationCommands,
  ];
  for (const cmd of all) {
    collection.set(cmd.data.name, cmd);
  }
  return all;
}
