import type { ReactNode } from 'react';

interface Props {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}

export function Ring({ value, size = 120, stroke = 10, color = 'var(--accent)', children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--track)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
