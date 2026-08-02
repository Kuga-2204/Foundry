export class Agent {
  constructor({ name, instructions, run }) {
    if (!name || typeof run !== "function") throw new Error("Agent needs a name and run function.");
    this.name = name;
    this.instructions = instructions || "";
    this.run = run;
  }

  async execute(context) {
    const startedAt = Date.now();
    const output = await this.run({ ...context, agent: this });
    return {
      context: output,
      trace: {
        agent: this.name,
        instructions: this.instructions,
        duration_ms: Date.now() - startedAt,
      },
    };
  }
}

export class AgentWorkflow {
  constructor({ name, agents }) {
    if (!name || !Array.isArray(agents) || agents.length === 0) {
      throw new Error("AgentWorkflow needs a name and at least one agent.");
    }
    this.name = name;
    this.agents = agents;
  }

  async run(initialContext = {}) {
    let context = { ...initialContext };
    const trace = [];
    for (const agent of this.agents) {
      const result = await agent.execute(context);
      context = result.context;
      trace.push(result.trace);
    }
    return { ...context, trace: { workflow: this.name, steps: trace } };
  }
}