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

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  created: { label: 'Created', badge: 'badge-muted', dot: '#4a7a9b' },
  planning: { label: 'Planning', badge: 'badge-violet', dot: '#a78bfa' },
  in_progress: { label: 'In Progress', badge: 'badge-blue', dot: '#38bdf8' },
  waiting_approval: { label: 'Awaiting Approval', badge: 'badge-amber', dot: '#fbbf24' },
  waiting_patient: { label: 'Waiting Patient', badge: 'badge-amber', dot: '#fbbf24' },
  waiting_external: { label: 'Waiting External', badge: 'badge-muted', dot: '#4a7a9b' },
  completed: { label: 'Completed', badge: 'badge-green', dot: '#34d399' },
  failed: { label: 'Failed', badge: 'badge-red', dot: '#f87171' },
  escalated: { label: 'Escalated', badge: 'badge-red', dot: '#f87171' },
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
    if (res.ok) {
      setWorkflows(prev => prev.filter(w => w.id !== id));
    }
  }

  // Also listen to global SSE to refresh on new workflows
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
        if (filter === 'active') return ['in_progress', 'planning', 'created'].includes(w.status);
        if (filter === 'approval') return w.status === 'waiting_approval';
        if (filter === 'completed') return w.status === 'completed';
        return true;
      });

  const FILTERS = [
    { key: 'all', label: 'All', count: workflows.length },
    { key: 'active', label: 'Active', count: workflows.filter(w => ['in_progress', 'planning', 'created'].includes(w.status)).length },
    { key: 'approval', label: 'Needs Approval', count: workflows.filter(w => w.status === 'waiting_approval').length },
    { key: 'completed', label: 'Completed', count: workflows.filter(w => w.status === 'completed').length },
  ];

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight gradient-text">All Workflows</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} tracked by the AI orchestration engine
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: filter === f.key ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filter === f.key ? 'rgba(56,189,248,0.35)' : 'var(--color-border)'}`,
              color: filter === f.key ? '#7dd3fc' : 'var(--color-text-secondary)',
            }}>
            {f.label}
            <span className="opacity-60">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Workflow list */}
      {loading ? (
        <div className="glass-card p-12 text-center opacity-40">
          <div style={{ fontSize: 32 }}>⏳</div>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Loading workflows...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center opacity-40">
          <div style={{ fontSize: 40 }}>🏥</div>
          <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>No workflows found</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Trigger a scenario from the Dashboard to see live workflows</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(wf => {
            const s = STATUS_CONFIG[wf.status] ?? STATUS_CONFIG.created;
            return (
              <Link key={wf.id} href={`/workflows/${wf.id}`}
                className="glass-card glass-card-hover flex items-center gap-4 p-4 transition-all group">
                
                <div className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    background: s.dot,
                    boxShadow: ['in_progress', 'planning'].includes(wf.status) ? `0 0 8px ${s.dot}` : 'none',
                    animation: ['in_progress'].includes(wf.status) ? 'dot-working 1.2s ease-in-out infinite' : 'none',
                  }} />

                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-1">
                    <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      {wf.id.slice(0, 8)}…
                    </p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                      {wf.type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="hidden md:flex md:col-span-1 items-center">
                    <span className={`badge ${s.badge}`}>{s.label}</span>
                  </div>
                  <div className="hidden md:flex md:col-span-1 items-center">
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {wf.patientId ? `Patient: ${wf.patientId.slice(0, 8)}…` : 'No patient'}
                    </p>
                  </div>
                  <div className="hidden md:flex md:col-span-1 items-center">
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(wf.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-teal-400)' }}>
                    Open →
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, wf.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 text-red-500/70 hover:text-red-500"
                    title="Delete workflow"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
