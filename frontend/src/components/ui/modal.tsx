'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './icon-button';
import { cn } from '@/lib/utils';

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = ''
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#2D3748]/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className={cn(
          'max-h-[92vh] w-full overflow-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]',
          wide ? 'max-w-3xl' : 'max-w-lg',
          className
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#2D3748]">{title}</h2>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
