/**
 * Agent-to-Agent (A2A) Protocol Types
 * Strictly implements the standard A2A protocol specifications.
 */

// Represents the functional capabilities of an agent
export interface Capability {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
}

// Represents the discoverable profile of an agent
export interface AgentCard {
  name: string;
  description: string;
  capabilities: Capability[];
  endpointUrl: string; // Resolvable URL to reach this agent
  version?: string;
}

// Enum defining standard task states
export type TaskStatus = 
  | 'submitted' 
  | 'working' 
  | 'input-required' 
  | 'completed' 
  | 'failed' 
  | 'canceled';

// Represents a structured message part
export interface MessagePart {
  type: 'text' | 'data' | 'file';
  text?: string;
  data?: Record<string, any>;
  fileUrl?: string;
  mimeType?: string;
}

// Represents a distinct message inside a task thread
export interface Message {
  id: string;
  role: 'agent' | 'user' | 'system';
  parts: MessagePart[];
  timestamp: Date;
}

// The core A2A Task object
export interface A2ATask {
  id: string;                 // Unique identifier for the task run
  workflowId?: string;        // The parent workflow orchestrating this
  fromAgent: string;          // Source agent sending the task
  toAgent: string;            // Target agent responsible for the task
  status: TaskStatus;
  inputMessage: Message;      // Initial instruction
  outputMessage?: Message;    // Final result
  artifacts?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Used for streaming updates back to the sender
export interface TaskStatusUpdate {
  taskId: string;
  status: TaskStatus;
  progressMessage?: string;
  updatedAt: Date;
}
