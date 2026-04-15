'use client';
import { useState } from 'react';

const SCENARIOS = [
  { id: 1, name: 'Happy Path', icon: '✅', color: '#34d399', description: 'Complete docs + valid insurance → auto-completes', tag: 'Full automation' },
  { id: 2, name: 'Missing Insurance', icon: '🪪', color: '#fbbf24', description: 'Card missing → reminder sent, slot held provisional', tag: 'Communication agent' },
  { id: 3, name: 'Pre-Auth Required', icon: '📋', color: '#38bdf8', description: 'Procedure needs insurer pre-auth → submitted + monitored', tag: 'Insurance agent' },
  { id: 4, name: 'Reschedule Needed', icon: '📅', color: '#f87171', description: 'High delay risk → alternatives proposed → human approval', tag: 'Human approval gate' },
  { id: 5, name: 'Multi-Item Missing', icon: '⚡', color: '#a78bfa', description: 'ID + referral + demographics missing → parallel agents', tag: 'Full swarm' },
];

interface GodModePanelProps {
  onWorkflowTriggered: (workflowId: string, scenarioName: string) => void;
}

export default function GodModePanel({ onWorkflowTriggered }: GodModePanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  async function triggerScenario(scenarioId: number) {
    setLoading(scenarioId);
    setLastResult(null);
    try {
      const res = await fetch('http://localhost:4000/api/demo/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioId }),
      });
      const data = await res.json();
      setLastResult(data);
      if (data.workflowId) {
        onWorkflowTriggered(data.workflowId, data.scenarioName);
      }
    } catch (err) {
      setLastResult({ error: 'Backend not reachable. Start the server first.' });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
        style={{
          background: open ? 'rgba(167,139,250,0.15)' : 'rgba(167,139,250,0.08)',
          border: '1px solid rgba(167,139,250,0.3)',
          color: '#c4b5fd',
          boxShadow: open ? '0 0 16px rgba(167,139,250,0.2)' : 'none',
        }}>
        <span style={{ fontSize: 14 }}>⚡</span>
        Demo Simulator
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[480px] god-mode-panel p-5 z-40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#c4b5fd' }}>⚡ God Mode — Demo Simulator</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Trigger any scenario to watch agents collaborate live</p>
            </div>
          </div>

          <div className="space-y-2">
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => triggerScenario(s.id)}
                disabled={loading !== null}
                className="w-full text-left p-3 rounded-xl transition-all group"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid rgba(255,255,255,0.07)`,
                  cursor: loading !== null ? 'not-allowed' : 'pointer',
                  opacity: loading !== null && loading !== s.id ? 0.5 : 1,
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}>
                    {loading === s.id ? (
                      <span className="animate-spin text-xs">↻</span>
                    ) : s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>
                      <span className="badge badge-muted" style={{ fontSize: 9 }}>{s.tag}</span>
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{s.description}</p>
                  </div>
                  <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: s.color }}>
                    {loading === s.id ? 'Running...' : '→ Trigger'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {lastResult && (
            <div className="mt-4 p-3 rounded-xl" style={{
              background: lastResult.error ? 'rgba(248,113,113,0.08)' : 'rgba(52,211,153,0.08)',
              border: `1px solid ${lastResult.error ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)'}`,
            }}>
              {lastResult.error ? (
                <p className="text-xs text-red-400">{lastResult.error}</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold" style={{ color: '#6ee7b7' }}>✓ Workflow triggered: {lastResult.scenarioName}</p>
                  <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>ID: {lastResult.workflowId}</p>
                  {lastResult.detailUrl && (
                    <a href={lastResult.detailUrl} className="text-xs underline" style={{ color: 'var(--color-teal-400)' }}>
                      → View live workflow
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
