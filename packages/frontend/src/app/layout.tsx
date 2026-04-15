import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SidebarNav from './components/SidebarNav';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'MedOrchestra — AI Hospital Workflow Platform',
  description: 'Real-time multi-agent AI orchestration for hospital administrative workflows',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex" style={{ background: 'var(--color-bg-primary)' }}>
        <SidebarNav />
        <main className="flex-1 ml-64 min-h-screen overflow-x-hidden">
          <div className="p-8 max-w-[1400px]">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
