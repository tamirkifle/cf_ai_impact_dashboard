# AGENTS.md - Cloudflare Performance Impact Dashboard

## Project Overview
You are building a real-time dashboard that demonstrates Cloudflare's protection value by simulating traffic scenarios and showing performance metrics. The system is built entirely on Cloudflare's platform.

## Technology Stack
- **Frontend**: React 18 with Chart.js on Cloudflare Pages
- **Backend**: Cloudflare Workers (serverless functions)
- **State Management**: Durable Objects for simulation state
- **Database**: D1 SQLite for metrics persistence
- **AI**: Workers AI with Llama 3.3 70B for traffic analysis
- **Build Tool**: Vite for frontend, Wrangler for deployment

## Project Structure
```
cf-impact-dashboard/
├── src/
│   ├── worker.js            # Main API Worker
│   ├── traffic-simulator.js # Durable Object
│   └── pages/
│       ├── App.jsx         # React dashboard
│       ├── style.css       # Styling
│       └── index.html      # Entry point
├── migrations/
│   └── 0001_create_tables.sql
├── wrangler.toml
├── package.json
├── vite.config.js
└── README.md
```

## Coding Standards
- Use ES6+ JavaScript features (async/await, arrow functions, destructuring)
- Follow React hooks patterns (useState, useEffect)
- All API responses must include CORS headers
- Error handling with try/catch blocks for all async operations
- Use meaningful variable names (camelCase for JS, snake_case for SQL)
- Round numeric values for display (latency to integers, percentages to 1 decimal)
- Component files use .jsx extension
- Styles use vanilla CSS with BEM-like naming

## API Design Patterns
- RESTful endpoints: `/api/simulate`, `/api/metrics`, `/api/status`
- POST requests require JSON body with Content-Type header
- All responses are JSON with appropriate status codes
- Error responses include `{ error: string, message?: string }`
- Success responses include timestamp for cache busting

## Cloudflare-Specific Patterns
- Workers use module syntax (`export default`)
- Durable Objects use class syntax with state management
- D1 uses prepared statements with `.bind()` for SQL injection prevention
- Workers AI uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast` model
- Environment bindings: `env.DB`, `env.TRAFFIC_SIMULATOR`, `env.AI`
- Use `wrangler.toml` for all configurations

## Testing Instructions
```bash
# Local development
npm run dev                  # Start worker locally
npm run test:api            # Test API endpoints
cd src/pages && npm run dev # Frontend dev server

# Database
npm run db:init    # Initialize local database
npm run db:migrate # Apply migrations

# Production deployment
npm run build   # Build frontend
npm run deploy  # Deploy everything
```

## Error Handling
- Gracefully handle AI service failures with fallback explanations
- Validate simulation types: must be 'normal', 'spike', or 'ddos'
- Handle CORS preflight requests explicitly
- Log errors to console with context
- Return user-friendly error messages

## Performance Requirements
- API responses < 500ms
- Frontend polling every 2 seconds
- Chart updates smooth without flickering
- Database queries use indexes for timestamp lookups
- Limit stored metrics to prevent D1 size issues

## Security Considerations
- No authentication required (public demo)
- Validate all user inputs
- Use parameterized queries for D1
- CORS headers allow all origins (demo purposes)
- Rate limiting handled by Cloudflare automatically

## Deployment Checklist
1. Create D1 database with `wrangler d1 create`
2. Update database_id in wrangler.toml
3. Run migrations on local and remote databases
4. Build frontend with Vite
5. Deploy with `wrangler deploy`
6. Verify all endpoints return data
7. Test all three simulation types

## Git Workflow
- Commit messages: "feat:", "fix:", "docs:", "style:", "refactor:"
- Branch naming: feature/*, bugfix/*, hotfix/*
- Always test locally before deploying
- Update README.md with any API changes

## Documentation Requirements
- Inline comments for complex logic only
- JSDoc comments for exported functions
- SQL comments for complex queries
- README must include setup steps and API documentation

## File Naming Conventions
- React components: PascalCase (App.jsx, Dashboard.jsx)
- Utilities: camelCase (utils.js, helpers.js)
- Workers: kebab-case (traffic-simulator.js)
- CSS files: match component name (App.css)
- SQL migrations: numbered prefix (0001_create_tables.sql)

## Dependencies Management
- Pin major versions in package.json
- Use exact versions for Cloudflare packages
- Frontend dependencies in dependencies
- Build tools in devDependencies
- Run `npm audit` before deployment

## Monitoring and Debugging
- Use `console.log` for development debugging
- Use `wrangler tail` for production logs
- Check D1 metrics with `wrangler d1 execute`
- Monitor Worker metrics in Cloudflare dashboard
- Test with curl commands for API validation