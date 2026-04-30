import { globalHooks } from './HookSystem.js';
import { MemoryManager } from './MemoryManager.js';
import { analyticsHook } from '../hooks/AnalyticsHook.js';

/**
 * Registers all system hooks.
 */
export function initHooks() {
  console.log('[HookSystem] Initializing Global Hooks...');

  // 1. Memory Learning Hook
  globalHooks.register('onSessionEnd', async ({ userId, messages }) => {
    if (userId && userId !== 'anonymous') {
      await MemoryManager.updateUserMemory(userId, messages);
    }
  });

  // 2. Business Intelligence Hook
  globalHooks.register('onSessionEnd', async (context) => {
    await analyticsHook(context);
  });
  
  console.log('[HookSystem] Hooks Registered: Memory, Analytics.');
}
