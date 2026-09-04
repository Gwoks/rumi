import React from 'react';
import { MapPin, Clock3 } from 'lucide-react';
import { Logo } from '@/components/common/logo';

export function RumiFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-3 lg:px-8">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-6 text-slate-500">
            A weekend room for wonder, faith, and growing independence.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[#2D3748]">Visit RUMI</h3>
          <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600">
            <MapPin className="mt-1 shrink-0 text-[#2A9D8F]" size={16} />
            <span>
              Rumah Teduh Community Space<br />
              Jl. Kemang Raya 12, Jakarta Selatan
            </span>
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <Clock3 className="text-[#2A9D8F]" size={16} />
            <span>Saturday · 9:00–12:00</span>
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[#2D3748]">Talk with us</h3>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Have a question about classes or your child&apos;s first visit?
          </p>
          <a
            href="mailto:hello@rumi.id"
            className="mt-3 inline-block font-semibold text-[#2A9D8F] hover:underline"
          >
            hello@rumi.id
          </a>
          <p className="mt-2 text-sm text-slate-500">+62 812 3456 7890</p>
        </div>
      </div>
      <div className="border-t border-slate-100 px-5 py-5 text-center text-xs text-slate-400">
        © 2025 RUMI · Rumah Main Islami
      </div>
    </footer>
  );
}
