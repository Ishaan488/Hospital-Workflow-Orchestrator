'use client';

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
  if (a.includes('orchestrator')) return '#5c00d3';
  if (a.includes('intake'))       return '#0047e1';
  if (a.includes('insurance'))    return '#0e7490';
  if (a.includes('scheduling'))   return '#006e3a';
  if (a.includes('communication'))return '#b55900';
  return '#888680';
}

function ConfidencePill({ level }: { level?: string }) {
  const map: Record<string, string> = {
    high:   'badge-green',
    medium: 'badge-amber',
    low:    'badge-red',
  };
  return <span className={`badge ${map[level ?? 'high'] ?? 'badge-muted'}`}>{level ?? 'high'} confidence</span>;
}

function CodeBlock({ label, content }: { label: string; content: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      <p className="label">{label}</p>
      <pre style={{
        fontSize: 'var(--t-11)',
        border: '1px solid var(--c-border-dim)',
        background: 'var(--c-surface)',
        padding: 'var(--sp-3)',
        overflow: 'auto',
        lineHeight: 1.5,
        color: 'var(--c-cobalt)',
        fontFamily: 'inherit',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: 180,
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
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,13,13,0.25)' }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`reasoning-drawer ${open ? 'open' : ''}`}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--sp-5) var(--sp-6)',
          borderBottom: '2px solid var(--c-border)',
          position: 'sticky', top: 0,
          background: 'var(--c-bg)',
          zIndex: 10,
        }}>
          <div>
            <p className="section-title" style={{ marginBottom: 'var(--sp-1)' }}>Agent Reasoning Inspector</p>
            <p style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-muted)' }}>
              {entries.length} reasoning event{entries.length !== 1 ? 's' : ''} captured
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: 'var(--sp-1) var(--sp-3)', fontSize: 'var(--t-16)' }}
          >
            ✕
          </button>
        </div>

        {!entry ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, opacity: 0.4 }}>
            <p style={{ fontSize: 36 }}>⚡</p>
            <p style={{ fontSize: 'var(--t-13)', color: 'var(--c-ink-muted)', marginTop: 'var(--sp-4)' }}>No reasoning events yet</p>
            <p style={{ fontSize: 'var(--t-12)', color: 'var(--c-ink-muted)', marginTop: 'var(--sp-2)' }}>Trigger a workflow to capture agent thoughts</p>
          </div>
        ) : (
          <div style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
            {/* Agent identification */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
              <div style={{
                width: 40, height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 'var(--t-16)',
                border: `2px solid ${getAgentColor(entry.agent)}`,
                color: getAgentColor(entry.agent),
                background: `${getAgentColor(entry.agent)}12`,
                flexShrink: 0,
              }}>
                {entry.agent.replace('Agent', '').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 'var(--t-13)', fontWeight: 700, color: getAgentColor(entry.agent), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {entry.agent}
                </p>
                <p style={{ fontSize: 'var(--t-11)', color: 'var(--c-ink-muted)', marginTop: 2 }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <ConfidencePill level={entry.confidence} />
            </div>

            {/* Decision block */}
            <div style={{
              padding: 'var(--sp-4)',
              border: '2px solid var(--c-emerald)',
              background: 'var(--c-emerald-bg)',
            }}>
              <p className="label" style={{ color: 'var(--c-emerald)', marginBottom: 'var(--sp-2)' }}>Decision Taken</p>
              <p style={{ fontSize: 'var(--t-14)', fontWeight: 600, color: 'var(--c-emerald)', lineHeight: 1.5 }}>
                {entry.decision}
              </p>
            </div>

            <CodeBlock label="Chain of Thought" content={entry.chainOfThought} />
            <CodeBlock label="Input Context" content={JSON.stringify(entry.inputContext, null, 2).slice(0, 1000)} />
            <CodeBlock label="System Prompt" content={entry.systemPrompt.slice(0, 600)} />

            {/* All events list */}
            {entries.length > 1 && (
              <div>
                <p className="label" style={{ marginBottom: 'var(--sp-3)' }}>All Events ({entries.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                  {entries.map((e, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                      padding: 'var(--sp-2) var(--sp-3)',
                      background: e === entry ? 'var(--c-cobalt-bg)' : 'transparent',
                      border: `1px solid ${e === entry ? 'var(--c-cobalt)' : 'transparent'}`,
                      fontSize: 'var(--t-12)',
                    }}>
                      <span style={{ color: getAgentColor(e.agent), fontWeight: 700 }}>
                        {e.agent.replace('Agent', '')}
                      </span>
                      <span style={{ opacity: 0.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.decision.slice(0, 60)}
                      </span>
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
