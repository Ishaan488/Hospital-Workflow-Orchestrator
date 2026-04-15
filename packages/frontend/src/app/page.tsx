'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import GodModePanel from './components/GodModePanel';

interface WorkflowRow {
  id: string;
  type: string;
  status: string;
  patientId?: string;
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
  created: { label: 'Created', badge: 'badge-muted' },
  planning: { label: 'Planning', badge: 'badge-violet' },
  in_progress: { label: 'In Progress', badge: 'badge-blue' },
  waiting_approval: { label: 'Awaiting Approval', badge: 'badge-amber' },
  waiting_patient: { label: 'Waiting Patient', badge: 'badge-amber' },
  waiting_external: { label: 'Waiting External', badge: 'badge-muted' },
  completed: { label: 'Completed', badge: 'badge-green' },
  failed: { label: 'Failed', badge: 'badge-red' },
  escalated: { label: 'Escalated', badge: 'badge-red' },
};

function StatCard({ value, label, delta, color }: { value: string | number; label: string; delta?: string; color: string }) {
  return (
    <div className="glass-card p-5 flex flex-col gap-2" style={{ borderColor: `${color}20` }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      <div className="flex items-end gap-2">
        <span style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
        {delta && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{delta}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [stats, setStats] = useState({ active: 0, pending: 0, completed: 0, total: 0 });
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [triggeredWorkflow, setTriggeredWorkflow] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('http://localhost:4000/api/workflows')
      .then(r => r.json())
      .then(res => {
        const dataList: WorkflowRow[] = Array.isArray(res) ? res : (res.data || []);
        setWorkflows(dataList.slice(0, 10));
        setStats({
          total: dataList.length,
          active: dataList.filter(w => ['in_progress', 'planning', 'created'].includes(w.status)).length,
          pending: dataList.filter(w => w.status === 'waiting_approval').length,
          completed: dataList.filter(w => w.status === 'completed').length,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const es = new EventSource('http://localhost:4000/api/stream/global');
    es.addEventListener('audit_log', e => {
      const d = JSON.parse(e.data);
      const entry: LiveEvent = { agent: d.agent, action: d.action, workflowId: d.workflowId, timestamp: d.timestamp };
      setLiveEvents(prev => {
        const next = [entry, ...prev].slice(0, 50);
        return next;
      });
    });
    es.addEventListener('a2a_message', e => {
      const d = JSON.parse(e.data);
      setLiveEvents(prev => [
        { agent: 'A2ABroker', action: `${d.from} → ${d.to}`, workflowId: d.workflowId, timestamp: d.timestamp },
        ...prev
      ].slice(0, 50));
    });
    return () => es.close();
  }, []);

  function handleWorkflowTriggered(wfId: string, name: string) {
    setTriggeredWorkflow(wfId);
    setTimeout(() => {
      fetch('http://localhost:4000/api/workflows').then(r => r.json()).then(res => {
        const dataList: WorkflowRow[] = Array.isArray(res) ? res : (res.data || []);
        setWorkflows(dataList.slice(0, 10));
      }).catch(() => {});
    }, 1500);
  }

  const agentColor = (a: string) => {
    const n = a.toLowerCase();
    if (n.includes('orchestrator')) return '#a78bfa';
    if (n.includes('intake')) return '#38bdf8';
    if (n.includes('insurance')) return '#22d3ee';
    if (n.includes('scheduling')) return '#34d399';
    if (n.includes('communication') || n.includes('commun')) return '#fbbf24';
    if (n.includes('broker') || n.includes('a2a')) return '#f472b6';
    return '#7fa8c9';
  };

  return (
    <div className="page-enter space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight gradient-text">System Dashboard</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Real-time view of all A2A orchestrated hospital workflows
          </p>
        </div>
        <GodModePanel onWorkflowTriggered={handleWorkflowTriggered} />
      </div>

      {triggeredWorkflow && (
        <div className="p-4 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <span className="w-2 h-2 rounded-full agent-dot-working" />
          <span className="text-sm" style={{ color: '#6ee7b7' }}>
            Workflow triggered →{' '}
            <Link href={`/workflows/${triggeredWorkflow}`} className="font-bold underline">
              View live execution
            </Link>
          </span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard value={stats.total} label="Total Workflows" color="#7fa8c9" />
        <StatCard value={stats.active} label="Active Now" color="#38bdf8" delta="in progress" />
        <StatCard value={stats.pending} label="Awaiting Approval" color="#fbbf24" />
        <StatCard value={stats.completed} label="Completed" color="#34d399" delta="auto-resolved" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Workflows table — 3/5 */}
        <div className="xl:col-span-3 glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Recent Workflows</h3>
            <Link href="/workflows" className="text-xs font-medium" style={{ color: 'var(--color-teal-400)' }}>View all →</Link>
          </div>

          {workflows.length === 0 ? (
            <div className="text-center py-16 opacity-40">
              <p style={{ fontSize: 32 }}>🏥</p>
              <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>No workflows yet — trigger a demo scenario</p>
            </div>
          ) : (
            <div className="divide-y">
              {workflows.map(wf => {
                const s = STATUS_CONFIG[wf.status] ?? { label: wf.status, badge: 'badge-muted' };
                return (
                  <Link key={wf.id} href={`/workflows/${wf.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors group"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: wf.status === 'in_progress' ? 'var(--color-teal-400)' : wf.status === 'completed' ? 'var(--color-emerald-400)' : wf.status === 'waiting_approval' ? 'var(--color-amber-400)' : 'var(--color-text-muted)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono truncate" style={{ color: 'var(--color-text-muted)' }}>{wf.id.slice(0, 20)}…</p>
                      <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                        {wf.type.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className={`badge ${s.badge} shrink-0`}>{s.label}</span>
                    <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-teal-400)' }}>→</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Live global feed — 2/5 */}
        <div className="xl:col-span-2 glass-card flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
            <span className="w-2 h-2 rounded-full agent-dot-working" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Live Agent Activity</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {liveEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 opacity-40">
                <span style={{ fontSize: 28 }}>📡</span>
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Listening for events...</p>
              </div>
            )}
            {liveEvents.map((ev, i) => (
              <div key={i} className="feed-entry flex items-start gap-2 px-2 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: agentColor(ev.agent) }} />
                <div className="flex-1 min-w-0">
                  <span style={{ fontSize: 10, fontWeight: 700, color: agentColor(ev.agent) }}>
                    {ev.agent.replace('Agent', '')}
                  </span>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)', marginTop: 1 }}>{ev.action}</p>
                </div>
                {ev.workflowId && (
                  <Link href={`/workflows/${ev.workflowId}`}
                    className="text-[9px] shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--color-teal-400)' }}>→</Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
