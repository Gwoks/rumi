'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export function Toast({ message }: { message: string }) {
  if (!message) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#2D3748] px-5 py-3 text-sm font-medium text-white shadow-xl"
    >
      <Check size={16} className="text-[#FAD02C]" />
      <span>{message}</span>
    </motion.div>
  );
}
