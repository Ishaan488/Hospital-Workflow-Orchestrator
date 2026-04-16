import type { Metadata } from 'next';
import './globals.css';
import SidebarNav from './components/SidebarNav';

export const metadata: Metadata = {
  title: 'OPS Console',
  description: 'Philips Pre-Hospital Emergency Orchestrator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
