import type { ChatMessage, DirectMessage } from "@/generated/prisma/client";

/** Normalisierte Nachrichtenform fuer die Chat-UI - identisch fuer Gruppenchat und DMs. */
export type ChatMessageView = {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
  isOwn: boolean;
};

export function toGroupMessageView(
  message: ChatMessage & { author: { name: string } | null },
  currentUserId: string,
  formerMemberLabel: string
): ChatMessageView {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    authorName: message.author?.name ?? formerMemberLabel,
    isOwn: message.authorId === currentUserId,
  };
}

export function toDirectMessageView(
  message: DirectMessage,
  currentUserId: string,
  otherPersonName: string
): ChatMessageView {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    authorName: message.senderId === currentUserId ? "" : otherPersonName,
    isOwn: message.senderId === currentUserId,
  };
}
