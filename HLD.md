# High-Level Design - Cloudflare Performance Impact Dashboard

## Executive Summary
A real-time dashboard demonstrating Cloudflare's protection capabilities through interactive traffic simulations. Users can trigger Normal, Spike, and DDoS scenarios to visualize the performance difference between Cloudflare-protected and unprotected origins.

## Business Requirements
- **Purpose**: Showcase Cloudflare's value in protecting web applications
- **Target Users**: Technical decision makers, developers, security teams
- **Key Features**:
  - Three simulation modes (Normal, Spike, DDoS)
  - Real-time performance metrics visualization
  - AI-powered traffic analysis
  - Side-by-side comparison charts
  - Historical simulation data

## System Architecture

### Component Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Pages                        │
│                   (React Dashboard UI)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Normal  │  │  Spike   │  │   DDoS   │  │  Charts  │  │
│  │  Button  │  │  Button  │  │  Button  │  │  Display │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS API Calls
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                        │
│                      (API Gateway)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ POST         │  │ GET          │  │ GET          │     │
│  │ /simulate    │  │ /metrics     │  │ /status      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────┬──────────────────┬─────────────────┬──────────────┘
         │                  │                  │
         ↓                  ↓                  ↓
┌─────────────────┐ ┌─────────────┐ ┌──────────────────┐
│ Durable Object  │ │   D1 SQLite │ │ Workers AI       │
│(TrafficSimulator)│ │  (Metrics)  │ │(Llama 3.3 70B)  │
└─────────────────┘ └─────────────┘ └──────────────────┘
```

### Technology Stack Decisions

| Component | Technology | Justification |
|-----------|------------|---------------|
| Frontend | React + Chart.js on Pages | Free CDN hosting, global distribution, native Cloudflare integration |
| API Layer | Cloudflare Workers | Serverless, auto-scaling, 0ms cold starts, global edge network |
| State Management | Durable Objects | Consistent state for simulations, WebSocket support, singleton pattern |
| Database | D1 SQLite | Cloudflare-native, SQL support, no external dependencies |
| AI Analysis | Workers AI | No API keys needed, low latency, included in platform |

## Data Flow Patterns

### Normal Traffic Simulation (10 RPS)
1. User clicks "Normal Traffic" button
2. Frontend sends POST to `/api/simulate` with type='normal'
3. Worker validates request and contacts Durable Object
4. Durable Object generates realistic metrics
5. Metrics stored in D1 database
6. AI generates explanation of traffic pattern
7. Response returned with metrics and explanation
8. Frontend updates charts with new data

### Traffic Spike Simulation (500 RPS)
1. User initiates spike simulation
2. Durable Object generates degraded metrics for unprotected origin
3. Cloudflare metrics show minimal impact
4. Progressive degradation simulated over time
5. Real-time updates streamed to frontend
6. Charts show diverging performance curves

### DDoS Attack Simulation (10K RPS)
1. User triggers DDoS simulation
2. Massive traffic load simulated
3. Unprotected origin shows complete failure
4. Cloudflare metrics show successful mitigation
5. Recovery pattern simulated after 30 seconds
6. AI provides detailed attack analysis

## API Specification

### POST /api/simulate
**Purpose**: Initiate a new traffic simulation
```json
Request:
{
  "type": "normal" | "spike" | "ddos"
}

Response:
{
  "simulationId": "sim-1234567890-abc",
  "type": "normal",
  "metrics": {
    "cloudflare": {
      "latency": 95,
      "successRate": 100,
      "requestsHandled": 10,
      "errors": 0
    },
    "origin": {
      "latency": 100,
      "successRate": 100,
      "requestsHandled": 10,
      "errors": 0
    }
  },
  "aiExplanation": "Normal traffic conditions...",
  "timestamp": 1704067200000
}
```

### GET /api/metrics
**Purpose**: Retrieve recent simulation metrics
```json
Response:
{
  "metrics": [
    {
      "id": 1,
      "simulation_id": "sim-123",
      "simulation_type": "normal",
      "cf_latency_ms": 95,
      "cf_success_rate": 100.0,
      "origin_latency_ms": 100,
      "origin_success_rate": 100.0,
      "ai_explanation": "...",
      "timestamp": 1704067200000
    }
  ],
  "timestamp": 1704067200000
}
```

### GET /api/status
**Purpose**: Get current simulation status
```json
Response:
{
  "simulation": {
    "id": "sim-123",
    "type": "normal",
    "startTime": 1704067200000,
    "isActive": true
  },
  "metrics": {...},
  "timestamp": 1704067200000
}
```

## Non-Functional Requirements

### Performance
- API response time < 500ms
- Dashboard loads in < 3 seconds
- Real-time updates every 2 seconds
- Support 100 concurrent users

### Scalability
- Cloudflare Workers auto-scale globally
- D1 handles up to 10GB data
- Durable Objects manage state per region

### Reliability
- 99.9% uptime (Cloudflare SLA)
- Graceful degradation if AI unavailable
- Automatic error recovery

### Security
- CORS enabled for demo purposes
- Input validation on all endpoints
- SQL injection prevention via prepared statements
- No sensitive data stored

## User Interface Design

### Dashboard Layout
- Header: Title and description
- Control Panel: Three simulation buttons
- AI Analysis: Explanation box
- Charts Section: 
  - Line chart for latency over time
  - Bar chart for success rate comparison
- Metrics Table: Recent simulations history
- Footer: Technology attribution

### Visual Design Principles
- Cloudflare orange (#f97316) as primary color
- Gradient backgrounds for visual appeal
- Clear visual hierarchy
- Responsive design for all screen sizes
- Smooth animations for state changes

## Deployment Strategy

### Environments
- **Development**: Local with `wrangler dev`
- **Staging**: Deploy to `*.workers.dev`
- **Production**: Custom domain with Cloudflare DNS

### CI/CD Pipeline
1. Push to main branch
2. Run tests
3. Build frontend
4. Deploy Workers and Pages
5. Run smoke tests
6. Monitor metrics

## Success Criteria
- Shows clear performance difference in < 30 seconds
- Demonstrates 5+ Cloudflare services working together
- Intuitive UI requiring no documentation
- Works on all modern browsers
- Mobile-responsive design

## Future Enhancements
- Real traffic data from Analytics API
- WebSocket for live updates
- Geographic traffic distribution
- Custom attack patterns
- Cost savings calculator
- Export functionality
- A/B testing capabilities