'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import LiveAuditFeed from '../../components/LiveAuditFeed';
import ReasoningDrawer from '../../components/ReasoningDrawer';

const AgentSwarmGraph = dynamic(() => import('../../components/AgentSwarmGraph'), { ssr: false });

const STATUS_CONFIG: Record<string, { label: string; badge: string; accent: string }> = {
  created:          { label: 'Created',          badge: 'badge-muted',   accent: 'var(--c-ink-muted)' },
  planning:         { label: 'Planning',          badge: 'badge-violet',  accent: 'var(--c-violet)' },
  in_progress:      { label: 'In Progress',       badge: 'badge-blue',    accent: 'var(--c-cobalt)' },
  waiting_external: { label: 'Waiting External',  badge: 'badge-muted',   accent: 'var(--c-ink-muted)' },
  completed:        { label: 'Completed',         badge: 'badge-green',   accent: 'var(--c-emerald)' },
  failed:           { label: 'Failed',            badge: 'badge-red',     accent: 'var(--c-crimson)' },
  escalated:        { label: 'Escalated',         badge: 'badge-red',     accent: 'var(--c-crimson)' },
};

export default function WorkflowDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [workflow, setWorkflow] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reasoningEvents, setReasoningEvents] = useState<any[]>([]);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [selectedReasoning, setSelectedReasoning] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`http://localhost:4000/api/workflows/${id}`)
      .then(r => r.json())
      .then(d => {
        setWorkflow(d.data);
        if (d.data?.auditTrail) {
          setAuditLogs(d.data.auditTrail);
        }
      })
      .catch(() => {});
  }, [id]);

  function handleReasoningEvent(event: any) {
    setReasoningEvents(prev => [...prev, { ...event, timestamp: event.timestamp ?? new Date().toISOString() }]);
  }

  async function handleStop() {
    const res = await fetch(`http://localhost:4000/api/workflows/${id}/stop`, { method: 'POST' });
    if (res.ok) setWorkflow((prev: any) => ({ ...prev, status: 'failed' }));
  }

  async function handleDelete() {
    const res = await fetch(`http://localhost:4000/api/workflows/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/workflows');
  }

  if (!workflow) {
    return <p style={{ color: 'var(--c-ink-muted)', padding: 'var(--sp-20) 0', textAlign: 'center' }}>Loading…</p>;
  }

  const s = STATUS_CONFIG[workflow.status] ?? STATUS_CONFIG.created;

  return (
    <>
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)' }}>

        {/* Breadcrumb */}
        <nav style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', fontSize: 'var(--t-12)', color: 'var(--c-ink-muted)' }}>
          <Link href="/" style={{ color: 'var(--c-ink-2)' }}>Dashboard</Link>
          <span>/</span>
          <Link href="/workflows" style={{ color: 'var(--c-ink-2)' }}>Workflows</Link>
          <span>/</span>
          <span style={{ fontFamily: 'inherit', color: 'var(--c-ink)' }}>{id.slice(0, 16)}…</span>
        </nav>

        {/* Status Banner */}
        {workflow.status === 'completed' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--sp-5)',
            padding: 'var(--sp-5) var(--sp-6)',
            border: '3px solid var(--c-emerald)',
            background: 'var(--c-emerald-bg)',
          }}>
            <span style={{ fontSize: 28 }}>✓</span>
            <div>
              <p style={{ fontSize: 'var(--t-16)', fontWeight: 700, color: 'var(--c-emerald)' }}>Workflow Completed</p>
              <p style={{ fontSize: 'var(--t-12)', color: 'var(--c-ink-2)', marginTop: 2 }}>
                All goals met.
              </p>
            </div>
          </div>
        )}
        {workflow.status === 'failed' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--sp-5)',
            padding: 'var(--sp-5) var(--sp-6)',
            border: '3px solid var(--c-crimson)',
            background: 'var(--c-crimson-bg)',
          }}>
            <span style={{ fontSize: 28 }}>✕</span>
            <div>
              <p style={{ fontSize: 'var(--t-16)', fontWeight: 700, color: 'var(--c-crimson)' }}>Workflow Failed</p>
              <p style={{ fontSize: 'var(--t-12)', color: 'var(--c-ink-2)', marginTop: 2 }}>
                Check the audit feed below for details.
              </p>
            </div>
          </div>
        )}

        {/* Header block */}
        <div className="block" style={{ borderColor: s.accent }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', flexWrap: 'wrap', marginBottom: 'var(--sp-2)' }}>
                <h1 style={{ fontSize: 'var(--t-20)', fontWeight: 700 }}>
                  {workflow.type?.replace(/_/g, ' ') ?? 'Workflow'}
                </h1>
                <span className={`badge ${s.badge}`}>{s.label}</span>
              </div>
              <p style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-muted)', fontFamily: 'inherit' }}>ID: {id}</p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
              {reasoningEvents.length > 0 && (
                <button className="btn-ghost" onClick={() => setReasoningOpen(true)}>
                  ⚡ Reasoning ({reasoningEvents.length})
                </button>
              )}
              {['in_progress', 'planning'].includes(workflow.status) && (
                <button className="btn-reject" onClick={handleStop}>Stop</button>
              )}
              <button onClick={handleDelete} className="btn-ghost">Delete</button>
            </div>
          </div>
        </div>

        {/* Agent Graph */}
        <div>
          <p className="section-title" style={{ marginBottom: 'var(--sp-4)' }}>Agent Collaboration Graph</p>
          <div style={{ border: '2px solid var(--c-border)', background: 'var(--c-surface)', height: 430, overflow: 'hidden' }}>
            <AgentSwarmGraph workflowId={id} onReasoningEvent={handleReasoningEvent} />
          </div>
        </div>

        {/* Audit Feed */}
        <div className="block">
          <LiveAuditFeed workflowId={id} initialLogs={auditLogs.map((l: any) => ({
            agent: l.agent,
            action: l.action,
            details: l.details,
            timestamp: l.timestamp,
          }))} />
        </div>

      </div>

      {/* Reasoning Drawer */}
      <ReasoningDrawer
        entries={reasoningEvents}
        selectedEntry={selectedReasoning}
        onClose={() => setReasoningOpen(false)}
        open={reasoningOpen}
      />
    </>
  );
}
