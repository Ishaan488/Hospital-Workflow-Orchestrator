'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Approval {
  id: string;
  workflowId: string;
  action: string;
  reason: string;
  details: Record<string, any>;
  status: string;
  createdAt: string;
}

const RISK_CONFIG = (action: string): { level: string; color: string; badge: string } => {
  const a = action.toLowerCase();
  if (a.includes('reschedul') || a.includes('cancel')) return { level: 'High', color: '#f87171', badge: 'badge-red' };
  if (a.includes('preauth') || a.includes('authorization')) return { level: 'Medium', color: '#fbbf24', badge: 'badge-amber' };
  return { level: 'Low', color: '#34d399', badge: 'badge-green' };
};

export default function ApprovalsPage() {
  const [pending, setPending] = useState<Approval[]>([]);
  const [history, setHistory] = useState<Approval[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:4000/api/approvals')
      .then(r => r.json())
      .then((data: Approval[]) => {
        const all = Array.isArray(data) ? data : [];
        setPending(all.filter(a => a.status === 'pending'));
        setHistory(all.filter(a => a.status !== 'pending').slice(0, 10));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Live SSE updates for new approval requests
  useEffect(() => {
    const es = new EventSource('http://localhost:4000/api/stream/global');
    es.addEventListener('approval_requested', e => {
      const d = JSON.parse(e.data);
      setPending(prev => [d, ...prev.filter(a => a.id !== d.id)]);
    });
    return () => es.close();
  }, []);

  async function act(approvalId: string, action: 'approve' | 'reject') {
    setActing(approvalId);
    try {
      await fetch(`http://localhost:4000/api/approvals/${approvalId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decidedBy: 'ops_console_user' }),
      });
      const acted = pending.find(a => a.id === approvalId);
      if (acted) {
        setPending(prev => prev.filter(a => a.id !== approvalId));
        setHistory(prev => [{ ...acted, status: action === 'approve' ? 'approved' : 'rejected' }, ...prev].slice(0, 10));
      }
    } catch (err) {
      alert('Backend not reachable');
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="page-enter space-y-8">

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight gradient-text">Human Approval Gates</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Agent-requested actions requiring explicit human authorization before execution
        </p>
      </div>

      {/* Stats mini-row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="glass-card px-5 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold" style={{ color: pending.length > 0 ? '#fbbf24' : '#34d399' }}>{pending.length}</span>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Pending</span>
        </div>
        <div className="glass-card px-5 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold" style={{ color: '#34d399' }}>{history.filter(h => h.status === 'approved').length}</span>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Approved</span>
        </div>
        <div className="glass-card px-5 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold" style={{ color: '#f87171' }}>{history.filter(h => h.status === 'rejected').length}</span>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Rejected</span>
        </div>
      </div>

      {/* Pending approvals */}
      {loading ? (
        <div className="glass-card p-12 text-center opacity-40">
          <p style={{ fontSize: 32 }}>⏳</p>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
        </div>
      ) : pending.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div style={{ fontSize: 48 }}>✅</div>
          <p className="text-lg font-semibold mt-4" style={{ color: 'var(--color-text-secondary)' }}>All Clear</p>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>No pending approvals. The AI agents are operating autonomously.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Requires Action</h3>
          {pending.map(ap => {
            const risk = RISK_CONFIG(ap.action);
            return (
              <div key={ap.id} className="glass-card p-5 space-y-4"
                style={{ borderColor: `${risk.color}25` }}>

                {/* Header row */}
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge badge-amber">⏸ Requires Action</span>
                      <span className={`badge ${risk.badge}`}>{risk.level} Risk</span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{ap.id.slice(0, 16)}…</span>
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{ap.action}</h3>
                  </div>
                  <Link href={`/workflows/${ap.workflowId}`}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: 'rgba(56,189,248,0.08)', color: 'var(--color-teal-400)', border: '1px solid rgba(56,189,248,0.2)' }}>
                    View Workflow →
                  </Link>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}>
                    <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--color-text-muted)' }}>AI Reasoning</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{ap.reason}</p>
                  </div>
                  {ap.details && Object.keys(ap.details).length > 0 && (
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}>
                      <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--color-text-muted)' }}>Additional Context</p>
                      <pre className="text-[10px] leading-relaxed overflow-auto" style={{ color: '#7dd3fc', fontFamily: 'monospace', maxHeight: 80 }}>
                        {JSON.stringify(ap.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    className="btn-approve"
                    disabled={acting === ap.id}
                    onClick={() => act(ap.id, 'approve')}>
                    {acting === ap.id ? '…' : '✓ Approve — Execute Automatically'}
                  </button>
                  <button
                    className="btn-reject"
                    disabled={acting === ap.id}
                    onClick={() => act(ap.id, 'reject')}>
                    ✕ Reject
                  </button>
                  <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(ap.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Recent Decisions</h3>
          <div className="glass-card divide-y">
            {history.map((ap, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3"
                style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className={`badge ${ap.status === 'approved' ? 'badge-green' : 'badge-red'}`}>
                  {ap.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
                </span>
                <p className="text-sm flex-1" style={{ color: 'var(--color-text-secondary)' }}>{ap.action}</p>
                <Link href={`/workflows/${ap.workflowId}`}
                  className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {ap.workflowId?.slice(0, 8)}…
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
