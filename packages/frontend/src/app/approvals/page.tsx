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

const RISK_CONFIG = (action: string): { level: string; badge: string } => {
  const a = action.toLowerCase();
  if (a.includes('reschedul') || a.includes('cancel')) return { level: 'High Risk', badge: 'badge-red' };
  if (a.includes('preauth') || a.includes('authorization')) return { level: 'Medium Risk', badge: 'badge-amber' };
  return { level: 'Low Risk', badge: 'badge-green' };
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
    } catch {
      alert('Backend not reachable');
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-10)' }}>

      {/* Header */}
      <div>
        <p className="label" style={{ marginBottom: 'var(--sp-1)' }}>Human-in-the-Loop</p>
        <h1 style={{ fontSize: 'var(--t-28)', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
          Approval Gates
        </h1>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 'var(--sp-1)', borderTop: '3px solid var(--c-border)', borderLeft: '3px solid var(--c-border)' }}>
        {[
          { v: pending.length, label: 'Pending', color: pending.length > 0 ? 'var(--c-amber)' : 'var(--c-emerald)' },
          { v: history.filter(h => h.status === 'approved').length, label: 'Approved', color: 'var(--c-emerald)' },
          { v: history.filter(h => h.status === 'rejected').length, label: 'Rejected', color: 'var(--c-crimson)' },
        ].map(({ v, label, color }) => (
          <div key={label} style={{
            padding: 'var(--sp-4) var(--sp-6)',
            borderRight: '3px solid var(--c-border)',
            borderBottom: '3px solid var(--c-border)',
            minWidth: 120,
          }}>
            <p className="label" style={{ marginBottom: 'var(--sp-1)' }}>{label}</p>
            <p style={{ fontSize: 'var(--t-40)', fontWeight: 700, color, lineHeight: 1 }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Pending approvals */}
      {loading ? (
        <p style={{ color: 'var(--c-ink-muted)', textAlign: 'center', padding: 'var(--sp-12) 0' }}>Loading…</p>
      ) : pending.length === 0 ? (
        <div className="block" style={{ textAlign: 'center', padding: 'var(--sp-16) 0' }}>
          <p style={{ fontSize: 'var(--t-28)', fontWeight: 700, color: 'var(--c-emerald)' }}>All Clear</p>
          <p style={{ fontSize: 'var(--t-13)', color: 'var(--c-ink-muted)', marginTop: 'var(--sp-2)' }}>
            No pending approvals. Agents operating autonomously.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          <p className="section-title">Requires Action</p>
          {pending.map(ap => {
            const risk = RISK_CONFIG(ap.action);
            return (
              <div key={ap.id} className="block" style={{ borderColor: 'var(--c-amber)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)', flexWrap: 'wrap' }}>
                      <span className="badge badge-amber">⏸ Requires Action</span>
                      <span className={`badge ${risk.badge}`}>{risk.level}</span>
                      <span style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-muted)', fontFamily: 'inherit' }}>{ap.id.slice(0, 14)}…</span>
                    </div>
                    <h2 style={{ fontSize: 'var(--t-16)', fontWeight: 700, color: 'var(--c-ink)' }}>{ap.action}</h2>
                  </div>
                  <Link href={`/workflows/${ap.workflowId}`} className="btn-ghost" style={{ fontSize: 'var(--t-12)' }}>
                    View Workflow →
                  </Link>
                </div>

                {/* Detail grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
                  <div className="block-surface">
                    <p className="label" style={{ marginBottom: 'var(--sp-2)' }}>AI Reasoning</p>
                    <p style={{ fontSize: 'var(--t-13)', color: 'var(--c-ink-2)', lineHeight: 1.55 }}>{ap.reason}</p>
                  </div>
                  {ap.details && Object.keys(ap.details).length > 0 && (
                    <div className="block-surface">
                      <p className="label" style={{ marginBottom: 'var(--sp-2)' }}>Context</p>
                      <pre style={{
                        fontSize: 'var(--t-11)', color: 'var(--c-cobalt)',
                        fontFamily: 'inherit', whiteSpace: 'pre-wrap',
                        overflow: 'auto', maxHeight: 100,
                      }}>
                        {JSON.stringify(ap.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                  <button className="btn-approve" disabled={acting === ap.id} onClick={() => act(ap.id, 'approve')}>
                    {acting === ap.id ? '…' : '✓ Approve — Execute'}
                  </button>
                  <button className="btn-reject" disabled={acting === ap.id} onClick={() => act(ap.id, 'reject')}>
                    ✕ Reject
                  </button>
                  <span style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-muted)', marginLeft: 'auto' }}>
                    {new Date(ap.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decision history */}
      {history.length > 0 && (
        <div>
          <p className="section-title" style={{ marginBottom: 'var(--sp-4)' }}>Recent Decisions</p>
          <div className="block" style={{ padding: 0 }}>
            <div className="data-row-header" style={{ padding: '0 var(--sp-5)', paddingTop: 'var(--sp-3)', paddingBottom: 'var(--sp-3)' }}>
              <span style={{ width: 100 }}>Decision</span>
              <span style={{ flex: 1 }}>Action</span>
              <span style={{ width: 100 }}>Workflow</span>
            </div>
            {history.map((ap, i) => (
              <div key={i} className="data-row" style={{ padding: 'var(--sp-3) var(--sp-5)' }}>
                <span className={`badge ${ap.status === 'approved' ? 'badge-green' : 'badge-red'}`} style={{ width: 100 }}>
                  {ap.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
                </span>
                <p style={{ flex: 1, fontSize: 'var(--t-13)', color: 'var(--c-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ap.action}
                </p>
                <Link href={`/workflows/${ap.workflowId}`} style={{ fontSize: 'var(--t-11)', color: 'var(--c-cobalt)', width: 100 }}>
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
