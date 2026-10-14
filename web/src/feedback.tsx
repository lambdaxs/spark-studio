import { UnauthorizedError } from "./api";
import type { SavePhase } from "./autosave";

export function failureDetail(err: unknown) {
  if (err instanceof UnauthorizedError) return "";
  return err instanceof Error && err.message ? err.message : "没有打开";
}

export function SaveStatus({
  phase,
  onRetry,
}: {
  phase: SavePhase;
  onRetry: () => void;
}) {
  if (phase === "idle") return null;
  if (phase === "error") {
    return (
      <span className="save-status error">
        保存失败
        <button type="button" onClick={onRetry}>
          重试
        </button>
      </span>
    );
  }
  const label = phase === "saved" ? "已保存" : phase === "saving" ? "保存中" : "编辑中";
  return <span className="save-status">{label}</span>;
}

export function StatusBlock({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="empty-col">
      <p className="empty-title">{title}</p>
      {detail ? <p>{detail}</p> : null}
      {action ? (
        <button type="button" className="text-btn" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
