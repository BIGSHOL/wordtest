/**
 * SVG 4-axis diamond radar chart for 어휘수준/정답률/속도/어휘사이즈.
 * Matches Pencil design node l1GZZ / jbNe3.
 */
import type { RadarMetrics } from '../../types/report';

interface Props {
  metrics: RadarMetrics;
}

// Chart geometry (center at 130,120, matching Pencil design 260x240)
const CX = 130;
const CY = 120;
const R = 90; // max radius from center to axis endpoint

// Axis endpoints (top, right, bottom, left)
const AXES = [
  { dx: 0, dy: -R, label: '어휘수준', key: 'vocabulary_level' as const },
  { dx: R, dy: 0, label: '정확도', key: 'accuracy' as const },
  { dx: 0, dy: R, label: '속도', key: 'speed' as const },
  { dx: -R, dy: 0, label: '어휘 범위', key: 'vocabulary_size' as const },
];

function gridPath(scale: number): string {
  const pts = AXES.map((a) => `${CX + a.dx * scale},${CY + a.dy * scale}`);
  return `M${pts[0]} L${pts[1]} L${pts[2]} L${pts[3]} Z`;
}

function dataPath(metrics: RadarMetrics): string {
  const values = AXES.map((a) => Math.max(0.05, metrics[a.key] / 10));
  const pts = AXES.map(
    (a, i) => `${CX + a.dx * values[i]},${CY + a.dy * values[i]}`,
  );
  return `M${pts[0]} L${pts[1]} L${pts[2]} L${pts[3]} Z`;
}

// Label positions (offset from axis endpoints)
const LABEL_POS = [
  { x: CX - 18, y: 10 },   // top
  { x: CX + R + 4, y: CY - 6 }, // right
  { x: CX - 10, y: CY + R + 14 }, // bottom
  { x: 0, y: CY - 6 },     // left
];

const VAL_POS = [
  { x: CX - 8, y: 22 },
  { x: CX + R + 4, y: CY + 6 },
  { x: CX - 8, y: CY + R + 26 },
  { x: 14, y: CY + 6 },
];

export function RadarChart({ metrics }: Props) {
  return (
    <div className="flex-1 border border-[#E8E8E8] rounded-sm p-5 flex flex-col items-center gap-3 bg-[#FAFAFA]">
      <style>{`
        @keyframes radar-heartbeat {
          0%   { transform: scale(1);    opacity: 0.15; }
          14%  { transform: scale(1.06); opacity: 0.25; }
          28%  { transform: scale(1);    opacity: 0.15; }
          42%  { transform: scale(1.04); opacity: 0.22; }
          56%  { transform: scale(1);    opacity: 0.15; }
          100% { transform: scale(1);    opacity: 0.15; }
        }
        @keyframes radar-stroke-pulse {
          0%   { stroke-width: 3;   stroke-opacity: 1; }
          14%  { stroke-width: 4;   stroke-opacity: 1; }
          28%  { stroke-width: 3;   stroke-opacity: 1; }
          42%  { stroke-width: 3.5; stroke-opacity: 1; }
          56%  { stroke-width: 3;   stroke-opacity: 1; }
          100% { stroke-width: 3;   stroke-opacity: 1; }
        }
      `}</style>
      <h3 className="text-lg font-bold text-[#0D0D0D] self-start">
        영역별 평가
      </h3>

      <svg viewBox="0 0 260 240" className="w-[260px] h-[240px]">
        {/* Grid layers (outer → inner) - thick lines for visibility */}
        <path d={gridPath(1)} fill="none" stroke="#D0D0D0" strokeWidth={2.5} />
        <path d={gridPath(0.75)} fill="none" stroke="#DCDCDC" strokeWidth={1.5} />
        <path d={gridPath(0.5)} fill="none" stroke="#E8E8E8" strokeWidth={1.5} />
        <path d={gridPath(0.25)} fill="none" stroke="#F0F0F0" strokeWidth={1} />

        {/* Axes */}
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="#D0D0D0" strokeWidth={1.5} />
        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="#D0D0D0" strokeWidth={1.5} />

        {/* Data shape - fill (heartbeat pulse) */}
        <path
          d={dataPath(metrics)}
          fill="#CC0000"
          stroke="none"
          strokeLinejoin="round"
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            animation: 'radar-heartbeat 1.8s ease-in-out infinite',
          }}
        />

        {/* Data shape - stroke (synced pulse) */}
        <path
          d={dataPath(metrics)}
          fill="none"
          stroke="#CC0000"
          strokeWidth={3}
          strokeLinejoin="round"
          style={{
            animation: 'radar-stroke-pulse 1.8s ease-in-out infinite',
          }}
        />

        {/* Labels + values */}
        {AXES.map((axis, i) => (
          <g key={axis.key}>
            <text
              x={LABEL_POS[i].x}
              y={LABEL_POS[i].y}
              fontSize={12}
              fontWeight={600}
              fill="#0D0D0D"
            >
              {axis.label}
            </text>
            <text
              x={VAL_POS[i].x}
              y={VAL_POS[i].y}
              fontSize={11}
              fontWeight={600}
              fill="#CC0000"
            >
              {Math.round(metrics[axis.key])}/10
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
