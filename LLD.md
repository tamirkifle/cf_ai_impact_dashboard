# Low-Level Design - Cloudflare Performance Impact Dashboard

## Database Schema

### Table: simulation_metrics
```sql
CREATE TABLE simulation_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  simulation_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  simulation_type TEXT CHECK(simulation_type IN ('normal', 'spike', 'ddos')) NOT NULL,
  
  -- Cloudflare protected metrics
  cf_latency_ms INTEGER NOT NULL,
  cf_success_rate REAL NOT NULL,
  cf_requests_handled INTEGER NOT NULL,
  cf_errors INTEGER NOT NULL DEFAULT 0,
  
  -- Unprotected origin metrics  
  origin_latency_ms INTEGER NOT NULL,
  origin_success_rate REAL NOT NULL,
  origin_requests_handled INTEGER NOT NULL,
  origin_errors INTEGER NOT NULL DEFAULT 0,
  
  -- AI analysis
  ai_explanation TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_simulation_id ON simulation_metrics(simulation_id);
CREATE INDEX idx_timestamp ON simulation_metrics(timestamp DESC);
CREATE INDEX idx_type_timestamp ON simulation_metrics(simulation_type, timestamp DESC);
```

## API Worker Implementation Details

### Class: APIWorker
**File**: src/worker.js

#### Method: fetch(request, env, ctx)
- **Purpose**: Main entry point for all HTTP requests
- **Parameters**:
  - request: Request object
  - env: Environment bindings (DB, TRAFFIC_SIMULATOR, AI)
  - ctx: Context object
- **Returns**: Response object with JSON data
- **Algorithm**:
  1. Parse request URL
  2. Add CORS headers
  3. Handle OPTIONS preflight
  4. Route to appropriate handler
  5. Catch and format errors

#### Method: handleSimulate(request, env, corsHeaders)
- **Input Validation**:
  - Check request method is POST
  - Parse JSON body
  - Validate type in ['normal', 'spike', 'ddos']
- **Processing**:
  1. Generate unique simulationId
  2. Get Durable Object instance
  3. Call DO simulate method
  4. Store results in D1
  5. Return formatted response
- **Error Cases**:
  - Invalid type: 400 Bad Request
  - DB error: 500 Internal Server Error

#### Method: handleGetMetrics(env, corsHeaders)
- **Query**: SELECT last 5 metrics ORDER BY timestamp DESC
- **Response Format**:
  ```javascript
  {
    metrics: Array<MetricRecord>,
    timestamp: number
  }
  ```

#### Method: handleGetStatus(env, corsHeaders)
- **Processing**:
  1. Get Durable Object instance
  2. Fetch current status
  3. Return simulation state

## Durable Object Implementation

### Class: TrafficSimulator
**File**: src/traffic-simulator.js

#### State Management
```javascript
class TrafficSimulator {
  constructor(state, env) {
    this.state = state;        // Durable Object state
    this.env = env;           // Environment bindings
    this.currentSimulation = null;
    this.metrics = {
      cloudflare: { latency: 100, successRate: 100, requestsHandled: 0, errors: 0 },
      origin: { latency: 100, successRate: 100, requestsHandled: 0, errors: 0 }
    };
  }
}
```

#### Method: generateMetrics(type)
**Purpose**: Generate realistic metrics based on simulation type

**Normal Traffic Algorithm**:
```javascript
cloudflare: {
  latency: 95 + Math.random() * 10,      // 95-105ms
  successRate: 100,                       // 100%
  requestsHandled: 10,
  errors: 0
}
origin: {
  latency: 100 + Math.random() * 20,     // 100-120ms
  successRate: 100,                       // 100%
  requestsHandled: 10,
  errors: 0
}
```

**Traffic Spike Algorithm**:
```javascript
cloudflare: {
  latency: 120 + Math.random() * 30,     // 120-150ms
  successRate: 98 + Math.random() * 2,    // 98-100%
  requestsHandled: 500,
  errors: Math.floor(Math.random() * 10)  // 0-10 errors
}
origin: {
  latency: 2000 + Math.random() * 1000,  // 2-3 seconds
  successRate: 40 + Math.random() * 20,   // 40-60%
  requestsHandled: 300,
  errors: 200
}
```

**DDoS Attack Algorithm**:
```javascript
cloudflare: {
  latency: 150 + Math.random() * 50,     // 150-200ms
  successRate: 95 + Math.random() * 3,    // 95-98%
  requestsHandled: 10000,
  errors: Math.floor(Math.random() * 500) // 0-500 errors
}
origin: {
  latency: 5000 + Math.random() * 2000,  // 5-7 seconds
  successRate: Math.random() * 10,        // 0-10%
  requestsHandled: 500,
  errors: 9500
}
```

#### Method: getAIExplanation(type, metrics)
**AI Prompt Template**:
```
Explain this traffic simulation in 2 sentences for a technical audience:
Type: {type}
Cloudflare: {cf_latency}ms latency, {cf_success}% success
Origin: {origin_latency}ms latency, {origin_success}% success
```

**Fallback Explanations**:
- Normal: "Normal traffic conditions with both systems performing optimally. Cloudflare provides marginal improvements through caching and optimization."
- Spike: "Traffic surge overwhelming unprotected origin while Cloudflare absorbs the load. Clear demonstration of DDoS protection and auto-scaling capabilities."
- DDoS: "Massive DDoS attack completely disabling unprotected origin. Cloudflare successfully mitigating 99.5% of malicious traffic while maintaining service availability."

## Frontend Components

### Component: App
**File**: src/pages/App.jsx

#### State Variables
```javascript
const [metrics, setMetrics] = useState([]);          // Historical metrics
const [currentStatus, setCurrentStatus] = useState(null); // Current simulation
const [loading, setLoading] = useState(false);       // Loading state
const [error, setError] = useState(null);           // Error message
const [aiExplanation, setAiExplanation] = useState(''); // AI analysis
```

#### Polling Mechanism
```javascript
useEffect(() => {
  fetchMetrics();  // Initial fetch
  const interval = setInterval(() => {
    fetchMetrics();
    fetchStatus();
  }, 2000);  // Poll every 2 seconds
  return () => clearInterval(interval);
}, []);
```

#### Chart Configuration

**Latency Line Chart**:
```javascript
{
  labels: Last 10 time points,
  datasets: [
    {
      label: 'With Cloudflare',
      borderColor: 'rgb(249, 115, 22)',  // Orange
      tension: 0.1  // Smooth curves
    },
    {
      label: 'Without Cloudflare',
      borderColor: 'rgb(239, 68, 68)',   // Red
      tension: 0.1
    }
  ]
}
```

**Success Rate Bar Chart**:
```javascript
{
  labels: ['With Cloudflare', 'Without Cloudflare'],
  datasets: [{
    data: [cf_success_rate, origin_success_rate],
    backgroundColor: ['green', 'red']
  }]
}
```

## Configuration Files

### wrangler.toml Configuration
```toml
name = "cf-impact-dashboard"
main = "src/worker.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "cf-impact-metrics"
database_id = "YOUR_DATABASE_ID"

[[durable_objects.bindings]]
name = "TRAFFIC_SIMULATOR"
class_name = "TrafficSimulator"

[ai]
binding = "AI"

[site]
bucket = "./dist"
```

### Package Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240117.0",
    "wrangler": "^3.22.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

## Error Handling Strategy

### API Layer
- Try-catch blocks wrap all async operations
- Specific error messages for each failure type
- HTTP status codes follow REST conventions
- CORS errors handled with proper headers

### Database Operations
- Prepared statements prevent SQL injection
- Transaction rollback on failure
- Connection pooling handled by D1

### AI Service
- Fallback to hardcoded explanations
- Timeout after 5 seconds
- Log errors but don't fail simulation

### Frontend
- Loading states for all async operations
- User-friendly error messages
- Retry mechanism for failed requests
- Graceful degradation without data

## Performance Optimizations

### Database
- Indexes on frequently queried columns
- Limit results to prevent large payloads
- Use prepared statements for caching

### API
- JSON response compression
- Minimal data transfer
- Efficient routing logic

### Frontend
- React.memo for expensive components
- useCallback for event handlers
- Debounced API calls
- Virtual scrolling for large datasets

## Security Considerations

### Input Validation
```javascript
const validTypes = ['normal', 'spike', 'ddos'];
if (!validTypes.includes(type)) {
  return jsonResponse({ error: 'Invalid type' }, 400);
}
```

### SQL Injection Prevention
```javascript
const stmt = env.DB.prepare(`
  INSERT INTO simulation_metrics (...) VALUES (?, ?, ?, ...)
`).bind(simulationId, timestamp, type, ...);
```

### CORS Configuration
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
```

## Testing Strategy

### Unit Tests
- Test metric generation algorithms
- Validate input sanitization
- Check error handling paths

### Integration Tests
- API endpoint responses
- Database operations
- Durable Object state management

### End-to-End Tests
- Complete simulation flow
- Chart data updates
- Error recovery

### Performance Tests
- Load testing with concurrent users
- Database query performance
- Frontend rendering speed

## Deployment Steps

1. **Database Setup**:
   ```bash
   wrangler d1 create cf-impact-metrics
   wrangler d1 execute cf-impact-metrics --file=./migrations/0001_create_tables.sql
   ```

2. **Build Frontend**:
   ```bash
   npm run build
   ```

3. **Deploy Worker**:
   ```bash
   wrangler deploy
   ```

4. **Verify Deployment**:
   ```bash
   curl https://your-worker.workers.dev/api/status
   ```

## Monitoring and Logging

### Metrics to Track
- API response times
- Error rates by endpoint
- Simulation type distribution
- AI service availability
- Database query performance

### Logging Strategy
- Info: Successful simulations
- Warning: Fallback to hardcoded AI
- Error: Database failures, API errors
- Debug: Detailed metric calculations

### Alerting Thresholds
- API latency > 1 second
- Error rate > 5%
- Database size > 80% capacity
- AI service unavailable > 5 minutes