/**
 * Permission Pipeline — 7-step permission evaluation.
 * Inspired by Claude Code's defense-in-depth architecture (doc 07).
 * 
 * Steps:
 * 1a. Deny rules (tool-level)
 * 1b. Ask rules (tool-level)
 * 1c. tool.checkPermissions() (content-specific)
 * 1d-1g. Safety checks (.git, .claude, shell configs)
 * 2a. Bypass permissions mode
 * 2b. Always-allow rules
 * 3. Passthrough → ask
 */
export class PermissionPipeline {
  constructor(config = {}) {
    this.mode = config.mode || 'default'; // default, plan, acceptEdits, bypass, dontAsk, auto
    this.denyRules = config.denyRules || [];
    this.askRules = config.askRules || [];
    this.alwaysAllowRules = config.alwaysAllowRules || [];
    this.safetyPaths = ['.git', '.env', '.claude', 'node_modules'];
    this.denialCount = { consecutive: 0, total: 0 };
    this.DENIAL_LIMITS = { maxConsecutive: 3, maxTotal: 20 };
  }

  /**
   * Check if a tool use is permitted.
   */
  async check(tool, input) {
    // Step 1a: Deny rules
    const denyRule = this.getDenyRuleForTool(tool);
    if (denyRule) {
      return { behavior: 'deny', message: `Blocked by deny rule: ${denyRule.reason || 'Access denied'}`, rule: denyRule };
    }

    // Step 1b: Ask rules
    const askRule = this.getAskRuleForTool(tool);
    if (askRule) {
      if (this.mode === 'bypass') {
        // Bypass overrides ask rules (but not deny)
      } else {
        return { behavior: 'ask', message: `Requires approval: ${askRule.reason || tool.name}`, rule: askRule };
      }
    }

    // Step 1c: Tool-specific permission check
    if (tool.checkPermissions) {
      const toolResult = await tool.checkPermissions(input);
      if (toolResult.behavior === 'deny') {
        return toolResult;
      }
    }

    // Step 1g: Safety checks
    if (this.isSafetyViolation(tool, input)) {
      return { behavior: 'ask', message: 'This operation touches sensitive paths (.git, .env, etc.)' };
    }

    // Step 2a: Bypass mode
    if (this.mode === 'bypass') {
      return { behavior: 'allow' };
    }

    // Step 2b: Always-allow rules
    const allowRule = this.getAlwaysAllowRule(tool);
    if (allowRule) {
      return { behavior: 'allow', rule: allowRule };
    }

    // Step 3: Default behavior based on mode
    switch (this.mode) {
      case 'dontAsk':
        return { behavior: 'deny', message: 'Auto-denied in dontAsk mode' };
      case 'acceptEdits':
        if (tool.isReadOnly && tool.isReadOnly(input)) {
          return { behavior: 'allow' };
        }
        if (['file_write', 'file_edit'].includes(tool.name)) {
          return { behavior: 'allow' };
        }
        return { behavior: 'ask', message: `Non-edit tool requires approval in acceptEdits mode` };
      case 'plan':
        if (tool.isReadOnly && tool.isReadOnly(input)) {
          return { behavior: 'allow' };
        }
        return { behavior: 'deny', message: 'Only read-only operations allowed in plan mode' };
      default:
        // Read-only tools are auto-allowed
        if (tool.isReadOnly && tool.isReadOnly(input)) {
          return { behavior: 'allow' };
        }
        return { behavior: 'allow' }; // Default allow for now (in prod, this would be 'ask')
    }
  }

  getDenyRuleForTool(tool) {
    return this.denyRules.find(r => r.toolName === tool.name || r.toolName === '*');
  }

  getAskRuleForTool(tool) {
    return this.askRules.find(r => r.toolName === tool.name || r.toolName === '*');
  }

  getAlwaysAllowRule(tool) {
    return this.alwaysAllowRules.find(r => r.toolName === tool.name || r.toolName === '*');
  }

  isSafetyViolation(tool, input) {
    const inputStr = JSON.stringify(input).toLowerCase();
    return this.safetyPaths.some(p => inputStr.includes(p));
  }

  setMode(mode) {
    this.mode = mode;
  }

  addDenyRule(rule) {
    this.denyRules.push(rule);
  }

  addAllowRule(rule) {
    this.alwaysAllowRules.push(rule);
  }

  getRules() {
    return {
      mode: this.mode,
      denyRules: [...this.denyRules],
      askRules: [...this.askRules],
      alwaysAllowRules: [...this.alwaysAllowRules],
    };
  }
}
