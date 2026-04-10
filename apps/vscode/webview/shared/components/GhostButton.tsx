import type { ComponentChildren } from 'preact';

export interface GhostButtonProps {
  children: ComponentChildren;
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function GhostButton({ children, onClick, className, ariaLabel, disabled }: GhostButtonProps) {
  return (
    <button
      class={`hunt-ghost-button${className ? ` ${className}` : ''}`}
      onClick={onClick}
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
