'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/',           label: 'Dashboard' },
  { href: '/workflows',  label: 'Workflows' },
];

const AGENT_COLORS: Record<string, string> = {
  orchestrator:     'var(--c-violet)',
  incident:         'var(--c-cobalt)',
  triage:           '#0e7490',
  hospitalmatching: 'var(--c-emerald)',
  dispatch:         'var(--c-amber)',
  contact:          '#be185d',
  guidance:         '#a855f7',
  handover:         '#f97316',
  audit:            '#64748b'
};

const AGENTS = [
  'orchestrator', 'incident', 'triage', 'hospitalmatching',
  'dispatch', 'contact', 'guidance', 'handover', 'audit'
];

export default function SidebarNav() {
  const pathname = usePathname();
  const [agentStates, setAgentStates] = useState<Record<string, 'idle' | 'working'>>({});

  useEffect(() => {
    const es = new EventSource('http://localhost:4000/api/stream/global');
    es.addEventListener('audit_log', e => {
      const d = JSON.parse(e.data);
      const key = AGENTS.find(a => d.agent?.toLowerCase().includes(a));
      if (!key) return;
      setAgentStates(prev => ({ ...prev, [key]: 'working' }));
      setTimeout(() => setAgentStates(prev => ({ ...prev, [key]: 'idle' })), 3000);
    });
    return () => es.close();
  }, []);

  return (
    <aside style={{
      display: 'flex',
      flexDirection: 'column',
      padding: 'var(--sp-8) var(--sp-6)',
      gap: 'var(--sp-8)',
      height: '100vh',
      position: 'sticky',
      top: 0,
      borderRight: '2px solid var(--c-border)',
      background: 'var(--c-surface)',
      overflowY: 'auto',
    }}>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: 'var(--sp-2) var(--sp-3)',
                fontSize: 'var(--t-13)',
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--c-bg)' : 'var(--c-ink)',
                background: active ? 'var(--c-ink)' : 'transparent',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              {active && '→ '}{item.label}
            </Link>
          );
        })}
      </nav>

      {/* Agent status */}
      <div style={{ marginTop: 'auto', borderTop: '2px solid var(--c-border)', paddingTop: 'var(--sp-4)' }}>
        <p className="label" style={{ marginBottom: 'var(--sp-3)' }}>AGENTS</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {AGENTS.map(agent => {
            const state = agentStates[agent] ?? 'idle';
            return (
              <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{
                  width: 7, height: 7,
                  background: state === 'working' ? AGENT_COLORS[agent] : 'var(--c-border-dim)',
                  display: 'inline-block',
                  flexShrink: 0,
                  transition: 'background 0.3s',
                }} />
                <span style={{
                  fontSize: 'var(--t-11)',
                  color: state === 'working' ? AGENT_COLORS[agent] : 'var(--c-ink-muted)',
                  fontWeight: state === 'working' ? 700 : 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'color 0.3s',
                }}>
                  {agent}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
