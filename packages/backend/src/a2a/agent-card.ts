import { AgentCard, Capability } from './types';
import { Router } from 'express';

/**
 * Registry of statically defined Agent Cards for the system.
 * During startup, agents will register their cards here.
 */
class AgentCardRegistry {
  private cards: Map<string, AgentCard> = new Map();

  /**
   * Register a new agent card.
   */
  public registerCard(card: AgentCard): void {
    this.cards.set(card.name, card);
  }

  /**
   * Retrieve a specific agent card by name.
   */
  public getCard(name: string): AgentCard | undefined {
    return this.cards.get(name);
  }

  /**
   * Retrieve all registered agent cards.
   */
  public getAllCards(): AgentCard[] {
    return Array.from(this.cards.values());
  }

  /**
   * Lookup agents that possess a specific capability by name.
   */
  public findAgentsByCapability(capabilityName: string): AgentCard[] {
    return this.getAllCards().filter(card => 
      card.capabilities.some(cap => cap.name === capabilityName)
    );
  }
}

export const agentCardRegistry = new AgentCardRegistry();

/**
 * Express middleware/router to serve /.well-known/agent.json
 * This fulfills standard A2A discovery protocols.
 */
export const agentDiscoveryRouter = Router();

// Endpoint for the Orchestrator to discover ALL available agents
agentDiscoveryRouter.get('/.well-known/agents.json', (req, res) => {
  res.json({
    agents: agentCardRegistry.getAllCards()
  });
});

// Endpoint to discover a specific agent's card
agentDiscoveryRouter.get('/a2a/:agentName/.well-known/agent.json', (req, res) => {
  const card = agentCardRegistry.getCard(req.params.agentName);
  if (!card) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(card);
});
