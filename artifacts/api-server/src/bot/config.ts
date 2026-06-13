export interface GuildConfig {
  respectLevel: number;
  aiChannelId: string | null;
  logChannelId: string | null;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  goodbyeChannelId: string | null;
  goodbyeMessage: string;
  warnings: Map<string, string[]>;
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
    });
  }
  return configs.get(guildId)!;
}

export function setRespectLevel(guildId: string, level: number): void {
  const cfg = getConfig(guildId);
  cfg.respectLevel = Math.min(5, Math.max(1, level));
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
