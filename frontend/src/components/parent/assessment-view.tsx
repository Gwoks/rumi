'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Assessment } from '@/lib/api';

const DOMAIN_METADATA: Record<string, { label: string; color: string; note: string }> = {
  practical_life: {
    label: 'Practical Life',
    color: '#2A9D8F',
    note: 'Growing independence through everyday work.'
  },
  sensorial: {
    label: 'Sensorial',
    color: '#FA8C42',
    note: 'Refining the senses through beautiful materials.'
  },
  language: {
    label: 'Language',
    color: '#FAD02C',
    note: 'Finding confidence in stories and new sounds.'
  },
  math: {
    label: 'Math',
    color: '#2A9D8F',
    note: 'Building number sense, one bead at a time.'
  },
  islamic_studies: {
    label: 'Islamic Studies',
    color: '#FA8C42',
    note: 'Growing a heart rooted in wonder and adab.'
  }
};

export function AssessmentView({
  assessments = [],
  childName
}: {
  assessments: Assessment[];
  childName: string;
}) {
  // Aggregate latest assessment scores for each domain
  const domainScores = Object.entries(DOMAIN_METADATA).map(([key, meta]) => {
    const matching = assessments.filter(a => a.domain === key);
    const score = matching.length > 0 ? matching[0].score * 10 : 70; // 1-10 mapped to percentage
    const latestNote = matching.length > 0 && matching[0].notes ? matching[0].notes : meta.note;
    return {
      key,
      label: meta.label,
      value: score,
      color: meta.color,
      note: latestNote
    };
  });

  const recentMilestones = assessments.slice(0, 3).map(a => ({
    note: a.notes || `Observed engagement in ${DOMAIN_METADATA[a.domain]?.label || a.domain}`,
    domain: DOMAIN_METADATA[a.domain]?.label || a.domain,
    date: a.date
  }));

  const fallbackMilestones = [
    { note: 'Poured water independently', domain: 'Practical Life', date: 'This month' },
    { note: 'Recognized Arabic letter ب', domain: 'Islamic Studies', date: 'This month' },
    { note: 'Counted objects to 10', domain: 'Math', date: 'This month' }
  ];

  const displayMilestones = recentMilestones.length > 0 ? recentMilestones : fallbackMilestones;

  return (
    <section className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
      {/* Learning Map */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg text-[#2D3748]">Her learning map</h3>
            <p className="mt-1 text-sm text-slate-500">
              A gentle snapshot of {childName}&apos;s current interests and growth.
            </p>
          </div>
          <span className="rounded-full bg-[#E7F4F0] px-3 py-1.5 text-xs font-bold text-[#2A9D8F]">
            Term 2 · 2025
          </span>
        </div>

        <div className="mt-8 space-y-6">
          {domainScores.map((d) => (
            <div key={d.key}>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-semibold text-[#2D3748]">{d.label}</span>
                <span className="text-slate-500 font-medium">{d.value}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${d.value}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: d.color }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">{d.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones and Philosophy */}
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-lg text-[#2D3748]">Recent milestones</h3>
          <div className="mt-6 space-y-5">
            {displayMilestones.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#E7F4F0] text-[#2A9D8F]">
                  <Check size={15} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#2D3748]">{m.note}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {m.domain} · {m.date}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl bg-[#E7F4F0] p-4 text-sm leading-6 text-slate-600">
            Progress is not a race. We watch for the moments that show us where to offer the next beautiful challenge.
          </div>
        </div>
      </div>
    </section>
  );
}
