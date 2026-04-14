import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hospital Ops Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen flex bg-slate-50`}>
        {/* Minimal Sidebar Navigation */}
        <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed h-full z-10">
          <div className="p-6 border-b border-slate-700">
            <h1 className="text-xl font-semibold text-white tracking-tight">Ops Console</h1>
            <p className="text-xs text-emerald-400 mt-1 uppercase tracking-wider font-semibold">Workflow Engine</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/" className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors">
              Dashboard
            </Link>
            <Link href="/workflows" className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors">
              All Workflows
            </Link>
            <Link href="/approvals" className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors">
              Human Approvals
            </Link>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 ml-64 p-10 max-w-6xl">
          {children}
        </main>
      </body>
    </html>
  );
}
