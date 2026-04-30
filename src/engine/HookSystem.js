/**
 * HookSystem — Event-driven architecture for AI lifecycle interception.
 * Inspired by ia/architecture/05-hook-system.md
 */
export class HookSystem {
  constructor() {
    this.hooks = new Map();
  }

  /**
   * Register a hook for a specific event.
   * @param {string} event - Event name (e.g., 'onTurnStart', 'onTurnEnd', 'onToolUse')
   * @param {Function} callback - Async function to execute
   */
  register(event, callback) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event).push(callback);
  }

  /**
   * Execute all hooks for an event.
   * @param {string} event - Event name
   * @param {Object} context - Context object passed to hooks
   */
  async execute(event, context) {
    const eventHooks = this.hooks.get(event) || [];
    const results = [];
    
    for (const hook of eventHooks) {
      try {
        const result = await hook(context);
        if (result) results.push(result);
      } catch (err) {
        console.error(`[HookSystem] Error in hook for event ${event}:`, err);
      }
    }
    
    return results;
  }
}

export const globalHooks = new HookSystem();
