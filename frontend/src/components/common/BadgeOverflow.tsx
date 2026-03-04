/**
 * BadgeOverflow — shows the first `maxVisible` badges inline,
 * then a "+N" chip. Clicking the chip opens a compact dropdown
 * listing all overflow badges. Click-outside closes it.
 */
import { useState, useRef, useEffect } from 'react';

export interface BadgeDef {
  key: string;
  label: string;
  bg: string;
  color: string;
}

interface Props {
  badges: BadgeDef[];
  maxVisible?: number;
}

export function BadgeOverflow({ badges, maxVisible = 2 }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (badges.length === 0) return <span className="text-xs text-text-tertiary">-</span>;

  const visible = badges.slice(0, maxVisible);
  const overflow = badges.slice(maxVisible);

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      {visible.map((b) => (
        <span
          key={b.key}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
          style={{ backgroundColor: b.bg, color: b.color }}
        >
          {b.label}
        </span>
      ))}

      {overflow.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap cursor-pointer select-none transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#F0F0EE', color: '#6D6C6A' }}
          >
            +{overflow.length}
          </button>

          {open && (
            <div
              className="absolute z-50 rounded-lg shadow-lg border flex flex-col gap-1"
              style={{
                top: '100%',
                left: 0,
                marginTop: 6,
                backgroundColor: '#FFFFFF',
                borderColor: '#E8E8E6',
                padding: '8px 10px',
                minWidth: 120,
              }}
            >
              {overflow.map((b) => (
                <span
                  key={b.key}
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap w-fit"
                  style={{ backgroundColor: b.bg, color: b.color }}
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
