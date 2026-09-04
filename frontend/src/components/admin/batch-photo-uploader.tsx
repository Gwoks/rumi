'use client';

import React, { useState } from 'react';
import { UploadCloud, Camera, X } from 'lucide-react';
import { Child } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function BatchPhotoUploader({
  students = [],
  onUploadPhotos
}: {
  students: Child[];
  onUploadPhotos: (childIds: number[], photoUrls: string[], caption: string) => Promise<void>;
}) {
  const [selectedChildIds, setSelectedChildIds] = useState<number[]>(
    students.length > 0 ? [students[0].id] : []
  );
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80'
  ]);
  const [caption, setCaption] = useState('Hands-on exploration in Saturday morning pop-up');
  const [loading, setLoading] = useState(false);

  const toggleChild = (id: number) => {
    if (selectedChildIds.includes(id)) {
      setSelectedChildIds(selectedChildIds.filter((c) => c !== id));
    } else {
      setSelectedChildIds([...selectedChildIds, id]);
    }
  };

  const handleAddSample = () => {
    const samples = [
      'https://images.unsplash.com/photo-1560785496-3c9d27877182?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=900&q=80'
    ];
    const pick = samples[photos.length % samples.length];
    setPhotos([...photos, pick]);
  };

  const handlePublish = async () => {
    if (selectedChildIds.length === 0 || photos.length === 0) return;
    setLoading(true);
    try {
      await onUploadPhotos(selectedChildIds, photos, caption);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-7 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      {/* Upload Box */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-lg text-[#2D3748]">Batch photo uploader</h3>
        <p className="mt-1 text-sm text-slate-500">
          Add authentic session moments directly to children&apos;s private galleries.
        </p>

        <div
          onClick={handleAddSample}
          className="mt-6 grid min-h-56 place-items-center rounded-2xl border-2 border-dashed border-[#2A9D8F]/40 bg-[#E7F4F0]/40 p-6 text-center transition hover:bg-[#E7F4F0]/60 cursor-pointer"
        >
          <div>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#2A9D8F] shadow-sm">
              <UploadCloud />
            </div>
            <p className="mt-4 font-semibold text-[#2D3748]">Drop photos here</p>
            <p className="mt-1 text-sm text-slate-500">Click to add sample session photos</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddSample();
              }}
              className="mt-4 rounded-xl bg-[#2A9D8F] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#238276] cursor-pointer"
            >
              + Add photo
            </button>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="mt-5 space-y-2">
            {photos.map((url, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-[#E7F4F0] p-3 text-sm"
              >
                <span className="flex items-center gap-2 truncate max-w-[280px]">
                  <Camera size={15} className="text-[#2A9D8F] shrink-0" />
                  <span className="truncate text-slate-700">Photo-{i + 1}.jpg</span>
                </span>
                <button
                  onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Child Tagging Box */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-lg text-[#2D3748]">Tag children</h3>
          <p className="mt-1 text-sm text-slate-500">
            Strict RBAC: Only tagged families can see these uploaded photos.
          </p>

          <div className="mt-5 space-y-2 max-h-60 overflow-y-auto pr-1">
            {students.map((s) => {
              const isChecked = selectedChildIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                    isChecked
                      ? 'border-[#2A9D8F] bg-[#E7F4F0]/40'
                      : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleChild(s.id)}
                    className="h-4 w-4 accent-[#2A9D8F] cursor-pointer"
                  />
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E7F4F0] text-xs font-bold text-[#2A9D8F]">
                    {s.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <span className="text-sm font-semibold text-[#2D3748] block">{s.name}</span>
                    <span className="text-[11px] text-slate-400">{s.class_group} group</span>
                  </div>
                </label>
              );
            })}
          </div>

          <label className="mt-5 block text-sm font-semibold text-[#2D3748]">
            Activity caption
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Quiet morning work"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2A9D8F]"
            />
          </label>
        </div>

        <button
          onClick={handlePublish}
          disabled={loading || selectedChildIds.length === 0 || photos.length === 0}
          className="mt-6 w-full rounded-xl bg-[#FA8C42] py-3.5 font-semibold text-white shadow-sm transition hover:bg-[#E77E36] cursor-pointer disabled:opacity-50"
        >
          {loading
            ? 'Publishing...'
            : `Save & publish ${photos.length} photos for ${selectedChildIds.length} child(ren)`}
        </button>
      </div>
    </section>
  );
}
