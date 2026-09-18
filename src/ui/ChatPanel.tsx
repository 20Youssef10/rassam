import { useEffect, useRef, useState } from "react";

import type { Messages } from "../i18n/ar";
import { onChat, type ChatMessage } from "../collab/events";

export function ChatPanel({
  messages,
  locale,
  open,
  onClose,
  selfId,
  selfName,
  onSend,
}: {
  messages: Messages;
  locale: "ar" | "en";
  open: boolean;
  onClose: () => void;
  selfId: string;
  selfName: string;
  onSend: (text: string) => void;
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => onChat((m) => setMsgs((prev) => [...prev, m])), []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 99999 });
  }, [msgs]);

  if (!open) {
    return null;
  }

  return (
    <div className="rassam-chat" dir={messages.dir} role="region" aria-label="chat">
      <div className="rassam-collab-panel-head">
        <strong>{locale === "ar" ? "المحادثة" : "Chat"}</strong>
        <button type="button" onClick={onClose} aria-label="close">
          ✕
        </button>
      </div>
      <div className="rassam-chat-list" ref={listRef}>
        {msgs.map((m, i) => (
          <div key={i} className={m.userId === selfId ? "is-self" : undefined}>
            <strong>{m.name || m.userId.slice(0, 6)}: </strong>
            <span>{m.text}</span>
          </div>
        ))}
        {!msgs.length && (
          <p className="rassam-chat-empty">
            {locale === "ar" ? "لا رسائل بعد" : "No messages yet"}
          </p>
        )}
      </div>
      <form
        className="rassam-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) {
            return;
          }
          onSend(text);
          setMsgs((prev) => [
            ...prev,
            { userId: selfId, name: selfName, text, ts: Date.now() },
          ]);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={locale === "ar" ? "اكتب رسالة…" : "Type a message…"}
        />
        <button type="submit">{locale === "ar" ? "إرسال" : "Send"}</button>
      </form>
    </div>
  );
}
