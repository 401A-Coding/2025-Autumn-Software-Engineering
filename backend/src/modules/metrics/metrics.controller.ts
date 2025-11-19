import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('/metrics')
  async getMetrics(@Res() res: Response) {
    if (!this.metrics.isEnabled()) {
      return res.status(404).send('metrics disabled');
    }
    res.setHeader('Content-Type', this.metrics.getContentType());
    const text = await this.metrics.getMetricsText();
    return res.status(200).send(text);
  }
}
