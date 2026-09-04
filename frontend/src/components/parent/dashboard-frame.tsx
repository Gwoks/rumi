'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Camera, BarChart3, CreditCard, ShoppingBag,
  ChevronLeft, ChevronRight, Bell, ChevronDown, Globe2
} from 'lucide-react';
import { Logo } from '@/components/common/logo';
import { IconButton } from '@/components/ui/icon-button';
import { useAuth } from '@/context/auth-context';

export function ParentDashboardFrame({
  activeTab,
  onTabChange,
  children
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, switchDemoUser } = useAuth();
  const router = useRouter();

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Gallery', icon: Camera },
    { label: 'Assessment', icon: BarChart3 },
    { label: 'Payments', icon: CreditCard },
    { label: 'Shop', icon: ShoppingBag }
  ];

  const handleRoleToggle = async () => {
    await switchDemoUser('admin');
    router.push('/admin');
  };

  return (
    <div className="pt-12 min-h-screen bg-[#FDFBF7] text-[#2D3748]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`hidden border-r border-slate-200 bg-white p-4 transition-all duration-200 lg:flex lg:flex-col justify-between ${
            collapsed ? 'w-24' : 'w-64'
          }`}
        >
          <div>
            <div className="flex items-center justify-between px-2">
              <Logo />
              <IconButton
                label="Collapse sidebar"
                onClick={() => setCollapsed(!collapsed)}
                className="hidden xl:grid h-8 w-8"
              >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </IconButton>
            </div>

            <div className="mt-10 space-y-1">
              {navItems.map(({ label, icon: Icon }) => {
                const isActive = activeTab === label;
                return (
                  <button
                    key={label}
                    onClick={() => onTabChange(label)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition cursor-pointer ${
                      isActive
                        ? 'bg-[#E7F4F0] text-[#2A9D8F]'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && <span>{label}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-2 pt-6 border-t border-slate-100">
            <Link
              href="/"
              className="flex items-center gap-3 text-sm font-semibold text-slate-500 hover:text-[#2A9D8F] transition"
            >
              <Globe2 size={18} className="shrink-0" />
              {!collapsed && <span>View public site</span>}
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-12 z-20 flex h-[76px] items-center justify-between border-b border-slate-200 bg-[#FDFBF7]/90 px-5 backdrop-blur lg:px-8">
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <Logo />
              </div>
              <div className="hidden lg:block">
                <p className="text-xs text-slate-500">Saturday, 20 September 2025</p>
                <h1 className="text-lg font-semibold text-[#2D3748]">
                  Good morning, {user?.name || 'Nadia'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <IconButton label="Notifications">
                <Bell size={19} />
              </IconButton>
              <div className="hidden h-8 w-px bg-slate-200 sm:block" />
              <button
                onClick={handleRoleToggle}
                className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-left shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#FFF7CF] text-xs font-bold text-[#2D3748]">
                  {user?.name?.slice(0, 2).toUpperCase() || 'NR'}
                </div>
                <div className="hidden sm:block">
                  <span className="block text-xs font-semibold text-[#2D3748]">
                    {user?.name || 'Nadia Rahman'}
                  </span>
                  <span className="block text-[10px] text-slate-400">Parent portal</span>
                </div>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
            </div>
          </header>

          <main className="mx-auto max-w-[1440px] p-5 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
