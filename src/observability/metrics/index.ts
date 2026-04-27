export interface Metrics {
  requestsTotal: number;
  requestsSuccess: number;
  requestsFailed: number;
  avgLatencyMs: number;
  avgTokens: number;
  totalCost: number;
}

export class MetricsCollector {
  private metrics: Metrics = {
    requestsTotal: 0,
    requestsSuccess: 0,
    requestsFailed: 0,
    avgLatencyMs: 0,
    avgTokens: 0,
    totalCost: 0,
  };

  recordRequest(success: boolean, latencyMs: number, tokens: number, cost: number): void {
    this.metrics.requestsTotal++;
    if (success) {
      this.metrics.requestsSuccess++;
    } else {
      this.metrics.requestsFailed++;
    }

    const total = this.metrics.requestsTotal;
    this.metrics.avgLatencyMs = (this.metrics.avgLatencyMs * (total - 1) + latencyMs) / total;
    this.metrics.avgTokens = (this.metrics.avgTokens * (total - 1) + tokens) / total;
    this.metrics.totalCost += cost;
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      requestsTotal: 0,
      requestsSuccess: 0,
      requestsFailed: 0,
      avgLatencyMs: 0,
      avgTokens: 0,
      totalCost: 0,
    };
  }
}

export const metrics = new MetricsCollector();