const HOOK_EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'AIResponseGenerated', 'ErrorOccurred', 'PermissionDenied', 'PermissionGranted',
  'ContextWindowOptimized', 'CostThresholdReached', 'ModelSwitched',
  'CompactTriggered', 'SessionSaved', 'ToolRegistered', 'PluginLoaded',
  'WorkerSpawned', 'WorkerCompleted', 'SwarmMessage', 'ProjectCreated',
];

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({ hooks: [], eventTypes: HOOK_EVENTS });
  }
  if (req.method === 'POST') {
    return res.json({ id: `hook_${Date.now()}`, status: 'registered' });
  }
  res.status(405).json({ error: 'Method not allowed' });
}
