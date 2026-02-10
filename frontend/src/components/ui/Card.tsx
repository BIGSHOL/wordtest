import { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`
        bg-surface rounded-lg border border-[#E2E8F0]
        shadow-sm p-4
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
