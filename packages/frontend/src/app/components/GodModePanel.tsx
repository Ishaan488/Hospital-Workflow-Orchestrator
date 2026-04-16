'use client';
import { useState } from 'react';
import Link from 'next/link';

const SCENARIOS = [
  { id: 1, name: 'Normal Flow',       badge: 'badge-emerald',description: 'Full Internet Connectivity → Full Agentic Chain',                 tag: 'Standard' },
  { id: 2, name: 'Mesh Relay',        badge: 'badge-amber',  description: 'Internet Saturated → Node Broadcast + Local Triage',              tag: 'Fallback' },
  { id: 3, name: 'Replanning',        badge: 'badge-crimson',description: 'Condition worsens → Re-triage and Dispatch alternatives',         tag: 'Dynamic' },
];

interface GodModePanelProps {
  onWorkflowTriggered: (workflowId: string) => void;
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
      if (data.workflowId) onWorkflowTriggered(data.workflowId);
    } catch {
      setLastResult({ error: 'Backend not reachable. Start the server first.' });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className={open ? 'btn' : 'btn-primary'}
        style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
      >
        <span>Workflow Simulation</span>
        <span style={{ fontSize: 'var(--t-10)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + var(--sp-2))',
          width: 460,
          background: 'var(--c-bg)',
          border: '2px solid var(--c-border)',
          zIndex: 100,
          padding: 'var(--sp-5)',
          boxShadow: '4px 4px 0px var(--c-ink)',
        }}>
          <div style={{ marginBottom: 'var(--sp-5)' }}>
            <p className="section-title" style={{ marginBottom: 'var(--sp-1)' }}>Workflow Simulation</p>
            <p style={{ fontSize: 'var(--t-12)', color: 'var(--c-ink-muted)' }}>Select a scenario to initialize agentic workflow</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => triggerScenario(s.id)}
                disabled={loading !== null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-4)',
                  padding: 'var(--sp-3) var(--sp-4)',
                  background: loading === s.id ? 'var(--c-surface)' : 'transparent',
                  border: '1px solid var(--c-border-dim)',
                  textAlign: 'left',
                  cursor: loading !== null ? 'not-allowed' : 'pointer',
                  opacity: loading !== null && loading !== s.id ? 0.45 : 1,
                  fontFamily: 'inherit',
                  width: '100%',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (loading === null) (e.currentTarget as HTMLElement).style.background = 'var(--c-surface)'; }}
                onMouseLeave={e => { if (loading !== s.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-1)' }}>
                    <span style={{ fontSize: 'var(--t-13)', fontWeight: 700, color: 'var(--c-ink)' }}>{s.name}</span>
                    <span className={`badge ${s.badge}`}>{s.tag}</span>
                  </div>
                  <p style={{ fontSize: 'var(--t-12)', color: 'var(--c-ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.description}
                  </p>
                </div>
                <span style={{ fontSize: 'var(--t-12)', color: 'var(--c-cobalt)', flexShrink: 0 }}>
                  {loading === s.id ? '↻ Running…' : '→'}
                </span>
              </button>
            ))}
          </div>

          {lastResult && (
            <div style={{
              marginTop: 'var(--sp-5)',
              padding: 'var(--sp-3) var(--sp-4)',
              border: `2px solid ${lastResult.error ? 'var(--c-crimson)' : 'var(--c-emerald)'}`,
              background: lastResult.error ? 'var(--c-crimson-bg)' : 'var(--c-emerald-bg)',
            }}>
              {lastResult.error ? (
                <p style={{ fontSize: 'var(--t-12)', color: 'var(--c-crimson)' }}>{lastResult.error}</p>
              ) : (
                <div>
                  <p style={{ fontSize: 'var(--t-13)', fontWeight: 700, color: 'var(--c-emerald)' }}>
                    ✓ Triggered: {lastResult.scenarioName}
                  </p>
                  <p style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-muted)', marginTop: 'var(--sp-1)' }}>
                    ID: {lastResult.workflowId}
                  </p>
                  {lastResult.detailUrl && (
                    <Link href={lastResult.detailUrl} style={{ fontSize: 'var(--t-12)', color: 'var(--c-cobalt)', textDecoration: 'underline', display: 'block', marginTop: 'var(--sp-2)' }}>
                      → View live workflow
                    </Link>
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
