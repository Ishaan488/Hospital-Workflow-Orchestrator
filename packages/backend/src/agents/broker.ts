import { EventEmitter } from 'events';
import { db } from '../db/connection';
import { auditLogs } from '../db/schema';
import { randomUUID } from 'crypto';

/**
 * Standardized payload for Agent-to-Agent communication.
 */
export interface AgentMessage<T = any> {
  id: string;
  topic: string; // The event channel, e.g., 'workflow.patient.arrived'
  source: string; // The name of the agent sending the message
  target?: string; // Optional: specify a target agent (Point-to-Point)
  payload: T;
  timestamp: string;
  workflowId?: string; // Optional: tie the message to a specific workflow instance
  taskId?: string; // Optional: tie the message to a specific task
}

/**
 * In-Memory Pub/Sub Message Broker using Node's EventEmitter.
 * Used for the Proof-of-Concept to allow decoupled Agent communication.
 */
class AgentBroker {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Allow many agents to listen without warnings
    this.emitter.setMaxListeners(50);
  }

  /**
   * Publish a message to all agents subscribed to the topic.
   */
  public async publish<T>(
    topic: string,
    source: string,
    payload: T,
    options?: { target?: string; workflowId?: string; taskId?: string }
  ): Promise<void> {
    const message: AgentMessage<T> = {
      id: randomUUID(),
      topic,
      source,
      payload,
      timestamp: new Date().toISOString(),
      ...options,
    };

    // 1. Emit the event asynchronously to avoid blocking the sender
    setImmediate(() => {
      this.emitter.emit(topic, message);
      // Also emit a catch-all for systemic logging
      this.emitter.emit('*', message);
    });

    // 2. Intercept and log cross-agent messages automatically
    try {
      await db.insert(auditLogs).values({
        workflowId: message.workflowId,
        taskId: message.taskId,
        agent: 'BrokerSystem',
        action: `Message Published: ${topic}`,
        details: {
          messageId: message.id,
          source: message.source,
          target: message.target,
          payload: message.payload,
        },
      });
      console.log(`[BROKER] ${source} published to [${topic}]`);
    } catch (err) {
      console.error('[BROKER ERROR] Failed to log message to database:', err);
    }
  }

  /**
   * Subscribe an agent to a specific topic.
   */
  public subscribe<T>(
    topic: string,
    agentName: string,
    handler: (message: AgentMessage<T>) => Promise<void> | void
  ): void {
    // We wrap the handler to respect point-to-point targeting 
    // and catch unhandled promise rejections inside handlers.
    const wrappedHandler = async (message: AgentMessage<T>) => {
      // If message has a target that isn't us, ignore it.
      if (message.target && message.target !== agentName) {
        return;
      }

      try {
        await handler(message);
      } catch (err) {
        console.error(`[BROKER ERROR] Agent ${agentName} threw error handling topic ${topic}:`, err);
      }
    };

    this.emitter.on(topic, wrappedHandler);
    console.log(`[BROKER] Agent '${agentName}' subscribed to [${topic}]`);
  }

  /**
   * Global listener for systemic debugging (optional).
   */
  public onAny(handler: (message: AgentMessage) => void): void {
    this.emitter.on('*', handler);
  }
}

// Export as a singleton for the POC
export const broker = new AgentBroker();
