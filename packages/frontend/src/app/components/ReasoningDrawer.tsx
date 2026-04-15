'use client';
import { useEffect, useRef } from 'react';

interface ReasoningEntry {
  agent: string;
  systemPrompt: string;
  inputContext: Record<string, any>;
  chainOfThought: string;
  decision: string;
  confidence?: 'high' | 'medium' | 'low';
  timestamp: string;
}

interface ReasoningDrawerProps {
  entries: ReasoningEntry[];
  selectedEntry: ReasoningEntry | null;
  onClose: () => void;
  open: boolean;
}

function getAgentColor(agent: string): string {
  const a = agent.toLowerCase();
  if (a.includes('orchestrator')) return '#a78bfa';
  if (a.includes('intake')) return '#38bdf8';
  if (a.includes('insurance')) return '#22d3ee';
  if (a.includes('scheduling')) return '#34d399';
  if (a.includes('communication')) return '#fbbf24';
  return '#7fa8c9';
}

function ConfidencePill({ level }: { level?: string }) {
  const colors: Record<string, string> = {
    high: 'badge-green',
    medium: 'badge-amber',
    low: 'badge-red',
  };
  return <span className={`badge ${colors[level ?? 'high'] ?? 'badge-muted'}`}>{level ?? 'high'} confidence</span>;
}

function CodeBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <pre className="text-[11px] rounded-lg p-3 overflow-x-auto leading-relaxed"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--color-border)',
          color: '#7dd3fc',
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 180,
          overflowY: 'auto',
        }}>
        {content}
      </pre>
    </div>
  );
}

export default function ReasoningDrawer({ entries, selectedEntry, onClose, open }: ReasoningDrawerProps) {
  const entry = selectedEntry ?? entries[entries.length - 1];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`reasoning-drawer ${open ? 'open' : ''}`}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 z-10"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
              🧠 Agent Reasoning Inspector
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {entries.length} reasoning event{entries.length !== 1 ? 's' : ''} captured
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)' }}>
            ✕
          </button>
        </div>

        {!entry ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-40">
            <span style={{ fontSize: 36 }}>🧠</span>
            <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>No reasoning events yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Trigger a workflow to capture agent thoughts</p>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Agent header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                style={{ background: `${getAgentColor(entry.agent)}18`, border: `1px solid ${getAgentColor(entry.agent)}30`, color: getAgentColor(entry.agent) }}>
                {entry.agent.replace('Agent', '').charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: getAgentColor(entry.agent) }}>
                  {entry.agent}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <div className="ml-auto">
                <ConfidencePill level={entry.confidence} />
              </div>
            </div>

            {/* Final decision — most prominent */}
            <div className="p-4 rounded-xl" style={{
              background: 'rgba(52, 211, 153, 0.06)',
              border: '1px solid rgba(52, 211, 153, 0.2)',
            }}>
              <p className="text-[10px] uppercase font-bold tracking-widest mb-1" style={{ color: '#34d399' }}>Decision Taken</p>
              <p className="text-sm font-medium leading-relaxed" style={{ color: '#6ee7b7' }}>
                {entry.decision}
              </p>
            </div>

            {/* Chain of thought */}
            <CodeBlock label="Chain of Thought" content={entry.chainOfThought} />

            {/* Input context */}
            <CodeBlock
              label="Input Context (What agent was given)"
              content={JSON.stringify(entry.inputContext, null, 2).slice(0, 1000)}
            />

            {/* System prompt */}
            <CodeBlock label="System Prompt" content={entry.systemPrompt.slice(0, 600)} />

            {/* All events list */}
            {entries.length > 1 && (
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  All Reasoning Events ({entries.length})
                </p>
                <div className="space-y-1">
                  {entries.map((e, i) => (
                    <div key={i}
                      className="flex items-center gap-2 p-2 rounded-lg text-xs"
                      style={{
                        background: e === entry ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${e === entry ? 'rgba(56,189,248,0.3)' : 'transparent'}`,
                        color: 'var(--color-text-secondary)',
                      }}>
                      <span style={{ color: getAgentColor(e.agent) }}>{e.agent.replace('Agent', '')}</span>
                      <span className="opacity-50 truncate flex-1">{e.decision.slice(0, 60)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
