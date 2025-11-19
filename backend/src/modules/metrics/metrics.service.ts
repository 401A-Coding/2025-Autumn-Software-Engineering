import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly enabled =
    (process.env.METRICS_ENABLED || 'false') === 'true';
  private readonly registry = new Registry();

  private movesTotal?: Counter;
  private waitingTtlCleanedTotal?: Counter;
  private disconnectTtlTriggeredTotal?: Counter;

  onModuleInit() {
    if (!this.enabled) return;
    collectDefaultMetrics({ register: this.registry });
    this.movesTotal = new Counter({
      name: 'battles_moves_total',
      help: 'Total number of moves applied',
      registers: [this.registry],
    });
    this.waitingTtlCleanedTotal = new Counter({
      name: 'battles_waiting_ttl_cleaned_total',
      help: 'Number of waiting rooms cleaned by TTL',
      registers: [this.registry],
    });
    this.disconnectTtlTriggeredTotal = new Counter({
      name: 'battles_disconnect_ttl_triggered_total',
      help: 'Number of games ended by disconnect TTL (draw)',
      registers: [this.registry],
    });
  }

  isEnabled() {
    return this.enabled;
  }

  getContentType() {
    return this.registry.contentType;
  }

  async getMetricsText() {
    return this.registry.metrics();
  }

  incMoves() {
    this.movesTotal?.inc();
  }
  incWaitingTtlCleaned() {
    this.waitingTtlCleanedTotal?.inc();
  }
  incDisconnectTtlTriggered() {
    this.disconnectTtlTriggeredTotal?.inc();
  }
}
