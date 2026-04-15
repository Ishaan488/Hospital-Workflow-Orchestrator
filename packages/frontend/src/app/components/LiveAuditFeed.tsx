'use client';
import { useEffect, useRef, useState } from 'react';

interface AuditEntry {
  agent: string;
  action: string;
  details?: Record<string, any>;
  workflowId?: string;
  timestamp: string;
  type?: string;
}

interface LiveAuditFeedProps {
  workflowId: string;
  initialLogs?: AuditEntry[];
}

function getAgentColor(agent: string): string {
  const a = agent.toLowerCase();
  if (a.includes('orchestrator'))  return '#5c00d3';
  if (a.includes('intake'))        return '#0047e1';
  if (a.includes('insurance'))     return '#0e7490';
  if (a.includes('scheduling'))    return '#006e3a';
  if (a.includes('communication')) return '#b55900';
  if (a.includes('broker') || a.includes('a2a')) return '#be185d';
  return '#888680';
}

function getActionGlyph(action: string, details?: Record<string, any>): string {
  if (details?.type === 'mcp_call')        return '⬡';
  if (details?.type === 'agent_reasoning') return '◈';
  if (action.toLowerCase().includes('escalat'))   return '▲';
  if (action.toLowerCase().includes('a2a') || action.toLowerCase().includes('dispatched')) return '→';
  if (action.toLowerCase().includes('approved'))  return '✓';
  if (action.toLowerCase().includes('fail'))      return '✕';
  if (action.toLowerCase().includes('complet'))   return '●';
  if (action.toLowerCase().includes('started'))   return '▶';
  if (action.toLowerCase().includes('approval'))  return '⏸';
  return '·';
}

export default function LiveAuditFeed({ workflowId, initialLogs = [] }: LiveAuditFeedProps) {
  const [entries, setEntries] = useState<AuditEntry[]>(initialLogs);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  useEffect(() => {
    if (initialLogs.length > 0) setEntries(initialLogs);
  }, [initialLogs]);

  useEffect(() => {
    if (!workflowId) return;
    const es = new EventSource(`http://localhost:4000/api/workflows/${workflowId}/stream`);

    const addEntry = (data: any) => {
      setEntries(prev => {
        const newEntry: AuditEntry = {
          agent:      data.agent ?? data.from ?? 'System',
          action:     data.action ?? data.event ?? '',
          details:    data.details ?? data,
          workflowId: data.workflowId,
          timestamp:  data.timestamp ?? new Date().toISOString(),
          type:       data.type,
        };
        return [...prev, newEntry];
      });
      if (autoScroll.current && feedRef.current) {
        setTimeout(() => feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' }), 50);
      }
    };

    es.addEventListener('audit_log',     e => addEntry(JSON.parse(e.data)));
    es.addEventListener('a2a_message',   e => {
      const d = JSON.parse(e.data);
      addEntry({ ...d, agent: 'A2ABroker', action: `A2A: ${d.from} → ${d.to}`, details: d });
    });
    es.addEventListener('agent_reasoning', e => {
      const d = JSON.parse(e.data);
      addEntry({ ...d, action: `Reasoning: ${d.decision}`, details: { ...d, type: 'agent_reasoning' } });
    });
    es.addEventListener('mcp_tool_call', e => {
      const d = JSON.parse(e.data);
      addEntry({ ...d, action: `MCP: ${d.server}.${d.tool}()`, details: { ...d, type: 'mcp_call' } });
    });
    es.addEventListener('agent_escalation', e => {
      const d = JSON.parse(e.data);
      addEntry({ ...d, action: `ESCALATION: ${d.agent} — ${d.reason}` });
    });
    es.addEventListener('approval_requested', e => {
      const d = JSON.parse(e.data);
      addEntry({ agent: 'ApprovalManager', action: `Approval Required: ${d.action}`, details: d });
    });

    return () => es.close();
  }, [workflowId]);

  const visibleEntries = entries.filter(e => e.agent !== 'A2ABroker');

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <span className="agent-dot-working" style={{ width: 8, height: 8, display: 'inline-block' }} />
          <p className="section-title">Live Audit Feed</p>
        </div>
        <span style={{
          fontSize: 'var(--t-10)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '2px 8px', border: '1.5px solid var(--c-cobalt)',
          color: 'var(--c-cobalt)', background: 'var(--c-cobalt-bg)',
        }}>{entries.length} events</span>
      </div>

      <div
        ref={feedRef}
        onScroll={e => {
          const el = e.currentTarget;
          autoScroll.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
        }}
        style={{ maxHeight: 480, minHeight: 200, overflowY: 'auto' }}
      >
        {visibleEntries.length === 0 && (
          <p style={{ color: 'var(--c-ink-muted)', textAlign: 'center', padding: 'var(--sp-10) 0' }}>Waiting for agent activity…</p>
        )}

        {visibleEntries.map((entry, idx) => {
          const hasMCP = entry.details?.type === 'mcp_call' || entry.details?.type === 'agent_reasoning';
          const isExpanded = expandedIdx === idx;

          return (
            <div key={idx}>
              <div
                className="feed-entry"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)',
                  cursor: hasMCP ? 'pointer' : 'default',
                  background: isExpanded ? 'var(--c-surface)' : 'transparent',
                }}
                onClick={() => hasMCP && setExpandedIdx(isExpanded ? null : idx)}
              >
                <span style={{ fontSize: 12, marginTop: 2, width: 14, flexShrink: 0, textAlign: 'center', color: getAgentColor(entry.agent) }}>
                  {getActionGlyph(entry.action, entry.details)}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 2 }}>
                    <span style={{
                      fontSize: 'var(--t-10)', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: getAgentColor(entry.agent),
                    }}>
                      {entry.agent.replace('Agent', '')}
                    </span>
                    {hasMCP && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        color: 'var(--c-cobalt)', opacity: 0.6,
                      }}>
                        {isExpanded ? '▲ hide' : '▼ inspect'}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 'var(--t-12)', color: 'var(--c-ink-2)', lineHeight: 1.4 }}>
                    {entry.action.replace('Task Status Update: ', '')}
                  </p>
                </div>

                <span style={{ fontSize: 'var(--t-10)', flexShrink: 0, color: 'var(--c-ink-muted)', marginTop: 2 }}>
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              {/* Inline MCP X-Ray Expand Panel */}
              {isExpanded && hasMCP && (
                <div style={{
                  margin: 'var(--sp-1) 0 var(--sp-3) 20px',
                  padding: 'var(--sp-3) var(--sp-4)',
                  border: '1.5px solid var(--c-cobalt)',
                  borderLeft: '3px solid var(--c-cobalt)',
                  background: 'var(--c-cobalt-bg)',
                }}>
                  {entry.details?.type === 'mcp_call' && (
                    <>
                      <p style={{ fontSize: 'var(--t-10)', fontWeight: 700, color: 'var(--c-cobalt)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>
                        MCP X-Ray
                      </p>
                      <p style={{ fontSize: 'var(--t-12)', fontWeight: 700, color: 'var(--c-ink)', marginBottom: 'var(--sp-1)' }}>
                        {entry.details?.server}.{entry.details?.tool}()
                        {entry.details?.durationMs && (
                          <span style={{ fontWeight: 400, color: 'var(--c-ink-muted)', marginLeft: 'var(--sp-2)' }}>{entry.details.durationMs}ms</span>
                        )}
                      </p>
                      <p style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-2)', fontFamily: 'inherit', marginBottom: 'var(--sp-1)', wordBreak: 'break-all' }}>
                        <span style={{ color: 'var(--c-ink-muted)', marginRight: 4 }}>Args:</span>
                        {JSON.stringify(entry.details?.args ?? {}, null, 0).slice(0, 200)}
                      </p>
                      <p style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-2)', fontFamily: 'inherit', wordBreak: 'break-all' }}>
                        <span style={{ color: entry.details?.success === false ? 'var(--c-crimson)' : 'var(--c-emerald)', marginRight: 4 }}>
                          {entry.details?.success === false ? '✕ Error:' : '✓ Result:'}
                        </span>
                        {JSON.stringify(entry.details?.result ?? {}, null, 0).slice(0, 300)}
                      </p>
                    </>
                  )}
                  {entry.details?.type === 'agent_reasoning' && (
                    <>
                      <p style={{ fontSize: 'var(--t-10)', fontWeight: 700, color: 'var(--c-violet)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>
                        Agent Reasoning
                      </p>
                      <p style={{ fontSize: 'var(--t-12)', fontWeight: 700, color: 'var(--c-ink)', marginBottom: 'var(--sp-1)' }}>
                        Decision: {entry.details?.decision}
                      </p>
                      <p style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-2)', lineHeight: 1.6 }}>
                        {entry.details?.chainOfThought?.slice(0, 400)}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
