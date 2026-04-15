'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import LiveAuditFeed from '../../components/LiveAuditFeed';
import ReasoningDrawer from '../../components/ReasoningDrawer';

// Dynamically import ReactFlow graph (requires browser)
const AgentSwarmGraph = dynamic(() => import('../../components/AgentSwarmGraph'), { ssr: false });

const STATUS_CONFIG: Record<string, { label: string; badge: string; glow: string }> = {
  created: { label: 'Created', badge: 'badge-muted', glow: '#7fa8c9' },
  planning: { label: 'Planning', badge: 'badge-violet', glow: '#a78bfa' },
  in_progress: { label: 'In Progress', badge: 'badge-blue', glow: '#38bdf8' },
  waiting_approval: { label: 'Awaiting Approval', badge: 'badge-amber', glow: '#fbbf24' },
  waiting_patient: { label: 'Waiting Patient', badge: 'badge-amber', glow: '#fbbf24' },
  completed: { label: 'Completed', badge: 'badge-green', glow: '#34d399' },
  failed: { label: 'Failed', badge: 'badge-red', glow: '#f87171' },
  escalated: { label: 'Escalated 🚨', badge: 'badge-red', glow: '#f87171' },
};

export default function WorkflowDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [workflow, setWorkflow] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reasoningEvents, setReasoningEvents] = useState<any[]>([]);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [selectedReasoning, setSelectedReasoning] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    fetch(`http://localhost:4000/api/workflows/${id}`)
      .then(r => r.json()).then(d => setWorkflow(d.data)).catch(() => {});
    fetch(`http://localhost:4000/api/workflows/${id}/audit`)
      .then(r => r.json()).then(d => setAuditLogs(d.logs ?? [])).catch(() => {});
    fetch(`http://localhost:4000/api/approvals?workflowId=${id}`)
      .then(r => r.json()).then(d => setApprovals(Array.isArray(d) ? d.filter((a: any) => a.workflowId === id && a.status === 'pending') : [])).catch(() => {});
  }, [id]);

  function handleReasoningEvent(event: any) {
    setReasoningEvents(prev => [...prev, { ...event, timestamp: event.timestamp ?? new Date().toISOString() }]);
  }

  async function handleApproval(approvalId: string, action: 'approve' | 'reject') {
    await fetch(`http://localhost:4000/api/approvals/${approvalId}/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decidedBy: 'ops_console_user' }),
    });
    setApprovals(prev => prev.filter(a => a.id !== approvalId));
  }

  async function handleStop() {
    const res = await fetch(`http://localhost:4000/api/workflows/${id}/stop`, { method: 'POST' });
    if (res.ok) {
      setWorkflow((prev: any) => ({ ...prev, status: 'failed' }));
    }
  }

  async function handleDelete() {
    const res = await fetch(`http://localhost:4000/api/workflows/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/workflows');
    }
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center opacity-40">
          <div className="text-4xl mb-3">⏳</div>
          <p style={{ color: 'var(--color-text-muted)' }}>Loading workflow…</p>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[workflow.status] ?? STATUS_CONFIG.created;

  return (
    <>
      <div className="page-enter space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <Link href="/" className="hover:underline" style={{ color: 'var(--color-text-secondary)' }}>Dashboard</Link>
          <span>/</span>
          <Link href="/workflows" className="hover:underline" style={{ color: 'var(--color-text-secondary)' }}>Workflows</Link>
          <span>/</span>
          <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>{id.slice(0, 20)}…</span>
        </nav>

        {/* Completion Banner */}
        {workflow.status === 'completed' && (
          <div className="glass-card p-6 flex flex-col items-center text-center animate-bounce-subtle"
            style={{ 
              borderColor: 'rgba(52,211,153,0.4)', 
              background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(6,13,26,0.1))',
              boxShadow: '0 0 40px rgba(52,211,153,0.15)'
            }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" 
              style={{ background: 'rgba(52,211,153,0.2)', border: '2px solid rgba(52,211,153,0.5)' }}>
              <span className="text-3xl">🏁</span>
            </div>
            <h1 className="text-2xl font-bold gradient-text" style={{ backgroundImage: 'linear-gradient(135deg, #10b981, #34d399)' }}>
              Workflow Successfully Completed
            </h1>
            <p className="text-sm mt-2 opacity-70 max-w-lg">
              All therapeutic goals and compliance checks have been met. The system has notified the patient and updated the EHR.
            </p>
          </div>
        )}

        {workflow.status === 'failed' && (
          <div className="glass-card p-6 flex flex-col items-center text-center border-red-900/30"
            style={{ 
              borderColor: 'rgba(248,113,113,0.4)', 
              background: 'linear-gradient(135deg, rgba(248,113,113,0.1), rgba(6,13,26,0.1))',
            }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" 
              style={{ background: 'rgba(248,113,113,0.2)', border: '2px solid rgba(248,113,113,0.5)' }}>
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-red-400">
              Workflow Terminated with Errors
            </h1>
            <p className="text-sm mt-2 opacity-70 max-w-lg">
              Critical failure detected during processing. Check the audit logs below for technical details or manual intervention requirements.
            </p>
          </div>
        )}

        {/* Header card */}
        <div className="glass-card p-5" style={{ borderColor: `${statusCfg.glow}25` }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {workflow.type?.replace(/_/g, ' ') ?? 'Workflow'}
                </h2>
                <span className={`badge ${statusCfg.badge}`}>{statusCfg.label}</span>
              </div>
              <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>ID: {id}</p>
              {workflow.patientId && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Patient: {workflow.patientId}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {reasoningEvents.length > 0 && (
                <button
                  onClick={() => setReasoningOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: 'rgba(167,139,250,0.1)',
                    border: '1px solid rgba(167,139,250,0.3)',
                    color: '#c4b5fd',
                    boxShadow: '0 0 12px rgba(167,139,250,0.15)',
                  }}>
                  🧠 View Agent Reasoning
                  <span className="badge badge-violet" style={{ fontSize: 10 }}>{reasoningEvents.length}</span>
                </button>
              )}
              {workflow.status === 'waiting_approval' && (
                <Link href="/approvals" className="btn-primary">
                  Review Approval →
                </Link>
              )}
              {/* Context-aware actions */}
              {['in_progress', 'planning', 'waiting_approval', 'waiting_patient'].includes(workflow.status) && (
                <button 
                  onClick={handleStop}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all border border-red-500/30 hover:bg-red-500/10 text-red-400"
                >
                  Stop Workflow
                </button>
              )}
              <button 
                onClick={handleDelete}
                className="btn-reject"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Pending Approvals inline */}
        {approvals.length > 0 && (
          <div className="space-y-3">
            {approvals.map((ap: any) => (
              <div key={ap.id} className="glass-card p-4 flex items-center justify-between gap-4"
                style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.04)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge badge-amber">⏸ Approval Required</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{ap.id?.slice(0, 16)}</span>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{ap.action}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{ap.reason}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="btn-approve" onClick={() => handleApproval(ap.id, 'approve')}>Approve</button>
                  <button className="btn-reject" onClick={() => handleApproval(ap.id, 'reject')}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live A2A Swarm Graph */}
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Agent Collaboration Graph
          </h3>
          <AgentSwarmGraph workflowId={id} onReasoningEvent={handleReasoningEvent} />
        </div>

        {/* Audit Feed */}
        <div className="glass-card p-5">
          <LiveAuditFeed workflowId={id} initialLogs={auditLogs.map(l => ({
            agent: l.agent,
            action: l.action,
            details: l.details,
            timestamp: l.timestamp,
          }))} />
        </div>

        {/* Task list if available */}
        {tasks.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Subtask Graph</h3>
            </div>
            <div className="divide-y">
              {tasks.map((t: any) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3"
                  style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    t.status === 'completed' ? 'agent-dot-completed' :
                    t.status === 'failed' ? 'agent-dot-failed' : 'agent-dot-working'
                  }`} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{t.type}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.agent}</p>
                  </div>
                  <span className={`badge ml-auto ${
                    t.status === 'completed' ? 'badge-green' :
                    t.status === 'failed' ? 'badge-red' : 'badge-blue'
                  }`}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reasoning Inspector Drawer */}
      <ReasoningDrawer
        entries={reasoningEvents}
        selectedEntry={selectedReasoning}
        onClose={() => setReasoningOpen(false)}
        open={reasoningOpen}
      />
    </>
  );
}
