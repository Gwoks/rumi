import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[#2A9D8F] text-white hover:bg-[#238276] shadow-sm',
    accent: 'bg-[#FA8C42] text-white hover:bg-[#E77E36] shadow-sm',
    secondary: 'bg-[#E7F4F0] text-[#2A9D8F] hover:bg-[#d6ece6]',
    outline: 'border border-slate-200 bg-white text-[#2D3748] hover:border-[#2A9D8F]',
    ghost: 'hover:bg-slate-100 text-[#2D3748]'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3.5 text-base'
  };

  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}
