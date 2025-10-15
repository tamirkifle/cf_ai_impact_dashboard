/**
 * Traffic simulator Durable Object responsible for generating metrics
 * and providing the latest simulation status.
 */
export class TrafficSimulator {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.currentSimulation = null;
    this.metrics = this.getInitialMetrics();
    this.ready = this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('state');
      if (stored) {
        this.currentSimulation = stored.currentSimulation ?? null;
        this.metrics = stored.metrics ?? this.getInitialMetrics();
      }
    });
  }

  /**
   * Durable Object entry point.
   * @param {Request} request - Incoming request from the Worker.
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      if (request.method === 'POST' && pathname.endsWith('/simulate')) {
        return this.handleSimulateRequest(request);
      }

      if (request.method === 'GET' && pathname.endsWith('/status')) {
        return this.handleStatusRequest();
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('TrafficSimulator.fetch error', error);
      return new Response(
        JSON.stringify({ error: 'Simulation error', message: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  getInitialMetrics() {
    return {
      cloudflare: {
        latency: 100,
        successRate: 100,
        requestsHandled: 0,
        errors: 0
      },
      origin: {
        latency: 100,
        successRate: 100,
        requestsHandled: 0,
        errors: 0
      }
    };
  }

  async handleSimulateRequest(request) {
    const validTypes = ['normal', 'spike', 'ddos'];
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.warn('Durable Object received invalid JSON body', error);
      return new Response(
        JSON.stringify({ error: 'Invalid request body', message: 'Expected JSON payload' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    const { type, simulationId } = body;

    if (!validTypes.includes(type) || typeof simulationId !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'Invalid type',
          message: "Type must be 'normal', 'spike', or 'ddos' with a simulationId string"
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const timestamp = Date.now();
    const simulation = {
      id: simulationId,
      type,
      startTime: timestamp,
      isActive: true
    };

    const metrics = this.generateMetrics(type);
    this.metrics = metrics;

    this.currentSimulation = simulation;
    await this.persistState();

    const aiExplanation = await this.getAIExplanation(type, metrics);

    return new Response(
      JSON.stringify({
        simulation,
        metrics,
        aiExplanation,
        timestamp
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  async handleStatusRequest() {
    const now = Date.now();
    const simulation = this.currentSimulation
      ? {
          ...this.currentSimulation,
          isActive:
            now - (this.currentSimulation.startTime || 0) <
            30 * 1000 /* 30 seconds */
        }
      : null;

    return new Response(
      JSON.stringify({
        simulation,
        metrics: this.metrics,
        timestamp: now
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  async persistState() {
    await this.state.storage.put('state', {
      currentSimulation: this.currentSimulation,
      metrics: this.metrics
    });
  }

  generateMetrics(type) {
    const roundLatency = (value) => Math.round(value);
    const roundSuccess = (value) =>
      Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;

    const generators = {
      normal: () => ({
        cloudflare: {
          latency: roundLatency(95 + Math.random() * 10),
          successRate: 100,
          requestsHandled: 10,
          errors: 0
        },
        origin: {
          latency: roundLatency(100 + Math.random() * 20),
          successRate: 100,
          requestsHandled: 10,
          errors: 0
        }
      }),
      spike: () => ({
        cloudflare: {
          latency: roundLatency(120 + Math.random() * 30),
          successRate: roundSuccess(98 + Math.random() * 2),
          requestsHandled: 500,
          errors: Math.floor(Math.random() * 10)
        },
        origin: {
          latency: roundLatency(2000 + Math.random() * 1000),
          successRate: roundSuccess(40 + Math.random() * 20),
          requestsHandled: 300,
          errors: 200
        }
      }),
      ddos: () => ({
        cloudflare: {
          latency: roundLatency(150 + Math.random() * 50),
          successRate: roundSuccess(95 + Math.random() * 3),
          requestsHandled: 10000,
          errors: Math.floor(Math.random() * 500)
        },
        origin: {
          latency: roundLatency(5000 + Math.random() * 2000),
          successRate: roundSuccess(Math.random() * 10),
          requestsHandled: 500,
          errors: 9500
        }
      })
    };

    return generators[type]();
  }

  async getAIExplanation(type, metrics) {
    const fallback = {
      normal:
        'Normal traffic conditions with both systems performing optimally. Cloudflare provides marginal improvements through caching and optimization.',
      spike:
        'Traffic surge overwhelming unprotected origin while Cloudflare absorbs the load. Clear demonstration of DDoS protection and auto-scaling capabilities.',
      ddos:
        'Massive DDoS attack completely disabling unprotected origin. Cloudflare successfully mitigating 99.5% of malicious traffic while maintaining service availability.'
    };

    if (!this.env.AI || typeof this.env.AI.run !== 'function') {
      return fallback[type];
    }

    const prompt = [
      'Explain this traffic simulation in 2 sentences for a technical audience:',
      `Type: ${type}`,
      `Cloudflare: ${metrics.cloudflare.latency}ms latency, ${metrics.cloudflare.successRate}% success`,
      `Origin: ${metrics.origin.latency}ms latency, ${metrics.origin.successRate}% success`
    ].join('\n');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const aiResult = await this.env.AI.run(
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        { prompt },
        { signal: controller.signal }
      );

      const responseText =
        aiResult?.response ||
        aiResult?.result?.response ||
        aiResult?.result?.output ||
        aiResult?.result?.text ||
        '';

      const trimmed = typeof responseText === 'string' ? responseText.trim() : '';
      return trimmed || fallback[type];
    } catch (error) {
      console.warn('Workers AI fallback due to error', error);
      return fallback[type];
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
