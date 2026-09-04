import React from 'react';
import { CalendarDays, Heart, Sparkles, MapPin, ArrowRight } from 'lucide-react';
import { StatCard } from '@/components/common/stat-card';
import { Photo } from '@/lib/api';

export function ParentOverview({
  childName,
  photos = [],
  onTabChange,
  onOpenPhoto
}: {
  childName: string;
  photos?: Photo[];
  onTabChange: (tab: string) => void;
  onOpenPhoto?: (index: number) => void;
}) {
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5">
        {/* Weekly Note Hero */}
        <div className="rounded-2xl bg-[#2A9D8F] p-6 text-white sm:p-8 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/70">This week&apos;s note</p>
              <h3 className="mt-2 max-w-lg text-2xl font-semibold leading-tight">
                &quot;{childName} chose the pouring work three times today — her concentration is blooming.&quot;
              </h3>
              <p className="mt-5 text-sm text-white/70">— Ustazah Mariam · Saturday, 20 Sep</p>
            </div>
            <div className="hidden h-14 w-14 place-items-center rounded-full bg-white/15 sm:grid">
              <Sparkles size={24} />
            </div>
          </div>
          <button
            onClick={() => onTabChange('Assessment')}
            className="mt-7 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#2A9D8F] transition hover:bg-slate-50 cursor-pointer"
          >
            See her progress <ArrowRight className="ml-1 inline" size={15} />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Attendance"
            value="96%"
            change="+4% this term"
            icon={<CalendarDays size={18} />}
          />
          <StatCard
            label="Days at RUMI"
            value="12"
            change="3 classes this month"
            icon={<Heart size={18} />}
            accent="#FFF1E6"
          />
          <StatCard
            label="Current focus"
            value="5"
            change="domains growing"
            icon={<Sparkles size={18} />}
            accent="#FFF7CF"
          />
        </div>
      </div>

      {/* Next Class Alert Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#2D3748]">Next class</h3>
          <span className="rounded-full bg-[#FFF1E6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#D86D29]">
            Reserved
          </span>
        </div>
        <div className="mt-6 flex gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#FFF7CF] text-center">
            <b className="text-xl leading-none text-[#2D3748]">27</b>
            <span className="text-[9px] font-bold tracking-widest text-[#2D3748]">SEP</span>
          </div>
          <div>
            <h4 className="font-semibold text-[#2D3748]">Little Gardeners</h4>
            <p className="mt-1 text-sm text-slate-500">Saturday · 9:30 AM</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
              <MapPin size={14} className="text-[#2A9D8F]" /> The Hive, PJ
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-xl bg-[#E7F4F0] p-4 text-sm text-slate-600">
          Please bring a water bottle and something comfortable for messy work.
        </div>
        <button
          onClick={() => onTabChange('Payments')}
          className="mt-4 text-sm font-semibold text-[#2A9D8F] hover:underline cursor-pointer"
        >
          View receipt <ArrowRight className="ml-1 inline" size={14} />
        </button>
      </div>

      {/* Gallery Strip */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#2D3748]">{childName}&apos;s latest gallery</h3>
            <p className="mt-1 text-sm text-slate-500">Moments from her last three sessions</p>
          </div>
          <button
            onClick={() => onTabChange('Gallery')}
            className="text-sm font-semibold text-[#2A9D8F] hover:underline cursor-pointer"
          >
            View all <ArrowRight className="ml-1 inline" size={14} />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {photos.slice(0, 6).map((photo, i) => (
            <button
              key={photo.id || i}
              onClick={() => onOpenPhoto ? onOpenPhoto(i) : onTabChange('Gallery')}
              className="aspect-square overflow-hidden rounded-xl bg-slate-100 cursor-pointer group"
            >
              <img
                src={photo.photo_url}
                alt={photo.caption || 'Child activity'}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
