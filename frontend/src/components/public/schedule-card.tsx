import React from 'react';
import { MapPin, Clock3, ArrowRight } from 'lucide-react';

export function ScheduleCard({
  date,
  month,
  title,
  location,
  time,
  tag,
  onEnroll
}: {
  date: string;
  month: string;
  title: string;
  location: string;
  time: string;
  tag?: string | null;
  onEnroll: () => void;
}) {
  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-[#2A9D8F]/40 hover:shadow-lg">
      <div className="flex gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#FFF7CF] text-center">
          <strong className="block text-xl leading-none text-[#2D3748]">{date}</strong>
          <span className="text-[9px] font-bold tracking-widest text-[#2D3748]">{month}</span>
        </div>
        <div>
          {tag && (
            <div className="mb-1 inline-flex rounded-full bg-[#E7F4F0] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#2A9D8F]">
              {tag}
            </div>
          )}
          <h3 className="font-semibold text-base text-[#2D3748]">{title}</h3>
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            <MapPin size={13} className="text-[#2A9D8F]" /> {location}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <Clock3 size={13} className="text-[#2A9D8F]" /> {time}
          </p>
        </div>
      </div>
      <button
        onClick={onEnroll}
        className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-[#FA8C42] cursor-pointer group-hover:text-[#E77E36]"
      >
        Reserve a spot{' '}
        <ArrowRight size={16} className="transition transform group-hover:translate-x-1" />
      </button>
    </div>
  );
}
