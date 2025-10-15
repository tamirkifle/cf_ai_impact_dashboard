const validTypes = ['normal', 'spike', 'ddos'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

/**
 * Build a JSON response with shared headers.
 * @param {unknown} data - Payload to serialize.
 * @param {number} status - HTTP status code.
 * @returns {Response}
 */
const jsonResponse = (data, status = 200) => {
  const payload =
    status >= 400 || (data && Object.prototype.hasOwnProperty.call(data, 'timestamp'))
      ? data
      : { ...data, timestamp: Date.now() };

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
};

/**
 * Cloudflare Worker entry point. Routes API requests to handlers.
 * @param {Request} request - Incoming request.
 * @param {Record<string, unknown>} env - Bindings (DB, Durable Objects, AI).
 * @param {ExecutionContext} ctx - Worker execution context.
 * @returns {Promise<Response>}
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (url.pathname === '/api/simulate') {
        if (request.method !== 'POST') {
          return jsonResponse(
            { error: 'Method not allowed', message: 'Use POST for /api/simulate' },
            405
          );
        }
        return await handleSimulate(request, env, ctx);
      }

      if (url.pathname === '/api/metrics') {
        return await handleGetMetrics(env);
      }

      if (url.pathname === '/api/status') {
        return await handleGetStatus(env);
      }

      return jsonResponse(
        { error: 'Not found', message: 'Endpoint does not exist' },
        404
      );
    } catch (error) {
      console.error('Worker fetch error', error);
      return jsonResponse(
        { error: 'Internal Server Error', message: 'Unexpected failure occurred' },
        500
      );
    }
  }
};

async function handleSimulate(request, env, ctx) {
  let body = {};
  try {
    body = await request.json();
  } catch (error) {
    console.warn('Invalid JSON payload for /api/simulate', error);
    return jsonResponse(
      { error: 'Invalid request body', message: 'Body must be valid JSON' },
      400
    );
  }

  const { type } = body;
  if (!validTypes.includes(type)) {
    return jsonResponse(
      {
        error: 'Invalid type',
        message: "Type must be one of: 'normal', 'spike', or 'ddos'"
      },
      400
    );
  }

  const simulationId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stub = getSimulatorStub(env);

  const doResponse = await stub.fetch('https://traffic-simulator/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, simulationId })
  });

  if (!doResponse.ok) {
    const errorPayload = await safeParse(doResponse);
    return jsonResponse(
      {
        error: 'Simulation failed',
        message: errorPayload?.message || 'Durable Object failed to simulate traffic'
      },
      doResponse.status
    );
  }

  const simulationPayload = await doResponse.json();

  try {
    const cfMetrics = simulationPayload.metrics.cloudflare;
    const originMetrics = simulationPayload.metrics.origin;

    await env.DB.prepare(
      `INSERT INTO simulation_metrics (
        simulation_id,
        timestamp,
        simulation_type,
        cf_latency_ms,
        cf_success_rate,
        cf_requests_handled,
        cf_errors,
        origin_latency_ms,
        origin_success_rate,
        origin_requests_handled,
        origin_errors,
        ai_explanation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        simulationId,
        simulationPayload.timestamp,
        type,
        cfMetrics.latency,
        cfMetrics.successRate,
        cfMetrics.requestsHandled,
        cfMetrics.errors,
        originMetrics.latency,
        originMetrics.successRate,
        originMetrics.requestsHandled,
        originMetrics.errors,
        simulationPayload.aiExplanation
      )
      .run();

    ctx.waitUntil(limitStoredMetrics(env));
  } catch (error) {
    console.error('Failed to persist simulation metrics', error);
    return jsonResponse(
      {
        error: 'Database error',
        message: 'Could not store metrics in D1'
      },
      500
    );
  }

  return jsonResponse({
    simulationId,
    type,
    metrics: simulationPayload.metrics,
    aiExplanation: simulationPayload.aiExplanation,
    timestamp: simulationPayload.timestamp
  });
}

async function handleGetMetrics(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT
        id,
        simulation_id,
        timestamp,
        simulation_type,
        cf_latency_ms,
        cf_success_rate,
        cf_requests_handled,
        cf_errors,
        origin_latency_ms,
        origin_success_rate,
        origin_requests_handled,
        origin_errors,
        ai_explanation
      FROM simulation_metrics
      ORDER BY timestamp DESC
      LIMIT 5`
    ).all();

    const toOneDecimal = (value) =>
      Math.round(Number.parseFloat(value ?? 0) * 10) / 10;

    const formatted = results.map((row) => ({
      ...row,
      cf_success_rate: toOneDecimal(row.cf_success_rate),
      origin_success_rate: toOneDecimal(row.origin_success_rate)
    }));

    return jsonResponse({
      metrics: formatted
    });
  } catch (error) {
    console.error('Failed to fetch metrics', error);
    return jsonResponse(
      {
        error: 'Database error',
        message: 'Unable to retrieve metrics'
      },
      500
    );
  }
}

async function handleGetStatus(env) {
  const stub = getSimulatorStub(env);
  const response = await stub.fetch('https://traffic-simulator/status');

  if (!response.ok) {
    const errorPayload = await safeParse(response);
    return jsonResponse(
      {
        error: 'Status unavailable',
        message: errorPayload?.message || 'Durable Object unreachable'
      },
      response.status
    );
  }

  const statusPayload = await response.json();
  return jsonResponse(statusPayload);
}

function getSimulatorStub(env) {
  const id = env.TRAFFIC_SIMULATOR.idFromName('global');
  return env.TRAFFIC_SIMULATOR.get(id);
}

async function limitStoredMetrics(env) {
  try {
    await env.DB.prepare(
      `DELETE FROM simulation_metrics
       WHERE id NOT IN (
         SELECT id FROM simulation_metrics ORDER BY timestamp DESC LIMIT 500
       )`
    ).run();
  } catch (error) {
    console.warn('Failed to prune metrics', error);
  }
}

async function safeParse(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}
