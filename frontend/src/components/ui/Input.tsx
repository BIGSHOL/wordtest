import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-primary mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2 rounded-md
            border bg-surface text-text-primary
            placeholder:text-text-secondary
            focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
            disabled:bg-background disabled:cursor-not-allowed
            ${error ? 'border-wrong' : 'border-[#E2E8F0]'}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-wrong">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
