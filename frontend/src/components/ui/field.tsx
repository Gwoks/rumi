import React from 'react';
import { cn } from '@/lib/utils';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Field({
  label,
  placeholder,
  className = '',
  type = 'text',
  ...props
}: FieldProps) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span className="block mb-1.5">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-[#2D3748] outline-none transition focus:border-[#2A9D8F] focus:ring-1 focus:ring-[#2A9D8F]',
          className
        )}
        {...props}
      />
    </label>
  );
}
