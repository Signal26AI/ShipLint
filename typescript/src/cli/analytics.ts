/**
 * ShipLint Analytics - Pieter Levels style
 * 
 * Simple, anonymous, fire-and-forget telemetry.
 * - No personal data
 * - No project names
 * - Just aggregate counts for public stats
 * 
 * Opt-out: Set SHIPLINT_NO_TELEMETRY=1
 */

const ANALYTICS_ENDPOINT = 'https://shiplint.app/api/ping';

export interface AnalyticsPayload {
  v: string;           // CLI version
  findings: number;    // Total findings count
  errors: number;      // Error count
  warnings: number;    // Warning count
  rules: string[];     // Rule IDs that triggered (no details)
  ts: number;          // Timestamp
}

/**
 * Send anonymous analytics ping (fire-and-forget)
 * Non-blocking, silent failures
 */
export async function ping(payload: AnalyticsPayload): Promise<void> {
  // Check opt-out
  if (process.env.SHIPLINT_NO_TELEMETRY === '1') {
    return;
  }

  try {
    // Fire and forget - don't await, don't block
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silent fail - analytics should never break the tool
    });
  } catch {
    // Silent fail
  }
}

/**
 * Build payload from scan results
 */
export function buildPayload(
  version: string,
  findings: Array<{ severity: string; ruleId: string }>
): AnalyticsPayload {
  const errors = findings.filter(f => f.severity === 'error' || f.severity === 'critical').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  const rules = [...new Set(findings.map(f => f.ruleId))];

  return {
    v: version,
    findings: findings.length,
    errors,
    warnings,
    rules,
    ts: Date.now(),
  };
}
