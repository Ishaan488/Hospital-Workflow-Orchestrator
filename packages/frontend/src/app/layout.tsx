import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import './globals.css';
import SidebarNav from './components/SidebarNav';

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'OPS Console',
  description: 'Hospital Workflow Orchestration — Ops Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geistMono.variable}>
      <body className={geistMono.className}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          minHeight: '100vh',
        }}>
          <SidebarNav />
          <main style={{
            borderLeft: '2px solid var(--c-border)',
            padding: 'var(--sp-10) var(--sp-12)',
            minWidth: 0,
            overflowX: 'hidden',
          }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
