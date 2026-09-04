'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function CartButton({
  count,
  total,
  onClick
}: {
  count: number;
  total: number;
  onClick: () => void;
}) {
  if (count <= 0) return null;

  return (
    <motion.button
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-4 rounded-2xl bg-[#2D3748] px-5 py-4 text-white shadow-2xl transition hover:bg-[#1a202c] cursor-pointer"
    >
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#FA8C42] text-xs font-bold text-white">
        {count}
      </span>
      <span className="font-semibold text-sm">View bag</span>
      <span className="text-white/70 text-sm font-medium">${total.toFixed(2)}</span>
      <ArrowRight size={17} />
    </motion.button>
  );
}
