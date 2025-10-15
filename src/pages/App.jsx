import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import React from 'react';
import './style.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE = '/api';

const simulationButtons = [
  { type: 'normal', label: 'Normal Traffic', modifier: 'normal' },
  { type: 'spike', label: 'Traffic Spike', modifier: 'warning' },
  { type: 'ddos', label: 'DDoS Attack', modifier: 'danger' }
];

const toDisplayTime = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(timestamp));

const formatSuccess = (value) => Math.round((value ?? 0) * 10) / 10;

const createRecordFromSimulation = (simulation) => ({
  id: simulation.simulationId,
  simulation_id: simulation.simulationId,
  simulation_type: simulation.type,
  timestamp: simulation.timestamp,
  cf_latency_ms: Math.round(simulation.metrics.cloudflare.latency),
  cf_success_rate: formatSuccess(simulation.metrics.cloudflare.successRate),
  cf_requests_handled: simulation.metrics.cloudflare.requestsHandled,
  cf_errors: simulation.metrics.cloudflare.errors,
  origin_latency_ms: Math.round(simulation.metrics.origin.latency),
  origin_success_rate: formatSuccess(simulation.metrics.origin.successRate),
  origin_requests_handled: simulation.metrics.origin.requestsHandled,
  origin_errors: simulation.metrics.origin.errors,
  ai_explanation: simulation.aiExplanation
});

const MetricsTable = React.memo(function MetricsTable({ records }) {
  if (!records.length) {
    return (
      <div className="metrics-table__empty">
        Trigger a simulation to populate historical data.
      </div>
    );
  }

  return (
    <div className="metrics-table__wrapper">
      <table className="metrics-table__table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>CF Latency (ms)</th>
            <th>Origin Latency (ms)</th>
            <th>CF Success (%)</th>
            <th>Origin Success (%)</th>
            <th>CF Requests</th>
            <th>Origin Requests</th>
            <th>CF Errors</th>
            <th>Origin Errors</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr key={`${row.simulation_id}-${row.timestamp}`}>
              <td>{toDisplayTime(row.timestamp)}</td>
              <td className={`metrics-table__type metrics-table__type--${row.simulation_type}`}>
                {row.simulation_type}
              </td>
              <td>{row.cf_latency_ms}</td>
              <td>{row.origin_latency_ms}</td>
              <td>{formatSuccess(row.cf_success_rate)}</td>
              <td>{formatSuccess(row.origin_success_rate)}</td>
              <td>{row.cf_requests_handled}</td>
              <td>{row.origin_requests_handled}</td>
              <td>{row.cf_errors}</td>
              <td>{row.origin_errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

const App = () => {
  const [metrics, setMetrics] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiExplanation, setAiExplanation] = useState('');

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/metrics`);
      if (!response.ok) {
        throw new Error('Unable to fetch metrics');
      }
      const data = await response.json();
      setMetrics(data.metrics ?? []);
      setError(null);
    } catch (err) {
      console.error('fetchMetrics failure', err);
      setError('Unable to load metrics. Retrying automatically.');
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/status`);
      if (!response.ok) {
        throw new Error('Unable to fetch status');
      }
      const data = await response.json();
      setCurrentStatus(data.simulation ?? null);
    } catch (err) {
      console.error('fetchStatus failure', err);
    }
  }, []);

  const handleSimulate = useCallback(
    async (type) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type })
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || 'Simulation failed');
        }

        setAiExplanation(payload.aiExplanation || '');
        setCurrentStatus({
          id: payload.simulationId,
          type: payload.type,
          startTime: payload.timestamp,
          isActive: true
        });

        const record = createRecordFromSimulation(payload);
        setMetrics((prev) => [record, ...prev].slice(0, 10));
      } catch (err) {
        console.error('Simulation request failed', err);
        setError(err.message || 'Failed to trigger simulation');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchMetrics();
    fetchStatus();
    const interval = setInterval(() => {
      fetchMetrics();
      fetchStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchMetrics, fetchStatus]);

  const latestMetric = metrics[0];

  const latencyChartData = useMemo(() => {
    const recent = [...metrics].slice(0, 10).reverse();
    return {
      labels: recent.map((entry) => toDisplayTime(entry.timestamp)),
      datasets: [
        {
          label: 'With Cloudflare',
          data: recent.map((entry) => entry.cf_latency_ms),
          borderColor: 'rgb(249, 115, 22)',
          backgroundColor: 'rgba(249, 115, 22, 0.2)',
          tension: 0.3
        },
        {
          label: 'Without Cloudflare',
          data: recent.map((entry) => entry.origin_latency_ms),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          tension: 0.3
        }
      ]
    };
  }, [metrics]);

  const successRateData = useMemo(() => {
    if (!latestMetric) {
      return {
        labels: ['With Cloudflare', 'Without Cloudflare'],
        datasets: [
          {
            data: [0, 0],
            backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)']
          }
        ]
      };
    }
    return {
      labels: ['With Cloudflare', 'Without Cloudflare'],
      datasets: [
        {
          data: [
            formatSuccess(latestMetric.cf_success_rate),
            formatSuccess(latestMetric.origin_success_rate)
          ],
          backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)'],
          borderRadius: 6
        }
      ]
    };
  }, [latestMetric]);

  const successRateOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.formattedValue}%`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (value) => `${value}%` }
        }
      }
    }),
    []
  );

  const latencyChartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Latency (ms)'
          }
        }
      }
    }),
    []
  );

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">Cloudflare Performance Impact Dashboard</h1>
          <p className="app__subtitle">
            Compare protected versus unprotected origins across Normal, Spike, and DDoS traffic
            scenarios.
          </p>
        </div>
        {currentStatus && (
          <div className="status-card">
            <span className="status-card__label">Active Simulation</span>
            <span className="status-card__value">
              {currentStatus.type ? currentStatus.type.toUpperCase() : 'N/A'}
            </span>
            <span className="status-card__time">
              Started: {toDisplayTime(currentStatus.startTime)}
            </span>
          </div>
        )}
      </header>

      <section className="controls">
        <h2 className="controls__title">Run a Simulation</h2>
        <div className="controls__buttons">
          {simulationButtons.map((button) => (
            <button
              key={button.type}
              type="button"
              className={`controls__button controls__button--${button.modifier}`}
              onClick={() => handleSimulate(button.type)}
              disabled={loading}
            >
              {loading ? 'Simulating...' : button.label}
            </button>
          ))}
        </div>
        {error && <p className="controls__error">{error}</p>}
      </section>

      <section className="ai-card">
        <h2 className="ai-card__title">AI Traffic Analysis</h2>
        <p className="ai-card__body">
          {aiExplanation ||
            'Trigger a simulation to receive AI-driven insights about the current traffic pattern.'}
        </p>
      </section>

      <section className="charts">
        <div className="charts__item charts__item--line">
          <h3 className="charts__title">Latency Trend</h3>
          <Line data={latencyChartData} options={latencyChartOptions} />
        </div>
        <div className="charts__item charts__item--bar">
          <h3 className="charts__title">Success Rate Comparison</h3>
          <Bar data={successRateData} options={successRateOptions} />
        </div>
      </section>

      <section className="metrics-table">
        <h2 className="metrics-table__title">Recent Simulations</h2>
        <MetricsTable records={metrics} />
      </section>

      <footer className="app__footer">
        Built with Cloudflare Workers, Durable Objects, D1, Workers AI, and Pages.
      </footer>
    </div>
  );
};

export default App;
