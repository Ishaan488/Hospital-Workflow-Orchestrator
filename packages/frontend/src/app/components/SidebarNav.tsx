'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: <IconDashboard /> },
  { href: '/workflows', label: 'Workflows', icon: <IconWorkflow /> },
  { href: '/approvals', label: 'Approvals', icon: <IconApproval /> },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const [agentStatus, setAgentStatus] = useState<'online' | 'offline'>('offline');
  const [sseConnected, setSseConnected] = useState(false);

  useEffect(() => {
    // Poll health endpoint to show system status
    const check = () => {
      fetch('http://localhost:4000/health')
        .then(r => r.json())
        .then(() => setAgentStatus('online'))
        .catch(() => setAgentStatus('offline'));
    };
    check();
    const interval = setInterval(check, 10000);

    // Global SSE heartbeat indicator
    try {
      const es = new EventSource('http://localhost:4000/api/stream/global');
      es.addEventListener('connected', () => setSseConnected(true));
      es.onerror = () => setSseConnected(false);
      return () => { clearInterval(interval); es.close(); };
    } catch {
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <aside className="w-64 fixed top-0 left-0 h-full flex flex-col z-20"
      style={{
        background: 'linear-gradient(180deg, #060f20 0%, #07121f 100%)',
        borderRight: '1px solid var(--color-border)',
      }}>

      {/* Branding */}
      <div className="p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center gradient-brand shrink-0 shadow-lg" style={{ boxShadow: '0 0 16px rgba(14,165,233,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7V12C2 16.55 6.55 20.74 12 22C17.45 20.74 22 16.55 22 12V7L12 2Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>MedOrchestra</h1>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-teal-500)' }}>AI Workflow Engine</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        <p className="text-[9px] uppercase font-bold tracking-widest px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>Navigation</p>
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={`nav-link ${isActive ? 'active' : ''}`}>
              <span className="shrink-0" style={{ opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
              {item.label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-teal-400)' }} />
              )}
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="text-[9px] uppercase font-bold tracking-widest px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>Agents</p>
          {['Orchestrator', 'Intake', 'Insurance', 'Scheduling', 'Communication'].map(name => (
            <div key={name} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${agentStatus === 'online' ? 'agent-dot-working' : 'agent-dot-idle'}`} />
              {name} Agent
            </div>
          ))}
        </div>
      </nav>

      {/* Footer system status */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="glass-card p-3 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Backend</span>
            <span className={`badge ${agentStatus === 'online' ? 'badge-green' : 'badge-red'}`}>
              {agentStatus}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Live Stream</span>
            <span className={`badge ${sseConnected ? 'badge-blue' : 'badge-muted'}`}>
              {sseConnected ? 'connected' : 'waiting'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function IconDashboard() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function IconWorkflow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}
function IconApproval() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
