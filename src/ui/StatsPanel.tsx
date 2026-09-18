import type { Messages } from "../i18n/ar";
import type { SceneStats } from "../core/stats";

export function StatsPanel({
  messages,
  locale,
  stats,
  open,
  onClose,
}: {
  messages: Messages;
  locale: "ar" | "en";
  stats: SceneStats;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <div className="rassam-stats" dir={messages.dir} role="region" aria-label="stats">
      <div className="rassam-collab-panel-head">
        <strong>{locale === "ar" ? "إحصاءات" : "Stats"}</strong>
        <button type="button" onClick={onClose} aria-label="close">
          ✕
        </button>
      </div>
      <dl>
        <div>
          <dt>{messages.status.elements}</dt>
          <dd>{stats.count}</dd>
        </div>
        <div>
          <dt>{messages.status.selected}</dt>
          <dd>{stats.selected}</dd>
        </div>
        <div>
          <dt>{locale === "ar" ? "التكبير" : "Zoom"}</dt>
          <dd>{Math.round(stats.zoom * 100)}%</dd>
        </div>
        {stats.bounds && (
          <div>
            <dt>{locale === "ar" ? "الحدود" : "Bounds"}</dt>
            <dd>
              {Math.round(stats.bounds.width)}×{Math.round(stats.bounds.height)} @{" "}
              {Math.round(stats.bounds.x)},{Math.round(stats.bounds.y)}
            </dd>
          </div>
        )}
        <div>
          <dt>{locale === "ar" ? "الأنواع" : "Types"}</dt>
          <dd className="rassam-stats-types">
            {Object.entries(stats.byType)
              .map(([k, v]) => `${k}:${v}`)
              .join(" · ")}
          </dd>
        </div>
      </dl>
    </div>
  );
}
