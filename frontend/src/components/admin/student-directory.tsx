'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Child } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

export function StudentDirectory({
  students = [],
  onSelectStudent
}: {
  students: Child[];
  onSelectStudent?: (student: Child) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeModalStudent, setActiveModalStudent] = useState<Child | null>(null);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.parent_name && s.parent_name.toLowerCase().includes(query.toLowerCase())) ||
      s.class_group.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold text-lg text-[#2D3748]">Student directory</h3>
          <p className="mt-1 text-sm text-slate-500">
            {students.length} children across active groups.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students or parents"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#2A9D8F] sm:w-64"
          />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="pb-3 font-semibold">Student</th>
              <th className="pb-3 font-semibold">Group</th>
              <th className="pb-3 font-semibold">Parent</th>
              <th className="pb-3 font-semibold">Status</th>
              <th className="pb-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No students found matching your search.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const initials = s.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                const colors = ['#E7F4F0', '#FFF1E6', '#FFF7CF'];
                const color = colors[s.id % colors.length];

                return (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-9 w-9 place-items-center rounded-xl text-xs font-bold text-[#2D3748]"
                          style={{ background: color }}
                        >
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-[#2D3748]">{s.name}</p>
                          <p className="text-xs text-slate-500">Born {s.date_of_birth}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-slate-600 font-medium">{s.class_group}</td>
                    <td className="py-4 text-slate-600">{s.parent_name || 'Registered Parent'}</td>
                    <td className="py-4 font-semibold text-[#2A9D8F]">Enrolled</td>
                    <td className="py-4 text-right">
                      <button
                        onClick={() => {
                          setActiveModalStudent(s);
                          onSelectStudent?.(s);
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#2A9D8F] hover:bg-[#E7F4F0] transition cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {activeModalStudent && (
        <Modal
          title={activeModalStudent.name}
          onClose={() => setActiveModalStudent(null)}
        >
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl text-xl font-bold bg-[#E7F4F0] text-[#2A9D8F]">
              {activeModalStudent.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-lg text-[#2D3748]">
                {activeModalStudent.class_group} group
              </p>
              <p className="text-sm text-slate-500">
                Parent: {activeModalStudent.parent_name || 'Parent'} ({activeModalStudent.parent_email || 'Verified'})
              </p>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#E7F4F0] p-4">
              <p className="text-xs text-slate-500 font-medium">Attendance</p>
              <p className="mt-1 text-xl font-semibold text-[#2A9D8F]">96%</p>
            </div>
            <div className="rounded-xl bg-[#FFF7CF] p-4">
              <p className="text-xs text-slate-500 font-medium">Class Group</p>
              <p className="mt-1 text-sm font-semibold text-[#2D3748]">{activeModalStudent.class_group}</p>
            </div>
          </div>

          <Button
            onClick={() => setActiveModalStudent(null)}
            className="mt-6 w-full py-3"
          >
            Close Profile
          </Button>
        </Modal>
      )}
    </section>
  );
}
