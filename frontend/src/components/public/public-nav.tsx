'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Menu } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from '@/components/common/logo';
import { IconButton } from '@/components/ui/icon-button';
import { useAuth } from '@/context/auth-context';

export function PublicNav({ onEnroll }: { onEnroll?: () => void }) {
  const [mobile, setMobile] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const handleLoginClick = () => {
    if (user?.role === 'parent') {
      router.push('/parent');
    } else if (user?.role === 'admin') {
      router.push('/admin');
    } else {
      router.push('/login');
    }
  };

  return (
    <header className="border-b border-slate-100 bg-[#FDFBF7]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#who-we-are" className="hover:text-[#2A9D8F] transition">Who we are</a>
          <a href="#philosophy" className="hover:text-[#2A9D8F] transition">Our approach</a>
          <a href="#schedule" className="hover:text-[#2A9D8F] transition">Weekend classes</a>
          <a href="#shop" className="hover:text-[#2A9D8F] transition">Play kits</a>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={handleLoginClick}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-[#2A9D8F] hover:bg-[#E7F4F0] cursor-pointer transition"
          >
            {user ? `${user.name} (Dashboard)` : 'Parent login'}
          </button>
          <button
            onClick={onEnroll}
            className="rounded-xl bg-[#FA8C42] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#E77E36] cursor-pointer"
          >
            Enroll a child <ArrowRight className="ml-1 inline" size={15} />
          </button>
        </div>
        <IconButton label="Open navigation" onClick={() => setMobile(!mobile)} className="md:hidden">
          <Menu size={21} />
        </IconButton>
      </div>

      <AnimatePresence>
        {mobile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-100 px-5 md:hidden"
          >
            <nav className="flex flex-col gap-1 py-4 text-sm font-medium">
              <a onClick={() => setMobile(false)} className="rounded-lg p-3 hover:bg-[#E7F4F0]" href="#who-we-are">Who we are</a>
              <a onClick={() => setMobile(false)} className="rounded-lg p-3 hover:bg-[#E7F4F0]" href="#philosophy">Our approach</a>
              <a onClick={() => setMobile(false)} className="rounded-lg p-3 hover:bg-[#E7F4F0]" href="#schedule">Weekend classes</a>
              <a onClick={() => setMobile(false)} className="rounded-lg p-3 hover:bg-[#E7F4F0]" href="#shop">Play kits</a>
              <button
                onClick={() => { setMobile(false); handleLoginClick(); }}
                className="mt-2 rounded-xl bg-[#E7F4F0] p-3 text-left font-semibold text-[#2A9D8F]"
              >
                {user ? `${user.name} (Dashboard)` : 'Parent login'}
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
