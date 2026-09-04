import React from 'react';
import { cn } from '@/lib/utils';

export function IconButton({
  children,
  label,
  onClick,
  className = '',
  disabled = false,
  type = 'button'
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button
      type={type}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid h-10 w-10 place-items-center rounded-xl transition hover:bg-[#E7F4F0] focus-visible:outline-2 focus-visible:outline-[#2A9D8F] cursor-pointer disabled:opacity-50 disabled:pointer-events-none',
        className
      )}
    >
      {children}
    </button>
  );
}
