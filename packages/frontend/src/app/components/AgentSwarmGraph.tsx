'use client';
import ReactFlow, {
  Node, Edge, Background, Controls,
  useNodesState, useEdgesState,
  BackgroundVariant, Handle, Position,
  NodeProps,
} from 'reactflow';
import { useEffect, useCallback, useState, useMemo } from 'react';
import 'reactflow/dist/style.css';

// ─── Emergency Orchestrator Agent Topology ────────────────────────────────────
//
//                         Orchestrator
//                         /          \
//                   Incident        AuditAgent
//                      |
//                   Triage
//                   /     \
//       HospitalMatching  GuidanceAgent
//                |
//            Dispatch
//            /      \
//       Contact    Handover
//
const AGENTS = [
  { id: 'orchestrator',     label: 'Orchestrator',      sub: 'AI Coordinator',          color: '#5c00d3', x: 340, y: 220 },
  { id: 'incident',         label: 'Incident',          sub: 'Extract Facts',           color: '#0047e1', x: 60,  y: 60  },
  { id: 'audit',            label: 'Audit',             sub: 'Policy + Safety',         color: '#64748b', x: 390, y: 60  },
  { id: 'triage',           label: 'Triage',            sub: 'Triage Profile',          color: '#0e7490', x: 620, y: 60  },
  { id: 'hospitalmatching', label: 'HospitalMatch',     sub: 'Rank Hospitals',          color: '#006e3a', x: 60,  y: 220 },
  { id: 'guidance',         label: 'Guidance',          sub: 'First Aid Instructions', color: '#a855f7', x: 620, y: 220 },
  { id: 'dispatch',         label: 'Dispatch',          sub: 'Request Ambulance',       color: '#b55900', x: 60,  y: 380 },
  { id: 'contact',          label: 'Contact',           sub: 'Notify Relatives',        color: '#be185d', x: 340, y: 380 },
  { id: 'handover',         label: 'Handover',          sub: 'Pre-Arrival Packet',      color: '#f97316', x: 620, y: 380 },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e-orch-incident',   source: 'orchestrator', target: 'incident',         animated: false, style: { stroke: '#1a1a1a', strokeWidth: 2 } },
  { id: 'e-orch-audit',      source: 'orchestrator', target: 'audit',            animated: false, style: { stroke: '#1a1a1a', strokeWidth: 2 } },
  { id: 'e-orch-triage',     source: 'orchestrator', target: 'triage',           animated: false, style: { stroke: '#1a1a1a', strokeWidth: 2 } },
  { id: 'e-orch-hosp',       source: 'orchestrator', target: 'hospitalmatching', animated: false, style: { stroke: '#1a1a1a', strokeWidth: 2 } },
  { id: 'e-orch-guidance',   source: 'orchestrator', target: 'guidance',         animated: false, style: { stroke: '#1a1a1a', strokeWidth: 2 } },
  { id: 'e-orch-dispatch',   source: 'orchestrator', target: 'dispatch',         animated: false, style: { stroke: '#1a1a1a', strokeWidth: 2 } },
  { id: 'e-orch-contact',    source: 'orchestrator', target: 'contact',          animated: false, style: { stroke: '#1a1a1a', strokeWidth: 2 } },
  { id: 'e-orch-handover',   source: 'orchestrator', target: 'handover',         animated: false, style: { stroke: '#1a1a1a', strokeWidth: 2 } },
];

type AgentStatus = 'idle' | 'working' | 'completed' | 'failed' | 'escalated';

function AgentNode({ data }: NodeProps) {
  const bgMap: Record<AgentStatus, string> = {
    idle:      '#f7f6f2',
    working:   `${data.color}15`,
    completed: '#e5f4ec',
    failed:    '#fbe9e9',
    escalated: '#fdf2e5',
  };
  const borderMap: Record<AgentStatus, string> = {
    idle:      '#d0cfc9',
    working:   data.color,
    completed: '#006e3a',
    failed:    '#c50000',
    escalated: '#b55900',
  };

  const status = (data.status as AgentStatus) ?? 'idle';

  return (
    <div style={{
      background: bgMap[status],
      border: `2px solid ${borderMap[status]}`,
      padding: '10px 14px',
      minWidth: 140,
      fontFamily: "'Geist Mono', ui-monospace, monospace",
      transition: 'all 0.3s ease',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          width: 7, height: 7,
          background: borderMap[status],
          display: 'inline-block',
          flexShrink: 0,
          ...(status === 'working' ? { animation: 'pulse-dot 1.2s infinite' } : {}),
        }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: data.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {data.label}
        </span>
      </div>
      <p style={{ fontSize: 10, color: '#888680', lineHeight: 1.4 }}>{data.sub}</p>
      {data.lastMessage && (
        <div style={{
          marginTop: 6, padding: '3px 6px',
          background: '#eeede8', border: '1px solid #d0cfc9',
          fontSize: 9, color: '#3a3a3a', lineHeight: 1.4,
          maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {data.lastMessage}
        </div>
      )}
    </div>
  );
}

interface AgentSwarmGraphProps {
  workflowId: string;
  onReasoningEvent?: (event: any) => void;
}

/** Maps raw agent name strings arriving via SSE to graph node IDs */
function agentNameToId(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes('orchestrator'))         return 'orchestrator';
  if (n.includes('incident'))             return 'incident';
  if (n.includes('triage'))               return 'triage';
  if (n.includes('hospitalmatching') || n.includes('hospital')) return 'hospitalmatching';
  if (n.includes('dispatch'))             return 'dispatch';
  if (n.includes('contact'))              return 'contact';
  if (n.includes('guidance'))             return 'guidance';
  if (n.includes('handover'))             return 'handover';
  if (n.includes('audit'))               return 'audit';
  return null;
}

export default function AgentSwarmGraph({ workflowId, onReasoningEvent }: AgentSwarmGraphProps) {
  const nodeTypes = useMemo(() => ({ agentNode: AgentNode }), []);
  const [messageCount, setMessageCount] = useState(0);

  const getInitialNodes = useCallback((): Node[] =>
    AGENTS.map(a => ({
      id: a.id,
      type: 'agentNode',
      position: { x: a.x, y: a.y },
      data: { label: a.label, sub: a.sub, color: a.color, status: 'idle', lastMessage: '' },
      draggable: true,
    })), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(getInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  const pulseEdge = useCallback((fromId: string | null, toId: string | null) => {
    if (!fromId || !toId) return;
    const agentColor = AGENTS.find(a => a.id === fromId)?.color ?? '#0047e1';

    // Try canonical edge id in both directions
    const possibleIds = [
      `e-${fromId}-${toId}`,
      `e-${toId}-${fromId}`,
      `e-${[fromId, toId].sort().join('-')}`,
    ];

    setEdges(eds => eds.map(e => {
      if (!possibleIds.includes(e.id)) return e;
      return { ...e, animated: true, style: { ...e.style, stroke: agentColor, strokeWidth: 3 } };
    }));

    setTimeout(() => {
      setEdges(eds => eds.map(e => {
        if (!possibleIds.includes(e.id)) return e;
        return { ...e, animated: false, style: { ...e.style, stroke: '#d0cfc9', strokeWidth: 1 } };
      }));
    }, 2500);
  }, [setEdges]);

  const updateAgent = useCallback((agentId: string, status: AgentStatus, message?: string) => {
    setNodes(nds => nds.map(n =>
      n.id === agentId
        ? { ...n, data: { ...n.data, status, lastMessage: message ?? n.data.lastMessage } }
        : n
    ));
  }, [setNodes]);

  useEffect(() => {
    if (!workflowId) return;
    const es = new EventSource(`http://localhost:4000/api/workflows/${workflowId}/stream`);

    es.addEventListener('a2a_message', e => {
      const d = JSON.parse(e.data);
      const fromId = agentNameToId(d.from ?? '');
      const toId   = agentNameToId(d.to ?? '');
      setMessageCount(c => c + 1);
      pulseEdge(fromId, toId);
      if (toId) updateAgent(toId, 'working', d.message?.slice(0, 50) ?? 'Receiving task…');
    });

    es.addEventListener('task_status_update', e => {
      const d = JSON.parse(e.data);
      const agentId = agentNameToId(d.agent ?? d.to ?? '');
      if (!agentId) return;
      const sm: Record<string, AgentStatus> = {
        completed: 'completed', failed: 'failed',
        working: 'working', submitted: 'working', canceled: 'idle',
        in_progress: 'working', pending: 'idle',
      };
      updateAgent(agentId, sm[d.status] ?? 'idle', d.progressMessage);
    });

    es.addEventListener('agent_reasoning', e => {
      const d = JSON.parse(e.data);
      const agentId = agentNameToId(d.agent ?? '');
      if (agentId) updateAgent(agentId, 'working', `Reasoning: ${d.decision?.slice(0, 35)}`);
      onReasoningEvent?.(d);
    });

    es.addEventListener('agent_escalation', e => {
      const d = JSON.parse(e.data);
      const agentId = agentNameToId(d.agent ?? '');
      if (agentId) updateAgent(agentId, 'escalated', `Escalated: ${d.reason?.slice(0, 35)}`);
    });

    es.addEventListener('audit_log', e => {
      const d = JSON.parse(e.data);
      const agentId = agentNameToId(d.agent ?? '');
      if (!agentId) return;
      const action = (d.action ?? '').toLowerCase();
      if (action.includes('complet')) updateAgent(agentId, 'completed', d.action);
      else if (action.includes('started') || action.includes('invoking') || action.includes('planning'))
        updateAgent(agentId, 'working', d.action);
      else if (action.includes('fail')) updateAgent(agentId, 'failed', d.action);
    });

    return () => es.close();
  }, [workflowId, pulseEdge, updateAgent, onReasoningEvent]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Top-left info strip */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '2px 8px', border: '1.5px solid var(--c-violet)',
          color: 'var(--c-violet)', background: 'var(--c-violet-bg)', fontFamily: 'inherit',
        }}>Live A2A Graph</span>
        {messageCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '2px 8px', border: '1.5px solid var(--c-cobalt)',
            color: 'var(--c-cobalt)', background: 'var(--c-cobalt-bg)', fontFamily: 'inherit',
          }}>{messageCount} msgs</span>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#eeede8' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d0cfc9" />
        <Controls style={{ background: '#f7f6f2', border: '1px solid #d0cfc9', boxShadow: 'none' }} showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
