export interface TicketData {
  userId: string;
  number: number;
  claimedBy: string | null;
  createdAt: number;
}

export interface GiveawayData {
  channelId: string;
  guildId: string;
  messageId: string;
  prize: string;
  endTime: number;
  winnersCount: number;
  participants: Set<string>;
  ended: boolean;
}

export interface GuildConfig {
  respectLevel: number;
  aiChannelId: string | null;
  logChannelId: string | null;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  goodbyeChannelId: string | null;
  goodbyeMessage: string;
  warnings: Map<string, string[]>;
  // Ticket
  supportRoleId: string | null;
  ticketCategoryId: string | null;
  ticketLogChannelId: string | null;
  ticketCount: number;
  openTickets: Map<string, TicketData>;
  // Utility
  autoRoleId: string | null;
  suggestChannelId: string | null;
  afkUsers: Map<string, string>;
  giveaways: Map<string, GiveawayData>;
}

const configs = new Map<string, GuildConfig>();

export function getConfig(guildId: string): GuildConfig {
  if (!configs.has(guildId)) {
    configs.set(guildId, {
      respectLevel: 3,
      aiChannelId: null,
      logChannelId: null,
      welcomeChannelId: null,
      welcomeMessage: "مرحباً {user} في {server}! 🎉",
      goodbyeChannelId: null,
      goodbyeMessage: "وداعاً {user}، نتمنى لك التوفيق. 👋",
      warnings: new Map(),
      supportRoleId: null,
      ticketCategoryId: null,
      ticketLogChannelId: null,
      ticketCount: 0,
      openTickets: new Map(),
      autoRoleId: null,
      suggestChannelId: null,
      afkUsers: new Map(),
      giveaways: new Map(),
    });
  }
  return configs.get(guildId)!;
}

export function setRespectLevel(guildId: string, level: number): void {
  getConfig(guildId).respectLevel = Math.min(5, Math.max(1, level));
}
export function setAiChannel(guildId: string, channelId: string | null): void {
  getConfig(guildId).aiChannelId = channelId;
}
export function setLogChannel(guildId: string, channelId: string | null): void {
  getConfig(guildId).logChannelId = channelId;
}
export function addWarning(guildId: string, userId: string, reason: string): number {
  const cfg = getConfig(guildId);
  const warns = cfg.warnings.get(userId) ?? [];
  warns.push(reason);
  cfg.warnings.set(userId, warns);
  return warns.length;
}
export function getWarnings(guildId: string, userId: string): string[] {
  return getConfig(guildId).warnings.get(userId) ?? [];
}
export function clearWarnings(guildId: string, userId: string): void {
  getConfig(guildId).warnings.delete(userId);
}
