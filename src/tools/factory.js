/**
 * Tool Factory — Provides standard defaults and building logic
 * to avoid circular dependencies in the tool registry.
 */

export const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isDestructive: () => false,
  checkPermissions: async (input) => ({ behavior: 'allow', updatedInput: input }),
};

export function buildTool(def) {
  return { ...TOOL_DEFAULTS, ...def };
}
