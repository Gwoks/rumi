import React from 'react';
import { Camera } from 'lucide-react';
import { Photo } from '@/lib/api';

export function GalleryView({
  photos = [],
  childName,
  onOpenLightbox
}: {
  photos: Photo[];
  childName: string;
  onOpenLightbox: (index: number) => void;
}) {
  return (
    <section className="mt-7">
      {/* Banner */}
      <div className="rounded-2xl bg-[#FFF7CF] p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#2D3748] shadow-sm">
            <Camera size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-[#2D3748]">A window into her world</h3>
            <p className="mt-0.5 text-sm text-slate-600">
              Private photos from {childName}&apos;s RUMI sessions. Only verified family members can view.
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="mt-12 text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-white p-8">
          <Camera className="mx-auto text-slate-300 mb-3" size={36} />
          <h4 className="font-semibold text-slate-700">No photos yet</h4>
          <p className="text-sm text-slate-500 mt-1">Photos will appear after the upcoming weekend session.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <button
              key={p.id || i}
              onClick={() => onOpenLightbox(i)}
              className="group overflow-hidden rounded-2xl bg-white text-left shadow-sm transition hover:shadow-md cursor-pointer border border-slate-100"
            >
              <div className="aspect-square overflow-hidden bg-slate-100">
                <img
                  src={p.photo_url}
                  alt={p.caption || 'Session photo'}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-3 text-sm font-medium text-[#2D3748] truncate">
                {p.caption || 'Observation snapshot'}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
