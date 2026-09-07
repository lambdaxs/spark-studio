import { useEffect, useState } from "react";
import type { CanvasSpec } from "./api";

function Figure({ kind, step, total }: { kind: string; step: number; total: number }) {
  const t = total <= 1 ? 1 : step / (total - 1);
  if (kind === "spectrum") {
    const bars = [0.35, 0.9, 0.55, 0.25, 0.7, 0.4];
    return (
      <svg viewBox="0 0 320 120" className="canvas-fig">
        {bars.map((h, i) => (
          <rect
            key={i}
            x={24 + i * 48}
            y={108 - h * 90 * (0.3 + 0.7 * t)}
            width="28"
            height={h * 90 * (0.3 + 0.7 * t)}
            fill={i === 1 ? "#2563eb" : "#a8a29e"}
            opacity={0.4 + 0.6 * t}
          />
        ))}
      </svg>
    );
  }
  if (kind === "tree") {
    return (
      <svg viewBox="0 0 320 120" className="canvas-fig">
        <line x1="160" y1="28" x2="80" y2="88" stroke="#e6e2da" />
        <line x1="160" y1="28" x2="240" y2="88" stroke="#e6e2da" />
        <circle cx="160" cy="28" r="12" fill="#eff6ff" stroke="#2563eb" />
        <circle cx="80" cy="88" r="12" fill="#fff" stroke="#e6e2da" />
        <circle cx="240" cy="88" r="12" fill="#fff" stroke="#e6e2da" />
      </svg>
    );
  }
  if (kind === "transform") {
    return (
      <svg viewBox="0 0 320 120" className="canvas-fig">
        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          opacity={1 - t * 0.6}
          points={Array.from({ length: 40 }, (_, i) => {
            const x = 10 + i * 4;
            const y = 60 + Math.sin(i * 0.45) * 28;
            return `${x},${y}`;
          }).join(" ")}
        />
        {[0.35, 0.9, 0.55, 0.25].map((h, i) => (
          <rect
            key={i}
            x={200 + i * 28}
            y={108 - h * 80 * t}
            width="18"
            height={h * 80 * t}
            fill="#2563eb"
            opacity={t}
          />
        ))}
      </svg>
    );
  }
  if (kind === "none") return null;
  const pts = Array.from({ length: 48 }, (_, i) => {
    const x = 8 + i * 6.4;
    const y = 60 + Math.sin(i * 0.35 + step) * 32;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 320 120" className="canvas-fig">
      <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={pts} />
    </svg>
  );
}

export function LessonCanvas({ spec }: { spec: CanvasSpec }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
  }, [spec.title, spec.steps.length]);
  const current = spec.steps[step];
  if (!current) return null;
  return (
    <div className="canvas-player">
      <div className="canvas-stage">
        <Figure kind={current.figure ?? "none"} step={step} total={spec.steps.length} />
      </div>
      <div className="canvas-copy">
        <strong>{current.title}</strong>
        <p>{current.body}</p>
      </div>
      <div className="canvas-nav">
        <button type="button" className="chip" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          上一步
        </button>
        <span>
          {step + 1} / {spec.steps.length}
        </span>
        <button
          type="button"
          className="chip"
          disabled={step === spec.steps.length - 1}
          onClick={() => setStep((s) => s + 1)}
        >
          下一步
        </button>
      </div>
    </div>
  );
}
