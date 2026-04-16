'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import GodModePanel from './components/GodModePanel';

interface WorkflowRow {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface LiveEvent {
  agent: string;
  action: string;
  workflowId?: string;
  timestamp: string;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  created:          { label: 'Created',          badge: 'badge-muted' },
  planning:         { label: 'Planning',          badge: 'badge-violet' },
  in_progress:      { label: 'In Progress',       badge: 'badge-blue' },
  waiting_external: { label: 'Waiting External',  badge: 'badge-muted' },
  completed:        { label: 'Completed',         badge: 'badge-green' },
  failed:           { label: 'Failed',            badge: 'badge-red' },
  escalated:        { label: 'Escalated',         badge: 'badge-red' },
};

const AGENT_COLORS: Record<string, string> = {
  orchestrator:     'var(--c-violet)',
  incident:         'var(--c-cobalt)',
  triage:           '#0e7490',
  hospitalmatching: 'var(--c-emerald)',
  dispatch:         'var(--c-amber)',
  contact:          'var(--c-crimson)',
  guidance:         'var(--c-teal)',
  handover:         'var(--c-blue)',
  audit:            'var(--c-slate)',
  a2a:              '#be185d',
  broker:           '#be185d',
};
function agentColor(name: string) {
  const n = name.toLowerCase();
  for (const key of Object.keys(AGENT_COLORS)) {
    if (n.includes(key)) return AGENT_COLORS[key];
  }
  return 'var(--c-ink-muted)';
}

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, total: 0 });
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [triggeredWorkflow, setTriggeredWorkflow] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:4000/api/workflows')
      .then(r => r.json())
      .then(res => {
        const d: WorkflowRow[] = Array.isArray(res) ? res : (res.data || []);
        setWorkflows(d.slice(0, 10));
        setStats({
          total:     d.length,
          active:    d.filter(w => ['in_progress', 'planning', 'created'].includes(w.status)).length,
          completed: d.filter(w => w.status === 'completed').length,
        });
      }).catch(() => {});
  }, []);

  useEffect(() => {
    const es = new EventSource('http://localhost:4000/api/stream/global');
    const push = (ev: LiveEvent) => setLiveEvents(prev => [ev, ...prev].slice(0, 60));
    es.addEventListener('audit_log', e => {
      const d = JSON.parse(e.data);
      push({ agent: d.agent, action: d.action, workflowId: d.workflowId, timestamp: d.timestamp });
    });
    es.addEventListener('a2a_message', e => {
      const d = JSON.parse(e.data);
      push({ agent: 'A2ABroker', action: `${d.from} → ${d.to}`, workflowId: d.workflowId, timestamp: d.timestamp });
    });
    return () => es.close();
  }, []);

  function handleWorkflowTriggered(wfId: string) {
    setTriggeredWorkflow(wfId);
    setTimeout(() => {
      fetch('http://localhost:4000/api/workflows').then(r => r.json()).then(res => {
        const d: WorkflowRow[] = Array.isArray(res) ? res : (res.data || []);
        setWorkflows(d.slice(0, 10));
        setStats({
          total: d.length,
          active: d.filter(w => ['in_progress', 'planning', 'created'].includes(w.status)).length,
          completed: d.filter(w => w.status === 'completed').length,
        });
      }).catch(() => {});
    }, 1500);
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-10)' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-6)' }}>
        <div>
          <p className="label" style={{ marginBottom: 'var(--sp-1)' }}>Live System View</p>
          <h1 style={{ fontSize: 'var(--t-28)', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
            Workflow Dashboard
          </h1>
        </div>
        <GodModePanel onWorkflowTriggered={handleWorkflowTriggered} />
      </div>

      {/* Triggered notification */}
      {triggeredWorkflow && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
          padding: 'var(--sp-3) var(--sp-5)',
          border: '2px solid var(--c-cobalt)',
          background: 'var(--c-cobalt-bg)',
        }}>
          <span className="agent-dot-working" style={{ width: 8, height: 8, display: 'inline-block' }} />
          <span style={{ fontSize: 'var(--t-13)', color: 'var(--c-cobalt)', fontWeight: 600 }}>
            Workflow triggered —{' '}
            <Link href={`/workflows/${triggeredWorkflow}`} style={{ fontWeight: 700, textDecoration: 'underline' }}>
              View live execution
            </Link>
          </span>
        </div>
      )}

      {/* Stats strip — large typography, no cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: '3px solid var(--c-border)', borderLeft: '3px solid var(--c-border)' }}>
        {[
          { v: stats.total,     label: 'Total',     color: 'var(--c-ink)' },
          { v: stats.active,    label: 'Active',    color: 'var(--c-cobalt)' },
          { v: stats.completed, label: 'Completed', color: 'var(--c-emerald)' },
        ].map(({ v, label, color }) => (
          <div key={label} style={{
            padding: 'var(--sp-5) var(--sp-6)',
            borderRight: '3px solid var(--c-border)',
            borderBottom: '3px solid var(--c-border)',
          }}>
            <p className="label" style={{ marginBottom: 'var(--sp-2)' }}>{label}</p>
            <p style={{ fontSize: 'var(--t-64)', fontWeight: 700, color, lineHeight: 1 }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--sp-6)', alignItems: 'start' }}>

        {/* Workflows table */}
        <div className="block">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-5)' }}>
            <p className="section-title">Recent Workflows</p>
            <Link href="/workflows" style={{ fontSize: 'var(--t-12)', color: 'var(--c-cobalt)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              All Records →
            </Link>
          </div>

          {workflows.length === 0 ? (
            <p style={{ color: 'var(--c-ink-muted)', padding: 'var(--sp-10) 0', textAlign: 'center', fontSize: 'var(--t-13)' }}>
              No workflows yet — initialize a workflow simulation
            </p>
          ) : (
            <div>
              <div className="data-row-header">
                <span style={{ flex: 1 }}>Type</span>
                <span style={{ width: 130, flexShrink: 0 }}>Status</span>
                <span style={{ width: 20, flexShrink: 0 }}></span>
              </div>
              {workflows.map(wf => {
                const s = STATUS_CONFIG[wf.status] ?? { label: wf.status, badge: 'badge-muted' };
                return (
                  <Link key={wf.id} href={`/workflows/${wf.id}`}
                    style={{ display: 'flex', alignItems: 'center', padding: 'var(--sp-3) 0', borderBottom: '1px solid var(--c-border-dim)', gap: 'var(--sp-4)', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-muted)', fontFamily: 'inherit' }}>{wf.id.slice(0, 12)}…</p>
                      <p style={{ fontSize: 'var(--t-14)', fontWeight: 600, color: 'var(--c-ink)', marginTop: 2 }}>
                        {wf.type.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className={`badge ${s.badge}`} style={{ width: 130, flexShrink: 0, display: 'inline-block', textAlign: 'center' }}>{s.label}</span>
                    <span style={{ color: 'var(--c-cobalt)', fontSize: 'var(--t-14)', width: 20, flexShrink: 0, textAlign: 'right' }}>→</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Live feed */}
        <div className="block" style={{ height: 460, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)', flexShrink: 0 }}>
            <span className="agent-dot-working" style={{ width: 8, height: 8, display: 'inline-block' }} />
            <p className="section-title">Live Agent Activity</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {liveEvents.length === 0 && (
              <p style={{ color: 'var(--c-ink-muted)', padding: 'var(--sp-6) 0', textAlign: 'center' }}>Listening for events…</p>
            )}
            {liveEvents.map((ev, i) => (
              <div key={i} className="feed-entry" style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
                <span style={{ width: 6, height: 6, flexShrink: 0, marginTop: 5, background: agentColor(ev.agent), display: 'inline-block' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 'var(--t-10)', fontWeight: 700, color: agentColor(ev.agent), textTransform: 'uppercase' }}>
                    {ev.agent.replace('Agent', '')}
                  </span>
                  <p style={{ fontSize: 'var(--t-12)', color: 'var(--c-ink-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.action}
                  </p>
                </div>
                {ev.workflowId && (
                  <Link href={`/workflows/${ev.workflowId}`} style={{ fontSize: 'var(--t-10)', color: 'var(--c-cobalt)', flexShrink: 0 }}>→</Link>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
