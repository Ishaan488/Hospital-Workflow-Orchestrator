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

function getAgentClass(agent: string): string {
  const a = agent.toLowerCase();
  if (a.includes('orchestrator')) return 'agent-orchestrator';
  if (a.includes('intake')) return 'agent-intake';
  if (a.includes('insurance')) return 'agent-insurance';
  if (a.includes('scheduling')) return 'agent-scheduling';
  if (a.includes('communication')) return 'agent-communication';
  if (a.includes('broker') || a.includes('a2a')) return 'agent-broker';
  return 'agent-system';
}

function getActionIcon(action: string, details?: Record<string, any>): string {
  if (details?.type === 'mcp_call') return '🔌';
  if (details?.type === 'agent_reasoning') return '🧠';
  if (action.toLowerCase().includes('escalat')) return '🚨';
  if (action.toLowerCase().includes('a2a') || action.toLowerCase().includes('dispatched')) return '📡';
  if (action.toLowerCase().includes('approved')) return '✅';
  if (action.toLowerCase().includes('fail')) return '❌';
  if (action.toLowerCase().includes('complet')) return '✓';
  if (action.toLowerCase().includes('started')) return '▶';
  if (action.toLowerCase().includes('approval')) return '⏸';
  return '·';
}

export default function LiveAuditFeed({ workflowId, initialLogs = [] }: LiveAuditFeedProps) {
  const [entries, setEntries] = useState<AuditEntry[]>(initialLogs);
  const [tooltipEntry, setTooltipEntry] = useState<{ entry: AuditEntry; x: number; y: number } | null>(null);
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
          agent: data.agent ?? data.from ?? 'System',
          action: data.action ?? data.event ?? '',
          details: data.details ?? data,
          workflowId: data.workflowId,
          timestamp: data.timestamp ?? new Date().toISOString(),
          type: data.type,
        };
        return [...prev, newEntry];
      });
      // Auto-scroll
      if (autoScroll.current && feedRef.current) {
        setTimeout(() => {
          feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
        }, 50);
      }
    };

    es.addEventListener('audit_log', e => addEntry(JSON.parse(e.data)));
    es.addEventListener('a2a_message', e => {
      const d = JSON.parse(e.data);
      addEntry({ ...d, agent: 'A2ABroker', action: `A2A: ${d.from} → ${d.to}`, details: d });
    });
    es.addEventListener('agent_reasoning', e => {
      const d = JSON.parse(e.data);
      addEntry({ ...d, action: `🧠 Reasoning: ${d.decision}`, details: { ...d, type: 'agent_reasoning' } });
    });
    es.addEventListener('mcp_tool_call', e => {
      const d = JSON.parse(e.data);
      addEntry({ ...d, action: `🔌 MCP: ${d.server}.${d.tool}()`, details: { ...d, type: 'mcp_call' } });
    });
    es.addEventListener('agent_escalation', e => {
      const d = JSON.parse(e.data);
      addEntry({ ...d, action: `🚨 ESCALATION: ${d.agent} — ${d.reason}` });
    });
    es.addEventListener('approval_requested', e => {
      const d = JSON.parse(e.data);
      addEntry({ agent: 'ApprovalManager', action: `⏸ Approval Required: ${d.action}`, details: d });
    });

    return () => es.close();
  }, [workflowId]);

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full agent-dot-working" />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Live Audit Feed</h3>
        </div>
        <span className="badge badge-blue">{entries.length} events</span>
      </div>

      <div
        ref={feedRef}
        onScroll={e => {
          const el = e.currentTarget;
          autoScroll.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
        }}
        className="flex-1 overflow-y-auto space-y-1 pr-1"
        style={{ maxHeight: 480, minHeight: 200 }}>
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 opacity-40">
            <span style={{ fontSize: 28 }}>📡</span>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Waiting for agent activity...</p>
          </div>
        )}

        {entries
          .filter(e => e.agent !== 'A2ABroker') // Hide internal plumbing noise
          .map((entry, idx) => {
          const hasMCPData = entry.details?.type === 'mcp_call' || entry.details?.type === 'agent_reasoning';
          return (
            <div
              key={idx}
              className="feed-entry flex items-start gap-3 px-3 py-2 rounded-lg group relative"
              style={{
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid transparent',
                cursor: hasMCPData ? 'pointer' : 'default',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,255,255,0.05)';
                el.style.borderColor = 'rgba(255,255,255,0.1)';
                if (hasMCPData) {
                  // Y relative to the component root (div relative)
                  // rect.top of root - rect.top of item
                  const rootRect = feedRef.current?.parentElement?.getBoundingClientRect();
                  const itemRect = el.getBoundingClientRect();
                  if (rootRect) {
                    setTooltipEntry({ entry, x: 0, y: itemRect.top - rootRect.top + 50 });
                  }
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,255,255,0.015)';
                el.style.borderColor = 'transparent';
                setTooltipEntry(null);
              }}>

              <span className="text-sm mt-0.5 w-4 shrink-0 text-center opacity-70">
                {getActionIcon(entry.action, entry.details)}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${getAgentClass(entry.agent)}`}>
                    {entry.agent.replace('Agent', '')}
                  </span>
                  {hasMCPData && (
                    <span className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">Click to Inspect</span>
                  )}
                </div>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {entry.action.replace('Task Status Update: ', '')}
                </p>
              </div>

              <span className="text-[9px] shrink-0 font-mono opacity-30 mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>

      {/* MCP X-Ray Tooltip */}
      {tooltipEntry && (
        <div
          className="mcp-tooltip"
          style={{ 
            top: tooltipEntry.y - 100, // Offset slightly to not cover the mouse
            right: 10,
            position: 'absolute', 
            zIndex: 200,
            maxWidth: 320, 
            pointerEvents: 'none'
          }}>
          <p className="text-[10px] font-bold mb-1" style={{ color: '#a78bfa' }}>
            {tooltipEntry.entry.details?.type === 'mcp_call' ? '🔌 MCP X-Ray' : '🧠 Agent Reasoning'}
          </p>
          {tooltipEntry.entry.details?.type === 'mcp_call' && (
            <div className="space-y-1">
              <p className="opacity-90 text-[10px] font-mono break-all font-bold">
                {tooltipEntry.entry.details?.server}.{tooltipEntry.entry.details?.tool}()
              </p>
              <p className="opacity-60 text-[10px]">Args: {JSON.stringify(tooltipEntry.entry.details?.args ?? {}, null, 0).slice(0, 100)}</p>
              <p className="opacity-60 text-[10px]">Result: {JSON.stringify(tooltipEntry.entry.details?.result ?? {}, null, 0).slice(0, 150)}</p>
            </div>
          )}
          {tooltipEntry.entry.details?.type === 'agent_reasoning' && (
            <p className="opacity-80 text-[10px] leading-relaxed">{tooltipEntry.entry.details?.chainOfThought?.slice(0, 300)}</p>
          )}
        </div>
      )}
    </div>
  );
}
