'use client';
import ReactFlow, {
  Node, Edge, Background, Controls,
  useNodesState, useEdgesState,
  BackgroundVariant, Handle, Position,
  NodeProps,
} from 'reactflow';
import { useEffect, useCallback, useState } from 'react';
import 'reactflow/dist/style.css';

// ─── Agent definitions (static layout) ──────────────────────────────────────
const AGENTS = [
  { id: 'orchestrator', label: 'Orchestrator', sub: 'Gemini-Powered Planner', color: '#a78bfa', x: 340, y: 160 },
  { id: 'intake', label: 'Intake Agent', sub: 'EHR + Document Check', color: '#38bdf8', x: 60, y: 60 },
  { id: 'insurance', label: 'Insurance Agent', sub: 'Eligibility + Pre-Auth', color: '#22d3ee', x: 620, y: 60 },
  { id: 'scheduling', label: 'Scheduling Agent', sub: 'Slots + Reschedule', color: '#34d399', x: 60, y: 300 },
  { id: 'communication', label: 'Communication Agent', sub: 'SMS + Email + Tasks', color: '#fbbf24', x: 620, y: 300 },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e-orch-intake', source: 'orchestrator', target: 'intake', animated: false, style: { stroke: 'rgba(99,179,237,0.15)', strokeWidth: 2 } },
  { id: 'e-orch-insurance', source: 'orchestrator', target: 'insurance', animated: false, style: { stroke: 'rgba(99,179,237,0.15)', strokeWidth: 2 } },
  { id: 'e-orch-scheduling', source: 'orchestrator', target: 'scheduling', animated: false, style: { stroke: 'rgba(99,179,237,0.15)', strokeWidth: 2 } },
  { id: 'e-orch-communication', source: 'orchestrator', target: 'communication', animated: false, style: { stroke: 'rgba(99,179,237,0.15)', strokeWidth: 2 } },
  { id: 'e-intake-insurance', source: 'intake', target: 'insurance', animated: false, style: { stroke: 'rgba(99,179,237,0.08)', strokeWidth: 1, strokeDasharray: '4 4' } },
  { id: 'e-insurance-scheduling', source: 'insurance', target: 'scheduling', animated: false, style: { stroke: 'rgba(99,179,237,0.08)', strokeWidth: 1, strokeDasharray: '4 4' } },
  { id: 'e-intake-communication', source: 'intake', target: 'communication', animated: false, style: { stroke: 'rgba(99,179,237,0.08)', strokeWidth: 1, strokeDasharray: '4 4' } },
];

type AgentStatus = 'idle' | 'working' | 'completed' | 'failed' | 'escalated';

// ─── Custom Agent Node ────────────────────────────────────────────────────────
function AgentNode({ data }: NodeProps) {
  const statusColors: Record<AgentStatus, string> = {
    idle: 'rgba(255,255,255,0.06)',
    working: `${data.color}18`,
    completed: 'rgba(52,211,153,0.1)',
    failed: 'rgba(248,113,113,0.1)',
    escalated: 'rgba(251,191,36,0.1)',
  };
  const borderColors: Record<AgentStatus, string> = {
    idle: 'rgba(99,179,237,0.12)',
    working: `${data.color}50`,
    completed: 'rgba(52,211,153,0.4)',
    failed: 'rgba(248,113,113,0.4)',
    escalated: 'rgba(251,191,36,0.4)',
  };
  const dotColors: Record<AgentStatus, string> = {
    idle: '#4a7a9b',
    working: data.color,
    completed: '#34d399',
    failed: '#f87171',
    escalated: '#fbbf24',
  };

  return (
    <div style={{
      background: statusColors[data.status as AgentStatus] ?? statusColors.idle,
      border: `1.5px solid ${borderColors[data.status as AgentStatus] ?? borderColors.idle}`,
      borderRadius: 14,
      padding: '12px 16px',
      minWidth: 160,
      backdropFilter: 'blur(10px)',
      boxShadow: data.status === 'working'
        ? `0 0 20px ${data.color}40, 0 4px 16px rgba(0,0,0,0.4)`
        : '0 4px 16px rgba(0,0,0,0.4)',
      transition: 'all 0.4s ease',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      <div className="flex items-center gap-2 mb-1">
        <div
          className={data.status === 'working' ? 'pulse-ring' : ''}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: dotColors[data.status as AgentStatus] ?? dotColors.idle,
            boxShadow: data.status === 'working' ? `0 0 8px ${data.color}` : 'none',
            animation: data.status === 'working' ? 'dot-working 1.2s ease-in-out infinite' : 'none',
            flexShrink: 0, position: 'relative',
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: data.color }}>{data.label}</span>
      </div>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{data.sub}</p>

      {data.lastMessage && (
        <div style={{
          marginTop: 8,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.3)',
          fontSize: 9,
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.4,
          maxWidth: 150,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.lastMessage}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { agentNode: AgentNode };

// ─── Main Component ───────────────────────────────────────────────────────────
interface AgentSwarmGraphProps {
  workflowId: string;
  onReasoningEvent?: (event: any) => void;
}

export default function AgentSwarmGraph({ workflowId, onReasoningEvent }: AgentSwarmGraphProps) {
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>(
    Object.fromEntries(AGENTS.map(a => [a.id, 'idle']))
  );
  const [agentMessages, setAgentMessages] = useState<Record<string, string>>({});
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set());
  const [messageCount, setMessageCount] = useState(0);
  // MCP X-Ray: tracks the currently active tool call per agent
  const [mcpTooltip, setMcpTooltip] = useState<{ agentId: string; label: string } | null>(null);

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

  // Map agent names (from SSE) to node IDs
  const agentNameToId = (name: string): string | null => {
    const n = name.toLowerCase();
    if (n.includes('orchestrator')) return 'orchestrator';
    if (n.includes('intake')) return 'intake';
    if (n.includes('insurance')) return 'insurance';
    if (n.includes('scheduling')) return 'scheduling';
    if (n.includes('communication')) return 'communication';
    return null;
  };

  // Pulse an edge when a message travels along it
  const pulseEdge = useCallback((fromId: string | null, toId: string | null) => {
    if (!fromId || !toId) return;
    const edgeId = `e-${[fromId, toId].sort().join('-')}` ;
    const reverseId = `e-${toId}-${fromId}`;
    const matchId = edges.find(e => e.id === edgeId || e.id === reverseId)?.id;
    if (!matchId) return;

    setEdges(eds => eds.map(e => e.id === matchId
      ? { ...e, animated: true, style: { ...e.style, stroke: AGENTS.find(a => a.id === fromId)?.color ?? '#38bdf8', strokeWidth: 3 } }
      : e
    ));

    // Reset after 2s
    setTimeout(() => {
      setEdges(eds => eds.map(e => e.id === matchId
        ? { ...e, animated: false, style: { ...e.style, stroke: 'rgba(99,179,237,0.15)', strokeWidth: 2 } }
        : e
      ));
    }, 2000);
  }, [edges, setEdges]);

  // Update a node's status and message
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
      const fromId = agentNameToId(d.from);
      const toId = agentNameToId(d.to);
      setMessageCount(c => c + 1);
      pulseEdge(fromId, toId);
      if (toId) updateAgent(toId, 'working', d.message?.slice(0, 40) ?? '');
    });

    es.addEventListener('task_status_update', e => {
      const d = JSON.parse(e.data);
      const agentId = agentNameToId(d.agent ?? d.to ?? '');
      if (!agentId) return;
      const statusMap: Record<string, AgentStatus> = {
        completed: 'completed', failed: 'failed', working: 'working',
        submitted: 'working', canceled: 'idle',
      };
      updateAgent(agentId, statusMap[d.status] ?? 'idle', d.progressMessage);
    });

    es.addEventListener('agent_reasoning', e => {
      const d = JSON.parse(e.data);
      const agentId = agentNameToId(d.agent ?? '');
      if (agentId) updateAgent(agentId, 'working', `Reasoning: ${d.decision?.slice(0, 30)}`);
      onReasoningEvent?.(d);
    });

    es.addEventListener('agent_escalation', e => {
      const d = JSON.parse(e.data);
      const agentId = agentNameToId(d.agent ?? '');
      if (agentId) updateAgent(agentId, 'escalated', `🚨 Escalated: ${d.reason?.slice(0, 30)}`);
    });

    // MCP X-Ray: show which tool each agent is calling in real-time
    es.addEventListener('mcp_tool_call', e => {
      const d = JSON.parse(e.data);
      const agentId = agentNameToId(d.agent ?? '');
      if (!agentId) return;
      // SSE payload: { agent, server, tool, durationMs, success }
      const toolPath = d.server && d.tool ? `${d.server}.${d.tool}` : (d.tool ?? 'unknown');
      const statusIcon = d.success === false ? '❌' : '✓';
      const toolLabel = `${statusIcon} ${toolPath}`;
      setMcpTooltip({ agentId, label: toolLabel });
      // Auto-dismiss after 3 seconds
      setTimeout(() => setMcpTooltip(null), 3000);
    });

    es.addEventListener('audit_log', e => {
      const d = JSON.parse(e.data);
      const agentId = agentNameToId(d.agent ?? '');
      if (!agentId) return;
      if (d.action?.toLowerCase().includes('complet')) updateAgent(agentId, 'completed');
      else if (d.action?.toLowerCase().includes('started')) updateAgent(agentId, 'working', d.action);
    });

    return () => es.close();
  }, [workflowId, pulseEdge, updateAgent, onReasoningEvent]);

  return (
    <div className="relative w-full" style={{ height: 420, borderRadius: 14, overflow: 'hidden', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="badge badge-violet" style={{ fontSize: 10 }}>Live A2A Graph</span>
        {messageCount > 0 && (
          <span className="badge badge-blue" style={{ fontSize: 10 }}>
            {messageCount} messages
          </span>
        )}
      </div>

      {/* MCP X-Ray Tooltip — appears when an agent calls a tool */}
      {mcpTooltip && (
        <div
          className="absolute top-3 right-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{
            background: 'rgba(15,20,40,0.92)',
            border: '1px solid rgba(167,139,250,0.5)',
            boxShadow: '0 0 16px rgba(167,139,250,0.25)',
            fontSize: 11,
            color: '#c4b5fd',
            fontFamily: 'monospace',
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.2s ease',
            maxWidth: 260,
          }}
        >
          <span style={{ opacity: 0.6, marginRight: 2 }}>MCP X-Ray</span>
          <span style={{ fontWeight: 700 }}>{mcpTooltip.label}</span>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(99,179,237,0.06)" />
        <Controls
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
