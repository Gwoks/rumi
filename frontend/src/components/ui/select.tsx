import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Select({
  label,
  value,
  options,
  onChange,
  className = ''
}: {
  label?: string;
  value: string | number;
  options: { value: string | number; label: string }[] | string[];
  onChange: (val: string) => void;
  className?: string;
}) {
  return (
    <label className={cn('block text-sm font-medium text-slate-600', className)}>
      {label && <span className="block mb-2 font-medium">{label}</span>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-3 pr-8 text-sm text-[#2D3748] outline-none focus:border-[#2A9D8F] cursor-pointer"
        >
          {options.map((opt) => {
            const optValue = typeof opt === 'string' ? opt : opt.value;
            const optLabel = typeof opt === 'string' ? opt : opt.label;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-3.5 text-slate-400"
          size={16}
        />
      </div>
    </label>
  );
}
