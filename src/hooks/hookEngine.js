/**
 * Hook System — 20 event types for lifecycle interception.
 * Inspired by Claude Code's hook system (doc 05).
 *
 * Events: PreToolUse, PostToolUse, SessionStart, SessionEnd,
 *         UserPromptSubmit, PermissionDenied, ConfigChange, etc.
 */
export class HookEngine {
  constructor() {
    this.hooks = new Map();
    this.EVENT_TYPES = [
      'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
      'SessionStart', 'SessionEnd', 'Setup',
      'PermissionDenied', 'PermissionRequest',
      'SubagentStart', 'SubagentStop', 'TeammateIdle',
      'UserPromptSubmit', 'ConfigChange', 'CwdChanged',
      'FileChanged', 'InstructionsLoaded',
      'TaskCreated', 'TaskCompleted',
      'StatusLine', 'Stop',
    ];

    // Initialize all event types
    for (const event of this.EVENT_TYPES) {
      this.hooks.set(event, []);
    }
  }

  /**
   * Register a hook for a specific event.
   */
  register(event, hook) {
    if (!this.hooks.has(event)) {
      throw new Error(`Unknown hook event: ${event}. Valid events: ${this.EVENT_TYPES.join(', ')}`);
    }

    const hookEntry = {
      id: `hook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event,
      matcher: hook.matcher || '*',
      type: hook.type || 'function',
      handler: hook.handler || hook.callback,
      command: hook.command,
      url: hook.url,
      enabled: hook.enabled !== false,
      description: hook.description || '',
      createdAt: Date.now(),
    };

    this.hooks.get(event).push(hookEntry);
    return hookEntry.id;
  }

  /**
   * Unregister a hook by ID.
   */
  unregister(hookId) {
    for (const [event, hooks] of this.hooks) {
      const idx = hooks.findIndex(h => h.id === hookId);
      if (idx !== -1) {
        hooks.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Run all hooks for a given event.
   * Aggregation: deny > allow, any deny wins.
   */
  async run(event, context = {}) {
    const hooks = this.hooks.get(event) || [];
    const matchingHooks = hooks.filter(h => h.enabled && this.matchesHook(h, context));

    if (matchingHooks.length === 0) return { continue: true };

    const results = [];
    let overallDecision = null;

    for (const hook of matchingHooks) {
      try {
        let result;

        if (hook.type === 'function' && hook.handler) {
          result = await hook.handler(context);
        } else if (hook.type === 'http' && hook.url) {
          result = await this.executeHttpHook(hook, context);
        } else if (hook.type === 'command' && hook.command) {
          result = await this.executeCommandHook(hook, context);
        }

        if (result) {
          results.push(result);

          // Aggregate permission decisions (deny > allow)
          if (result.permissionDecision === 'deny') {
            overallDecision = 'deny';
          } else if (result.permissionDecision === 'allow' && overallDecision !== 'deny') {
            overallDecision = 'allow';
          }

          if (result.continue === false) {
            return { continue: false, results, decision: 'stop' };
          }
        }
      } catch (err) {
        console.error(`[HookEngine] Hook ${hook.id} failed:`, err.message);
        results.push({ error: err.message, hookId: hook.id });
      }
    }

    return {
      continue: true,
      results,
      decision: overallDecision,
    };
  }

  /**
   * Check if a hook matches the given context.
   */
  matchesHook(hook, context) {
    if (hook.matcher === '*') return true;

    // Tool name matching: "Bash", "Bash(git *)", "FileWrite"
    if (context.tool) {
      if (hook.matcher === context.tool) return true;

      const match = hook.matcher.match(/^(\w+)\((.+)\)$/);
      if (match) {
        const [, toolName, pattern] = match;
        if (toolName !== context.tool) return false;

        // Simple glob matching
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        const inputStr = typeof context.input === 'string'
          ? context.input
          : JSON.stringify(context.input || {});
        return regex.test(inputStr);
      }
    }

    return false;
  }

  async executeHttpHook(hook, context) {
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });
      return await res.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  async executeCommandHook(hook, context) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(hook.command, {
        timeout: 10000,
        env: { ...process.env, NEXUS_HOOK_INPUT: JSON.stringify(context) },
      });
      try {
        return JSON.parse(stdout.trim());
      } catch {
        return { message: stdout.trim() };
      }
    } catch (err) {
      if (err.code === 2) {
        return { continue: false, error: err.stderr };
      }
      return { error: err.message };
    }
  }

  /**
   * Get all registered hooks.
   */
  getAllHooks() {
    const allHooks = [];
    for (const [event, hooks] of this.hooks) {
      for (const hook of hooks) {
        allHooks.push({ ...hook, event });
      }
    }
    return allHooks;
  }

  /**
   * Get hooks for a specific event.
   */
  getHooksForEvent(event) {
    return [...(this.hooks.get(event) || [])];
  }

  /**
   * Get all event types.
   */
  getEventTypes() {
    return [...this.EVENT_TYPES];
  }
}
