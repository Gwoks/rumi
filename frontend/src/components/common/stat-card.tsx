import React from 'react';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  change,
  icon,
  accent = '#E7F4F0',
  className = ''
}: {
  label: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#2D3748]">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl text-[#2D3748]" style={{ background: accent }}>
          {icon}
        </div>
      </div>
      {change && <p className="mt-4 text-xs font-semibold text-[#2A9D8F]">{change}</p>}
    </div>
  );
}
