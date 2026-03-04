import type { ReactNode } from 'react';

/** Render text with \n as line breaks */
export function renderLines(text: string): ReactNode {
  const parts = text.split('\n');
  if (parts.length === 1) return text;
  return parts.map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line}
    </span>
  ));
}

/** Render stem text: replace [opt1 / opt2 / ...] with ___, render \n as <br>, render ___ as underline */
export function renderStem(text: string): ReactNode {
  // Replace [opt1 / opt2 / opt3] bracket notation with ___
  const cleaned = text.replace(/\[([^\]]+\/[^\]]+)\]/g, '___');

  // Split on \n first, then handle ___ within each line
  const lines = cleaned.split('\n');

  return lines.map((line, lineIdx) => (
    <span key={lineIdx}>
      {lineIdx > 0 && <br />}
      {line.split('___').map((part, j, arr) => (
        <span key={j}>
          {part}
          {j < arr.length - 1 && (
            <span className="inline-block w-20 border-b-2 border-accent-indigo mx-1" />
          )}
        </span>
      ))}
    </span>
  ));
}

/** Strip "POINT X" or "POINT X·Y" metadata from the end of prompt text */
export function cleanPrompt(prompt: string): string {
  return prompt.replace(/\s*POINT\s*[\d·]+\s*$/i, '').trim();
}
