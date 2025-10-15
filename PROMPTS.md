# Conversation Prompts Summary
## Cloudflare Software Engineering Internship Project Development

### 1. Initial Research Request
**Prompt:** "https://blog.cloudflare.com/ Why are you interested in Cloudflare's Software Engineering Internship? What products or features are you interested in building? find something distributed systems maybe a database"

**Purpose:** Research Cloudflare's technology stack, specifically distributed systems and database products for internship application.

---

### 2. Response Refinement - Conciseness
**Prompt:** "Give me a distilled 50 words max response"

**Purpose:** Create a concise, impactful response for the application form.

---

### 3. Response Refinement - Confidence
**Prompt:** "Be more confident. Say I want to build this, i want to tackle these problems"

**Purpose:** Reframe response with stronger, more assertive language showing enthusiasm and determination.

---

### 4. Optional Assignment Requirements
**Prompt:** 
```
Optional Assignment: See instructions below for Cloudflare AI app assignment. SUBMIT GitHub repo URL for the AI project here. (Please do not submit irrelevant repositories.)

Optional Assignment Instructions: We plan to fast track review of candidates who complete an assignment to build a type of AI-powered application https://agents.cloudflare.com/ on Cloudflare. An AI-powered application should include the following components:
* LLM (recommend using Llama 3.3 on Workers AI), or an external LLM of your choice
* Workflow / coordination (recommend using Workflows, Workers or Durable Objects)
* User input via chat or voice (recommend using Pages or Realtime)
* Memory or state

Find additional documentation at https://developers.cloudflare.com/agents/

IMPORTANT NOTE: To be considered, your repository name must be prefixed with `cf_ai_`, must include a `README.md` file with project documentation and clear running instructions to try out components (either locally or via deployed link). AI-assisted coding is encouraged, but you must include AI prompts used in `PROMPTS.md`

Come up with what to build!
```

**Purpose:** Understand assignment requirements and brainstorm project ideas.

---

### 5. Project Feasibility Check
**Prompt:** "can we demonstrate this easily... if not come up with another idea. maybe something realistic like an intern project and something cloudflare relates to. Im thinking something that generates cool fake data using a cool schema at the start randomly and then you query it. Give it a theme and maybe something cloudflare related things. Maybe creates users all over the world and then we simulate their usage and animate it etc... think around this"

**Purpose:** Pivot to a more demonstrable project with visual appeal and Cloudflare relevance.

---

### 6. Core Value Proposition Focus
**Prompt:** "maybe make it cloudflare value proposition. without cloudflare with cloudflare comparison. make that the core thing"

**Purpose:** Refocus project on clearly demonstrating Cloudflare's value through direct comparison.

---

### 7. Implementation Planning
**Prompt:** "Explain how you plan on building this... how confident are you in delivering this. (1 -10). No coding yet"

**Purpose:** Assess technical feasibility and create detailed implementation plan with confidence level.

---

### 8. Simplification to MVP
**Prompt:** "Simplify for the first MVP and get it to a 10/10 confidence. Do some search on the internet for materials"

**Purpose:** Reduce scope to ensure deliverability while maintaining core value demonstration.

---

### 9. Technical Documentation Request
**Prompt:** "Ok now generate a HLD and LLD detailed document that we will use to build this from scratch as an artifact."

**Purpose:** Create comprehensive technical documentation for implementation.

### 10. Optimize for Codex
**Prompt:** "Transformed this design document into the files needed for OpenAI Codex CLI."

### 11. OpenAPI Codex Prompt
**Prompt:**
"""
Build the complete Cloudflare Performance Impact Dashboard project based on the specifications in AGENTS.md, HLD.md, and LLD.md. 

Create the full implementation including:
1. Project structure and package.json with all dependencies from LLD.md
2. Database migration file (migrations/0001_create_tables.sql) with the schema from LLD.md section "Database Schema"
3. The main Worker API (src/worker.js) implementing all three endpoints as specified in LLD.md section "API Worker Implementation Details"
4. The TrafficSimulator Durable Object (src/traffic-simulator.js) with metric generation algorithms from LLD.md section "Durable Object Implementation"
5. React frontend (src/pages/App.jsx) with Chart.js visualizations as described in LLD.md section "Frontend Components"
6. CSS styling (src/pages/style.css) following the visual design in HLD.md
7. HTML entry point (src/pages/index.html)
8. Vite configuration (vite.config.js) from LLD.md
9. Wrangler configuration (wrangler.toml) from LLD.md section "Configuration Files"
10. README.md with setup and deployment instructions

Follow all coding standards in AGENTS.md, implement the exact architecture from HLD.md, and use the detailed specifications in LLD.md for all implementations. Include proper error handling, CORS headers, and AI integration as specified. Make sure the metric generation matches the algorithms for normal, spike, and ddos simulations exactly as defined.
"""