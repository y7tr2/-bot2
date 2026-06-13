import type { Message, PartialMessage } from "discord.js";
import { snipedMessages } from "../commands/utility";

export function onMessageDelete(message: Message | PartialMessage): void {
  if (message.author?.bot) return;
  if (!message.content && message.attachments.size === 0) return;
  snipedMessages.set(message.channelId, {
    content: message.content ?? "",
    author: message.author?.tag ?? "غير معروف",
    avatar: message.author?.displayAvatarURL({ size: 64 }) ?? "",
    time: Date.now(),
  });
}
