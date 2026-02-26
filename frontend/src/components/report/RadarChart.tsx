/**
 * SVG 6-axis hexagonal radar chart for 6 skill areas.
 * Axes: 의미파악력 / 단어연상력 / 발음청취력 / 어휘추론력 / 철자기억력 / 종합응용력
 */
import type { RadarMetrics } from '../../types/report';

interface Props {
  metrics: RadarMetrics;
}

const CX = 150;
const CY = 140;
const R = 100;

type SkillKey = keyof RadarMetrics;

interface AxisDef {
  key: SkillKey;
  label: string;
  angle: number; // degrees from top (12 o'clock), clockwise
}

const AXES: AxisDef[] = [
  { key: 'meaning',       label: '의미파악력', angle: 0 },
  { key: 'association',   label: '단어연상력', angle: 60 },
  { key: 'listening',     label: '발음청취력', angle: 120 },
  { key: 'inference',     label: '어휘추론력', angle: 180 },
  { key: 'spelling',      label: '철자기억력', angle: 240 },
  { key: 'comprehensive', label: '종합응용력', angle: 300 },
];

function toRad(deg: number): number {
  return ((deg - 90) * Math.PI) / 180;
}

function axisXY(angle: number, scale: number): [number, number] {
  const rad = toRad(angle);
  return [CX + R * scale * Math.cos(rad), CY + R * scale * Math.sin(rad)];
}

function gridPath(scale: number): string {
  const pts = AXES.map((a) => {
    const [x, y] = axisXY(a.angle, scale);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts.join(' L')} Z`;
}

function dataPath(metrics: RadarMetrics): string {
  const pts = AXES.map((a) => {
    const val = Math.max(0.05, (metrics[a.key] ?? 0) / 10);
    const [x, y] = axisXY(a.angle, val);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts.join(' L')} Z`;
}

// Label position offsets per axis
function labelPos(angle: number): { x: number; y: number; anchor: string } {
  const [bx, by] = axisXY(angle, 1.18);
  let anchor = 'middle';
  if (angle > 30 && angle < 150) anchor = 'start';
  if (angle > 210 && angle < 330) anchor = 'end';
  return { x: bx, y: by, anchor };
}

export function RadarChart({ metrics }: Props) {
  return (
    <div className="flex-1 border border-[#E8E8E8] rounded-sm p-3 flex flex-col items-center gap-1 bg-[#FAFAFA]">
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
          0%   { stroke-width: 2.5; stroke-opacity: 1; }
          14%  { stroke-width: 3.5; stroke-opacity: 1; }
          28%  { stroke-width: 2.5; stroke-opacity: 1; }
          42%  { stroke-width: 3;   stroke-opacity: 1; }
          56%  { stroke-width: 2.5; stroke-opacity: 1; }
          100% { stroke-width: 2.5; stroke-opacity: 1; }
        }
      `}</style>
      <h3 className="text-[13px] font-bold text-[#0D0D0D] self-start">
        영역별 평가
      </h3>

      <svg viewBox="0 0 300 280" className="w-full max-w-[210px] h-auto">
        {/* Grid layers (outer → inner) */}
        <path d={gridPath(1)} fill="none" stroke="#D0D0D0" strokeWidth={2} />
        <path d={gridPath(0.75)} fill="none" stroke="#DCDCDC" strokeWidth={1.2} />
        <path d={gridPath(0.5)} fill="none" stroke="#E8E8E8" strokeWidth={1.2} />
        <path d={gridPath(0.25)} fill="none" stroke="#F0F0F0" strokeWidth={0.8} />

        {/* Axis lines from center to each vertex */}
        {AXES.map((a) => {
          const [ex, ey] = axisXY(a.angle, 1);
          return (
            <line
              key={a.key}
              x1={CX}
              y1={CY}
              x2={ex}
              y2={ey}
              stroke="#D0D0D0"
              strokeWidth={1}
            />
          );
        })}

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
          strokeWidth={2.5}
          strokeLinejoin="round"
          style={{
            animation: 'radar-stroke-pulse 1.8s ease-in-out infinite',
          }}
        />

        {/* Data points */}
        {AXES.map((a) => {
          const val = Math.max(0.05, (metrics[a.key] ?? 0) / 10);
          const [px, py] = axisXY(a.angle, val);
          return (
            <circle
              key={`dot-${a.key}`}
              cx={px}
              cy={py}
              r={3}
              fill="#CC0000"
              stroke="#FFF"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Labels + scores */}
        {AXES.map((a) => {
          const pos = labelPos(a.angle);
          const score = Math.round(metrics[a.key] ?? 0);
          return (
            <g key={`label-${a.key}`}>
              <text
                x={pos.x}
                y={pos.y - 6}
                fontSize={11}
                fontWeight={600}
                fill="#0D0D0D"
                textAnchor={pos.anchor}
              >
                {a.label}
              </text>
              <text
                x={pos.x}
                y={pos.y + 8}
                fontSize={10}
                fontWeight={600}
                fill="#CC0000"
                textAnchor={pos.anchor}
              >
                {score}/10
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
