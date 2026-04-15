'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WorkflowRow {
  id: string;
  type: string;
  status: string;
  patientId?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  created:          { label: 'Created',          badge: 'badge-muted' },
  planning:         { label: 'Planning',          badge: 'badge-violet' },
  in_progress:      { label: 'In Progress',       badge: 'badge-blue' },
  waiting_approval: { label: 'Awaiting Approval', badge: 'badge-amber' },
  waiting_patient:  { label: 'Waiting Patient',   badge: 'badge-amber' },
  waiting_external: { label: 'Waiting External',  badge: 'badge-muted' },
  completed:        { label: 'Completed',         badge: 'badge-green' },
  failed:           { label: 'Failed',            badge: 'badge-red' },
  escalated:        { label: 'Escalated',         badge: 'badge-red' },
};

const STATUS_DOTS: Record<string, string> = {
  in_progress:      'var(--c-cobalt)',
  planning:         'var(--c-violet)',
  waiting_approval: 'var(--c-amber)',
  completed:        'var(--c-emerald)',
  failed:           'var(--c-crimson)',
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:4000/api/workflows')
      .then(r => r.json())
      .then(res => {
        const dataList = Array.isArray(res) ? res : (res.data || []);
        setWorkflows(dataList);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`http://localhost:4000/api/workflows/${id}`, { method: 'DELETE' });
    if (res.ok) setWorkflows(prev => prev.filter(w => w.id !== id));
  }

  useEffect(() => {
    const es = new EventSource('http://localhost:4000/api/stream/global');
    es.addEventListener('workflow_state_change', () => {
      fetch('http://localhost:4000/api/workflows').then(r => r.json()).then(res => {
        const dataList = Array.isArray(res) ? res : (res.data || []);
        setWorkflows(dataList);
      }).catch(() => {});
    });
    return () => es.close();
  }, []);

  const filtered = filter === 'all' ? workflows
    : workflows.filter(w => {
        if (filter === 'active')    return ['in_progress', 'planning', 'created'].includes(w.status);
        if (filter === 'approval')  return w.status === 'waiting_approval';
        if (filter === 'completed') return w.status === 'completed';
        return true;
      });

  const FILTERS = [
    { key: 'all',       label: 'All',            count: workflows.length },
    { key: 'active',    label: 'Active',          count: workflows.filter(w => ['in_progress', 'planning', 'created'].includes(w.status)).length },
    { key: 'approval',  label: 'Needs Approval',  count: workflows.filter(w => w.status === 'waiting_approval').length },
    { key: 'completed', label: 'Completed',        count: workflows.filter(w => w.status === 'completed').length },
  ];

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--sp-4)' }}>
        <div>
          <p className="label" style={{ marginBottom: 'var(--sp-1)' }}>Orchestration Engine</p>
          <h1 style={{ fontSize: 'var(--t-28)', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
            All Workflows
          </h1>
        </div>
        <span style={{ fontSize: 'var(--t-14)', color: 'var(--c-ink-muted)', paddingBottom: 4 }}>
          {workflows.length} total
        </span>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--c-border)' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              fontFamily: 'inherit',
              fontSize: 'var(--t-12)',
              fontWeight: filter === f.key ? 700 : 400,
              padding: 'var(--sp-2) var(--sp-5)',
              border: 'none',
              borderBottom: filter === f.key ? '3px solid var(--c-ink)' : '3px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              color: filter === f.key ? 'var(--c-ink)' : 'var(--c-ink-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: -2,
              display: 'flex',
              gap: 'var(--sp-2)',
            }}
          >
            {f.label}
            <span style={{ opacity: 0.5 }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Workflow list */}
      {loading ? (
        <p style={{ color: 'var(--c-ink-muted)', textAlign: 'center', padding: 'var(--sp-12) 0' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="block" style={{ textAlign: 'center', padding: 'var(--sp-16) 0' }}>
          <p style={{ fontSize: 'var(--t-16)', fontWeight: 700, color: 'var(--c-ink-muted)' }}>No workflows found</p>
          <p style={{ fontSize: 'var(--t-12)', color: 'var(--c-ink-muted)', marginTop: 'var(--sp-2)' }}>
            Trigger a scenario from the Dashboard
          </p>
        </div>
      ) : (
        <div className="block" style={{ padding: 0 }}>
          <div className="data-row-header" style={{ padding: 'var(--sp-3) var(--sp-5)' }}>
            <span style={{ width: 12 }}></span>
            <span style={{ flex: 1 }}>Type / ID</span>
            <span style={{ width: 150 }}>Status</span>
            <span style={{ width: 140 }}>Patient</span>
            <span style={{ width: 140 }}>Updated</span>
            <span style={{ width: 60 }}></span>
          </div>
          {filtered.map(wf => {
            const s = STATUS_CONFIG[wf.status] ?? { label: wf.status, badge: 'badge-muted' };
            const dotColor = STATUS_DOTS[wf.status] ?? 'var(--c-border-dim)';
            const isActive = ['in_progress', 'planning'].includes(wf.status);
            return (
              <Link
                key={wf.id}
                href={`/workflows/${wf.id}`}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 'var(--sp-4)',
                  padding: 'var(--sp-3) var(--sp-5)',
                  borderBottom: '1px solid var(--c-border-dim)',
                  textDecoration: 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{
                  width: 8, height: 8, flexShrink: 0,
                  background: dotColor, display: 'inline-block',
                  ...(isActive ? { animation: 'pulse-dot 1.2s infinite' } : {}),
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-muted)', fontFamily: 'inherit' }}>
                    {wf.id.slice(0, 10)}…
                  </p>
                  <p style={{ fontSize: 'var(--t-14)', fontWeight: 600, color: 'var(--c-ink)', marginTop: 2 }}>
                    {wf.type.replace(/_/g, ' ')}
                  </p>
                </div>
                <span className={`badge ${s.badge}`} style={{ width: 150, flexShrink: 0 }}>{s.label}</span>
                <p style={{ width: 140, fontSize: 'var(--t-12)', color: 'var(--c-ink-muted)', flexShrink: 0 }}>
                  {wf.patientId ? `${wf.patientId.slice(0, 8)}…` : '—'}
                </p>
                <p style={{ width: 140, fontSize: 'var(--t-12)', color: 'var(--c-ink-muted)', flexShrink: 0 }}>
                  {new Date(wf.updatedAt).toLocaleString()}
                </p>
                <div style={{ width: 60, display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)', flexShrink: 0 }}>
                  <span style={{ color: 'var(--c-cobalt)', fontSize: 'var(--t-14)' }}>→</span>
                  <button
                    onClick={e => handleDelete(e, wf.id)}
                    title="Delete"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--c-crimson)', fontSize: 'var(--t-14)',
                      padding: '0 var(--sp-1)', fontFamily: 'inherit',
                    }}
                  >✕</button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
