import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/auth-context';
import { AppShell } from '@/components/common/app-shell';

export const metadata: Metadata = {
  title: 'RUMI · Rumah Main Islami',
  description: 'A warm Montessori weekend pop-up for curious children ages 3–6.',
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#FDFBF7',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-[#FDFBF7]">
      <body className="antialiased bg-[#FDFBF7] text-[#2D3748]">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
