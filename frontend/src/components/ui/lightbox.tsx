'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from './modal';

export interface LightboxItem {
  id?: number;
  photo_url: string;
  caption?: string | null;
}

export function Lightbox({
  items,
  currentIndex,
  onClose,
  onChangeIndex
}: {
  items: LightboxItem[];
  currentIndex: number | null;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}) {
  if (currentIndex === null || !items[currentIndex]) return null;

  const current = items[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeIndex(Math.max(0, currentIndex - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeIndex(Math.min(items.length - 1, currentIndex + 1));
  };

  return (
    <Modal title={current.caption || 'Photo'} onClose={onClose} wide>
      <div className="relative overflow-hidden rounded-2xl bg-slate-900">
        <img
          src={current.photo_url}
          alt={current.caption || 'Child observation photo'}
          className="max-h-[65vh] w-full object-contain"
        />
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-md transition hover:bg-white cursor-pointer"
          >
            <ChevronLeft size={20} className="text-[#2D3748]" />
          </button>
        )}
        {currentIndex < items.length - 1 && (
          <button
            onClick={handleNext}
            aria-label="Next image"
            className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-md transition hover:bg-white cursor-pointer"
          >
            <ChevronRight size={20} className="text-[#2D3748]" />
          </button>
        )}
      </div>
      {current.caption && (
        <p className="mt-4 text-center text-sm font-medium text-slate-600">
          {current.caption}
        </p>
      )}
    </Modal>
  );
}
