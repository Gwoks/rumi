'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Mail, Sparkles, UserCheck, Shield } from 'lucide-react';
import { Logo } from '@/components/common/logo';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [roleMode, setRoleMode] = useState<'parent' | 'admin'>('parent');
  const [email, setEmail] = useState('nadia@example.com');
  const [password, setPassword] = useState('parent123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleTab = (mode: 'parent' | 'admin') => {
    setRoleMode(mode);
    setError('');
    if (mode === 'parent') {
      setEmail('nadia@example.com');
      setPassword('parent123');
    } else {
      setEmail('admin@rumi.id');
      setPassword('admin123');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/parent');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-[#FDFBF7] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-block mb-4">
          <Logo />
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-[#2D3748]">
          Welcome to RUMI
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Sign in to access your child&apos;s journey or manage school operations.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8 shadow-xl">
          {/* Role selector tab */}
          <div className="mb-6 flex rounded-xl bg-[#E7F4F0] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleRoleTab('parent')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 transition cursor-pointer ${
                roleMode === 'parent'
                  ? 'bg-white text-[#2A9D8F] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck size={14} /> Parent Portal
            </button>
            <button
              type="button"
              onClick={() => handleRoleTab('admin')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 transition cursor-pointer ${
                roleMode === 'admin'
                  ? 'bg-white text-[#2A9D8F] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield size={14} /> Admin Team
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Field
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 text-base"
              >
                {loading ? 'Authenticating...' : `Sign in as ${roleMode === 'parent' ? 'Parent' : 'Admin'}`}{' '}
                <ArrowRight size={16} className="ml-1.5 inline" />
              </Button>
            </div>
          </form>

          {/* Quick 1-click test fill helper */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-2">
              Quick Test Credentials
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleRoleTab('parent')}
                className="rounded-lg border border-slate-200 p-2 text-left hover:border-[#2A9D8F] transition"
              >
                <div className="font-semibold text-[#2D3748]">Parent (Amina)</div>
                <div className="text-slate-400 text-[10px]">nadia@example.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleRoleTab('admin')}
                className="rounded-lg border border-slate-200 p-2 text-left hover:border-[#2A9D8F] transition"
              >
                <div className="font-semibold text-[#2D3748]">Admin Team</div>
                <div className="text-slate-400 text-[10px]">admin@rumi.id</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
