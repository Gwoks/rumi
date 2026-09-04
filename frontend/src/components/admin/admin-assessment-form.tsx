'use client';

import React, { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Child } from '@/lib/api';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const DOMAINS = [
  { value: 'practical_life', label: 'Practical Life' },
  { value: 'sensorial', label: 'Sensorial' },
  { value: 'language', label: 'Language' },
  { value: 'math', label: 'Math' },
  { value: 'islamic_studies', label: 'Islamic Studies' }
];

export function AdminAssessmentForm({
  students = [],
  onSaveAssessment
}: {
  students: Child[];
  onSaveAssessment: (data: { child_id: number; domain: string; score: number; notes: string }) => Promise<void>;
}) {
  const [selectedChildId, setSelectedChildId] = useState<number>(students[0]?.id || 1);
  const [domain, setDomain] = useState<string>('practical_life');
  const [score, setScore] = useState<number>(8);
  const [notes, setNotes] = useState<string>('Amina carefully poured water between two glasses and returned each item to its place.');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSaveAssessment({
        child_id: Number(selectedChildId),
        domain,
        score,
        notes
      });
      setNotes('');
    } finally {
      setLoading(false);
    }
  };

  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.class_group})`
  }));

  return (
    <section className="mt-7 grid gap-5 lg:grid-cols-[1fr_.8fr]">
      {/* Assessment Input Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-lg text-[#2D3748]">Weekly assessment</h3>
            <p className="mt-1 text-sm text-slate-500">Log a milestone for the child&apos;s portfolio.</p>
          </div>
          <span className="rounded-full bg-[#E7F4F0] px-3 py-1.5 text-xs font-bold text-[#2A9D8F]">
            Observation Log
          </span>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Select
            label="Student"
            value={selectedChildId}
            options={studentOptions.length > 0 ? studentOptions : [{ value: 1, label: 'Amina Rahman' }]}
            onChange={(val) => setSelectedChildId(Number(val))}
          />
          <Select
            label="Domain"
            value={domain}
            options={DOMAINS}
            onChange={(val) => setDomain(val)}
          />
        </div>

        <div className="mt-7">
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-[#2D3748]">Independence level</span>
            <span className="text-[#2A9D8F] font-bold">{score} / 10</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="mt-5 w-full accent-[#2A9D8F] cursor-pointer"
          />
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>Emerging (1)</span>
            <span>Developing (5)</span>
            <span>Confident (10)</span>
          </div>
        </div>

        <label className="mt-7 block text-sm font-semibold text-[#2D3748]">
          Milestone note
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe the child's concentration, choice of material, and adab..."
            className="mt-2 min-h-32 w-full rounded-xl border border-slate-200 p-3.5 text-sm text-[#2D3748] outline-none transition focus:border-[#2A9D8F]"
          />
        </label>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full sm:w-auto px-6 py-3"
        >
          {loading ? 'Saving...' : 'Save assessment'}
        </Button>
      </div>

      {/* Observation Philosophy Card */}
      <div className="rounded-2xl bg-[#FFF7CF] p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#2D3748] shadow-sm">
            <ClipboardCheck size={20} />
          </div>
          <h3 className="mt-6 text-xl font-semibold text-[#2D3748]">A note on observing</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            The rubric is a conversation starter, not a scorecard. Capture what the child chose, how they approached it, and what might invite them next.
          </p>
        </div>

        <div className="mt-7 rounded-xl bg-white/80 p-4 text-sm font-medium leading-6 shadow-sm">
          &quot;Follow the child, but follow the child as a leader.&quot;
          <br />
          <span className="text-xs font-normal text-slate-500">— Maria Montessori</span>
        </div>
      </div>
    </section>
  );
}
