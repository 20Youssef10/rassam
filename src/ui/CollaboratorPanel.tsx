import { useEffect, useState } from "react";

import type { Messages } from "../i18n/ar";
import type { CollabUser } from "../collab/events";
import { onCollabUsers, onFollow as onFollowEvent, onPresence } from "../collab/events";

export function CollaboratorPanel({
  messages,
  locale,
  selfId,
  selfName,
  followingId,
  onRename,
  onFollow,
}: {
  messages: Messages;
  locale: "ar" | "en";
  selfId: string;
  selfName: string;
  followingId: string | null;
  onRename: () => void;
  onFollow: (id: string | null) => void;
}) {
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [followedBy, setFollowedBy] = useState<string[]>([]);

  useEffect(() => {
    const offUsers = onCollabUsers((u) => {
      setUsers(u.map((x) => (typeof x === "string" ? { id: x } : x)));
    });
    const offPres = onPresence((p) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === p.userId ? { ...u, status: p.status, name: p.name || u.name } : u,
        ),
      );
    });
    const offFollow = onFollowEvent((f) => {
      if (!selfId) {
        return;
      }
      setFollowedBy((prev) => {
        const next = prev.filter((id) => id !== f.userId);
        if (f.targetId === selfId) {
          next.push(f.userId);
        }
        return next;
      });
    });
    return () => {
      offUsers();
      offPres();
      offFollow();
    };
  }, [selfId]);

  if (!users.length && !selfId) {
    return null;
  }

  const remote = users.filter((u) => u.id !== selfId);

  return (
    <div className="rassam-collab-panel" dir={messages.dir}>
      <div className="rassam-collab-panel-head">
        <strong>{messages.collab.users}</strong>
        <button type="button" onClick={onRename} title={messages.collab.rename}>
          {messages.collab.rename}
        </button>
      </div>
      <ul>
        <li>
          <span className="rassam-user-name">
            {selfName || messages.collab.you} ({messages.collab.you})
          </span>
          {followedBy.length > 0 && (
            <span className="rassam-follow-badge">
              {locale === "ar" ? "يتابعك" : "Following you"} · {followedBy.length}
            </span>
          )}
        </li>
        {remote.map((u) => (
          <li key={u.id}>
            <span className="rassam-user-name">{u.name || u.id.slice(0, 8)}</span>
            <span className="rassam-user-status">
              {u.status === "idle"
                ? locale === "ar"
                  ? "خامل"
                  : "Idle"
                : locale === "ar"
                  ? "نشط"
                  : "Active"}
            </span>
            <button
              type="button"
              onClick={() => onFollow(followingId === u.id ? null : u.id)}
              className={followingId === u.id ? "is-active" : undefined}
            >
              {followingId === u.id
                ? locale === "ar"
                  ? "إيقاف المتابعة"
                  : "Unfollow"
                : locale === "ar"
                  ? "متابعة"
                  : "Follow"}
            </button>
          </li>
        ))}
      </ul>
      {followingId && (
        <p className="rassam-following-hint">
          {locale === "ar" ? "تتبع عرض الزميل…" : "Following collaborator viewport…"}
        </p>
      )}
    </div>
  );
}
