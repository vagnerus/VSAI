/**
 * AIManager — Central AI Orchestration Engine
 *
 * Responsibilities:
 * - Circuit Breaker: Marks unhealthy providers after consecutive failures
 * - Hallucination Filters: Validates outputs for known hallucination patterns
 * - Telemetry: Tracks latency, token usage, error rates
 * - Provider Health Monitoring
 */

const CIRCUIT_BREAKER_THRESHOLD = 5;  // failures before marking unhealthy
const CIRCUIT_BREAKER_COOLDOWN = 5 * 60 * 1000; // 5 min cooldown
const MAX_RESPONSE_TOKENS = 32000;

/**
 * Known hallucination patterns to detect in AI outputs.
 */
const HALLUCINATION_PATTERNS = [
  /como (um )?modelo de linguagem/i,
  /as an AI (language )?model/i,
  /I (cannot|can't) (actually )?(browse|access|search|connect)/i,
  /eu não (posso|consigo) (navegar|acessar|pesquisar)/i,
  /https?:\/\/(?:www\.)?(?:example|fake|placeholder|test)\.(com|org|net)/i,
  /my (training|knowledge) (data )?(was )?cut ?off/i,
];

export class AIManager {
  constructor() {
    this.providerHealth = new Map(); // provider -> { failures, lastFailure, status }
    this.telemetry = {
      totalRequests: 0,
      totalErrors: 0,
      totalTokens: { input: 0, output: 0 },
      totalLatencyMs: 0,
      providerStats: new Map(),
    };
  }

  /**
   * Check if a provider is healthy (circuit breaker).
   */
  isProviderHealthy(providerName) {
    const health = this.providerHealth.get(providerName);
    if (!health) return true;
    if (health.status === 'unhealthy') {
      // Check if cooldown has passed
      if (Date.now() - health.lastFailure > CIRCUIT_BREAKER_COOLDOWN) {
        health.status = 'recovering';
        health.failures = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  /**
   * Record a provider failure (circuit breaker).
   */
  recordFailure(providerName, error) {
    let health = this.providerHealth.get(providerName);
    if (!health) {
      health = { failures: 0, lastFailure: 0, status: 'healthy' };
      this.providerHealth.set(providerName, health);
    }
    health.failures++;
    health.lastFailure = Date.now();

    if (health.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      health.status = 'unhealthy';
      console.warn(`[AIManager] Circuit breaker OPEN for provider: ${providerName} (${health.failures} consecutive failures)`);
    }

    this.telemetry.totalErrors++;
  }

  /**
   * Record a provider success (resets circuit breaker).
   */
  recordSuccess(providerName) {
    const health = this.providerHealth.get(providerName);
    if (health) {
      health.failures = 0;
      health.status = 'healthy';
    }
    this.telemetry.totalRequests++;
  }

  /**
   * Record token usage for telemetry.
   */
  recordTokenUsage(providerName, inputTokens, outputTokens) {
    this.telemetry.totalTokens.input += inputTokens || 0;
    this.telemetry.totalTokens.output += outputTokens || 0;

    let stats = this.telemetry.providerStats.get(providerName);
    if (!stats) {
      stats = { requests: 0, errors: 0, tokens: { input: 0, output: 0 }, latencyMs: 0 };
      this.telemetry.providerStats.set(providerName, stats);
    }
    stats.tokens.input += inputTokens || 0;
    stats.tokens.output += outputTokens || 0;
  }

  /**
   * Check AI output for hallucination patterns.
   * Returns { isClean: boolean, warnings: string[] }
   */
  checkHallucinations(text) {
    if (!text || typeof text !== 'string') return { isClean: true, warnings: [] };

    const warnings = [];
    for (const pattern of HALLUCINATION_PATTERNS) {
      if (pattern.test(text)) {
        warnings.push(`Hallucination pattern detected: ${pattern.source.substring(0, 50)}...`);
      }
    }

    // Check for excessive repetition (sign of degenerate output)
    const sentences = text.split(/[.!?\n]/).filter(s => s.trim().length > 10);
    if (sentences.length > 5) {
      const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
      const repetitionRatio = 1 - (uniqueSentences.size / sentences.length);
      if (repetitionRatio > 0.5) {
        warnings.push(`High repetition ratio detected: ${(repetitionRatio * 100).toFixed(0)}%`);
      }
    }

    return {
      isClean: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Get provider health status for monitoring.
   */
  getHealthReport() {
    const report = {};
    for (const [provider, health] of this.providerHealth) {
      report[provider] = {
        status: health.status,
        failures: health.failures,
        lastFailure: health.lastFailure ? new Date(health.lastFailure).toISOString() : null,
      };
    }
    return {
      providers: report,
      telemetry: {
        totalRequests: this.telemetry.totalRequests,
        totalErrors: this.telemetry.totalErrors,
        totalTokens: { ...this.telemetry.totalTokens },
        errorRate: this.telemetry.totalRequests > 0
          ? (this.telemetry.totalErrors / this.telemetry.totalRequests * 100).toFixed(2) + '%'
          : '0%',
      },
    };
  }

  /**
   * Reset telemetry counters.
   */
  resetTelemetry() {
    this.telemetry.totalRequests = 0;
    this.telemetry.totalErrors = 0;
    this.telemetry.totalTokens = { input: 0, output: 0 };
    this.telemetry.totalLatencyMs = 0;
    this.telemetry.providerStats.clear();
  }
}

// Singleton
export const aiManager = new AIManager();
