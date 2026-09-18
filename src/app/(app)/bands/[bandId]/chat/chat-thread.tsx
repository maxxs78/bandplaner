"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useFormatter } from "next-intl";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, FieldError } from "@/components/ui/input";
import type { ChatMessageView } from "@/lib/chat";

type FormState = { error?: string } | undefined;

const POLL_INTERVAL_MS = 4000;

/**
 * Gemeinsame Nachrichtenliste + Composer fuer Gruppenchat und Direktnachrichten.
 * Live-Updates per Polling statt SSE/WebSocket, da die App aktuell keinerlei
 * Realtime-Infrastruktur hat (siehe Plan) - haelt einen Cursor auf der letzten
 * bekannten createdAt und dedupliziert per Nachrichten-Id.
 */
export function ChatThread({
  pollUrl,
  initialMessages,
  sendAction,
  placeholder,
  emptyLabel,
}: {
  pollUrl: string;
  initialMessages: ChatMessageView[];
  sendAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
  placeholder: string;
  emptyLabel: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const cursorRef = useRef(initialMessages.at(-1)?.createdAt ?? null);
  const seenIds = useRef(new Set(initialMessages.map((m) => m.id)));
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const format = useFormatter();

  const poll = useCallback(async () => {
    const url = cursorRef.current
      ? `${pollUrl}?after=${encodeURIComponent(cursorRef.current)}`
      : pollUrl;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data: { messages: ChatMessageView[] } = await res.json();
      if (data.messages.length === 0) return;
      const fresh = data.messages.filter((m) => !seenIds.current.has(m.id));
      cursorRef.current = data.messages[data.messages.length - 1].createdAt;
      if (fresh.length === 0) return;
      fresh.forEach((m) => seenIds.current.add(m.id));
      setMessages((prev) => [...prev, ...fresh]);
    } catch {
      // naechster Tick versucht es erneut
    }
  }, [pollUrl]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) poll();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const [state, formAction, pending] = useActionState(sendAction, undefined);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
      poll();
    }
    wasPending.current = pending;
  }, [pending, state, poll]);

  return (
    <div className="flex h-[60vh] flex-col rounded-xl border border-border bg-surface">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted">{emptyLabel}</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.isOwn ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.isOwn
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[80%] rounded-2xl rounded-bl-sm bg-surface-muted px-3 py-2 text-sm text-foreground"
              }
            >
              {!m.isOwn && m.authorName && (
                <p className="mb-0.5 text-xs font-medium text-muted">{m.authorName}</p>
              )}
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              <p
                className={
                  m.isOwn
                    ? "mt-1 text-right text-[10px] text-primary-foreground/70"
                    : "mt-1 text-right text-[10px] text-muted"
                }
              >
                {format.dateTime(new Date(m.createdAt), { timeStyle: "short", dateStyle: "short" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form ref={formRef} action={formAction} className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            name="content"
            rows={1}
            maxLength={2000}
            placeholder={placeholder}
            className="flex-1 resize-none"
            required
          />
          <Button type="submit" size="sm" disabled={pending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <FieldError>{state?.error}</FieldError>
      </form>
    </div>
  );
}
