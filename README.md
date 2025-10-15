# Cloudflare Performance Impact Dashboard

Real-time dashboard that simulates Normal, Spike, and DDoS traffic patterns to demonstrate the performance impact of Cloudflare protection. The project runs entirely on Cloudflare's stack, leveraging Workers, Durable Objects, D1, Workers AI, and Pages.

## Features
- Trigger Normal, Traffic Spike, and DDoS simulations on demand
- Visualize Cloudflare-protected vs. unprotected origin performance
- AI-generated traffic analysis summaries
- Persistent metrics stored in D1 with automatic pruning
- React 18 dashboard rendered on Cloudflare Pages with Chart.js

## Project Structure
```
cf-impact-dashboard/
├── migrations/
│   └── 0001_create_tables.sql
├── scripts/
│   └── test-api.js
├── src/
│   ├── traffic-simulator.js
│   ├── worker.js
│   └── pages/
│       ├── App.jsx
│       ├── index.html
│       ├── main.jsx
│       └── style.css
├── package.json
├── vite.config.js
├── wrangler.toml
└── README.md
```

## Prerequisites
- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`), or use the local dependency
- Cloudflare account with access to Workers, Durable Objects, D1, and Workers AI

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create the D1 database and note the returned `database_id`:
   ```bash
   wrangler d1 create cf-impact-metrics
   ```
3. Update `wrangler.toml` with your `database_id`.
4. Apply the initial migration locally:
   ```bash
   wrangler d1 execute cf-impact-metrics --file=./migrations/0001_create_tables.sql
   ```

## Local Development
- Start the Workers backend:
  ```bash
  npm run dev
  ```
- Start the Vite frontend dev server (serves `src/pages/index.html`):
  ```bash
  npm run frontend:dev
  ```
- Open the Vite dev URL (defaults to `http://localhost:5173`) to view the dashboard.

## Available Scripts
| Script | Description |
| --- | --- |
| `npm run dev` | Run `wrangler dev` to start the Worker locally |
| `npm run frontend:dev` | Launch the Vite development server |
| `npm run build` | Build the frontend into `dist/` |
| `npm run deploy` | Deploy using Wrangler (Worker + Pages site) |
| `npm run test:api` | Placeholder for API tests (extend as needed) |
| `npm run db:init` | Create the D1 database via Wrangler |
| `npm run db:migrate` | Apply D1 migrations using Wrangler |

## API Reference

All endpoints include CORS headers and return JSON.

### POST `/api/simulate`
Trigger a simulation. Body must include `type` (`normal`, `spike`, or `ddos`).
```json
{
  "simulationId": "sim-1704067200000-abc123",
  "type": "normal",
  "metrics": {
    "cloudflare": {
      "latency": 99,
      "successRate": 100,
      "requestsHandled": 10,
      "errors": 0
    },
    "origin": {
      "latency": 112,
      "successRate": 100,
      "requestsHandled": 10,
      "errors": 0
    }
  },
  "aiExplanation": "Normal traffic conditions...",
  "timestamp": 1704067200000
}
```

### GET `/api/metrics`
Retrieve the five most recent simulations (ordered newest first).
```json
{
  "metrics": [
    {
      "id": 1,
      "simulation_id": "sim-1704067200000-abc123",
      "timestamp": 1704067200000,
      "simulation_type": "normal",
      "cf_latency_ms": 99,
      "cf_success_rate": 100.0,
      "cf_requests_handled": 10,
      "cf_errors": 0,
      "origin_latency_ms": 112,
      "origin_success_rate": 100.0,
      "origin_requests_handled": 10,
      "origin_errors": 0,
      "ai_explanation": "Normal traffic conditions..."
    }
  ],
  "timestamp": 1704067205000
}
```

### GET `/api/status`
Return the current durable object simulation status and most recent metrics snapshot.
```json
{
  "simulation": {
    "id": "sim-1704067200000-abc123",
    "type": "normal",
    "startTime": 1704067200000,
    "isActive": true
  },
  "metrics": {
    "cloudflare": { "latency": 99, "successRate": 100, "requestsHandled": 10, "errors": 0 },
    "origin": { "latency": 112, "successRate": 100, "requestsHandled": 10, "errors": 0 }
  },
  "timestamp": 1704067205000
}
```

### Error Response Format
```json
{
  "error": "Invalid type",
  "message": "Type must be one of: 'normal', 'spike', or 'ddos'"
}
```

## Deployment
1. Build the frontend:
   ```bash
   npm run build
   ```
2. Apply migrations to the production D1 database:
   ```bash
   wrangler d1 execute cf-impact-metrics --remote --file=./migrations/0001_create_tables.sql
   ```
3. Deploy the Worker and Pages site:
   ```bash
   npm run deploy
   ```
4. Verify the endpoints, then test each simulation type via the dashboard.

## Monitoring & Debugging
- `wrangler tail` for real-time logs
- `wrangler d1 execute` to inspect database contents
- Cloudflare dashboard metrics for Worker performance
- The frontend polls `/api/status` and `/api/metrics` every two seconds; errors are surfaced in the UI and retried automatically

## Notes
- AI explanations use Workers AI with the `@cf/meta/llama-3.3-70b-instruct-fp8-fast` model and fall back to deterministic messaging if the service is unavailable.
- Stored metrics are pruned to keep the latest 500 entries and avoid uncontrolled D1 growth.
- Extend `scripts/test-api.js` with real endpoint checks as you integrate automated testing.
