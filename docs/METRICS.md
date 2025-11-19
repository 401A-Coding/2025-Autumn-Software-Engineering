# Metrics & Monitoring

This backend can expose Prometheus metrics for observability.

## Enable

- Set env var for backend process:
  - `METRICS_ENABLED=true`

## Endpoint

- `GET /metrics` returns Prometheus text format.
- Quick check:

  ```powershell
  curl http://localhost:3000/metrics
  ```

## Prometheus scrape example

```yaml
scrape_configs:
  - job_name: backend
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: /metrics
```

## Exported metrics

- `battles_moves_total`
- `battles_waiting_ttl_cleaned_total`
- `battles_disconnect_ttl_triggered_total`

## Grafana quick panel

- Panel type: Time series
- Query example: `rate(battles_moves_total[5m])`
- Legend: `Moves per second`
- Min step: `15s`
