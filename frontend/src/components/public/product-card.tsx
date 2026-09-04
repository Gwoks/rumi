import React from 'react';
import { PlayKit } from '@/lib/api';

export function ProductCard({
  product,
  onClick,
  onAdd
}: {
  product: PlayKit;
  onClick: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <button onClick={onClick} className="block w-full text-left cursor-pointer">
        <div
          className="grid h-44 place-items-center"
          style={{ background: product.color || '#E7F4F0' }}
        >
          <span className="text-6xl text-[#2D3748]/60 transition transform duration-300 group-hover:scale-110">
            {product.icon || '✦'}
          </span>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold text-[#2A9D8F]">{product.category}</p>
          <h3 className="mt-1 font-semibold text-[#2D3748] truncate">{product.title}</h3>
          <p className="mt-2 font-semibold text-slate-800">${product.price.toFixed(2)}</p>
        </div>
      </button>
      <div className="px-4 pb-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="w-full rounded-xl bg-[#E7F4F0] py-2.5 text-sm font-semibold text-[#2A9D8F] transition hover:bg-[#d6ece6] cursor-pointer"
        >
          Quick add
        </button>
      </div>
    </div>
  );
}
