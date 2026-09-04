import React from 'react';
import { Users, BarChart3, Truck, ChevronDown } from 'lucide-react';
import { StatCard } from '@/components/common/stat-card';
import { AdminMetrics } from '@/lib/api';

export function AdminOperations({
  metrics,
  onTabChange
}: {
  metrics: AdminMetrics | null;
  onTabChange: (tab: string) => void;
}) {
  const enrolled = metrics?.totalEnrolled || 42;
  const revenue = metrics?.weeklyRevenue ? `$${metrics.weeklyRevenue.toLocaleString()}` : '$2,480';
  const pendingOrders = metrics?.ordersToShip !== undefined ? String(metrics.ordersToShip).padStart(2, '0') : '08';
  const bars = metrics?.revenueRhythm || [42, 58, 45, 76, 65, 88, 72, 94];
  const months = ['M', 'J', 'J', 'A', 'A', 'S', 'S', 'O'];
  const todaySchedule = metrics?.todayRhythm || [
    { time: '09:00', title: 'Doors open', sub: 'all groups' },
    { time: '09:30', title: 'Saffron session', sub: '12 children' },
    { time: '11:45', title: 'Parent pick-up', sub: 'Saffron group' },
    { time: '14:00', title: 'Cedar session', sub: '8 children' }
  ];

  return (
    <div className="mt-7">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total enrolled"
          value={enrolled}
          change="+8% from last term"
          icon={<Users size={18} />}
        />
        <StatCard
          label="Weekly revenue"
          value={revenue}
          change="+12.4% this week"
          icon={<BarChart3 size={18} />}
          accent="#FFF7CF"
        />
        <StatCard
          label="Orders to ship"
          value={pendingOrders}
          change="Needs attention"
          icon={<Truck size={18} />}
          accent="#FFF1E6"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        {/* Revenue Rhythm */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-lg text-[#2D3748]">Revenue rhythm</h3>
              <p className="mt-1 text-sm text-slate-500">Last 8 weekend sessions</p>
            </div>
            <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
              This term <ChevronDown size={14} />
            </button>
          </div>

          <div className="mt-8 flex h-48 items-end gap-3 border-b border-slate-100 px-2 pb-2">
            {bars.map((height, i) => (
              <div key={i} className="group flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full max-w-10 rounded-t-lg bg-[#E7F4F0] transition group-hover:bg-[#2A9D8F]"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-slate-400 font-medium">
                  {months[i % months.length]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Rhythm */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-lg text-[#2D3748]">Today&apos;s rhythm</h3>
            <div className="mt-6 space-y-5">
              {todaySchedule.map((item) => (
                <div key={item.time} className="flex gap-3">
                  <span className="w-12 pt-0.5 text-xs font-semibold text-[#2A9D8F]">
                    {item.time}
                  </span>
                  <div className="border-l-2 border-[#E7F4F0] pl-3">
                    <p className="text-sm font-semibold text-[#2D3748]">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onTabChange('Students')}
            className="mt-7 w-full rounded-xl bg-[#E7F4F0] py-3 text-sm font-semibold text-[#2A9D8F] transition hover:bg-[#d6ece6] cursor-pointer"
          >
            Open student directory
          </button>
        </div>
      </div>
    </div>
  );
}
