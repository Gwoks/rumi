import React from 'react';
import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 group">
      <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#2A9D8F] text-lg font-bold text-white shadow-sm transition group-hover:bg-[#238276]">
        R
      </div>
      <div>
        <div className="font-semibold tracking-[0.18em] text-[#2D3748]">RUMI</div>
        <div className="-mt-0.5 text-[10px] tracking-[0.12em] text-slate-500">
          RUMAH MAIN ISLAMI
        </div>
      </div>
    </Link>
  );
}
