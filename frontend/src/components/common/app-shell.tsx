'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Sparkles, Menu, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { IconButton } from '@/components/ui/icon-button';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, switchDemoUser } = useAuth();
  const [open, setOpen] = useState(false);

  const handleSwitch = async (target: 'public' | 'parent' | 'admin') => {
    if (target === 'public') {
      router.push('/');
    } else if (target === 'parent') {
      await switchDemoUser('parent');
      router.push('/parent');
    } else if (target === 'admin') {
      await switchDemoUser('admin');
      router.push('/admin');
    }
  };

  const isPublic = pathname === '/' || pathname.startsWith('/(public)') || pathname === '/login';
  const isParent = pathname.startsWith('/parent');
  const isAdmin = pathname.startsWith('/admin');

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-40 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Sparkles size={14} className="text-[#FA8C42]" />
            <span className="hidden sm:inline">RUMI Live System</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-xl bg-[#E7F4F0] p-1 text-xs font-semibold">
              <button
                onClick={() => handleSwitch('public')}
                className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                  isPublic
                    ? 'bg-white text-[#2A9D8F] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Public
              </button>
              <button
                onClick={() => handleSwitch('parent')}
                className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                  isParent
                    ? 'bg-white text-[#2A9D8F] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Parent · Amina
              </button>
              <button
                onClick={() => handleSwitch('admin')}
                className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                  isAdmin
                    ? 'bg-white text-[#2A9D8F] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Admin
              </button>
            </div>

            {user ? (
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">{user.name}</span>
                <button
                  onClick={() => logout()}
                  title="Logout"
                  className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-block text-xs font-semibold text-[#2A9D8F] hover:underline"
              >
                Login
              </Link>
            )}

            <IconButton
              label="Toggle menu"
              onClick={() => setOpen(!open)}
              className="sm:hidden h-8 w-8"
            >
              <Menu size={16} />
            </IconButton>
          </div>
        </div>

        {open && (
          <div className="sm:hidden border-t border-slate-100 pt-2 pb-1 text-xs space-y-1">
            <button
              onClick={() => { setOpen(false); handleSwitch('public'); }}
              className="block w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50"
            >
              Public View
            </button>
            <button
              onClick={() => { setOpen(false); handleSwitch('parent'); }}
              className="block w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50"
            >
              Parent Portal (Amina)
            </button>
            <button
              onClick={() => { setOpen(false); handleSwitch('admin'); }}
              className="block w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50"
            >
              Admin Dashboard
            </button>
          </div>
        )}
      </div>

      <div className="min-h-screen">{children}</div>
    </>
  );
}
