import React, { useEffect, useState } from 'react';
import { LineChart, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';

interface ForecastResponse {
  horizonDays: number;
  isPreliminary: boolean;
  canSupport90Days: boolean;
  dataSummary: {
    historyDaysObserved: number;
    transactionCount: number;
    baselineDailyInflow: number;
    baselineDailyOutflow: number;
    startingAvailableCash: number;
  };
  methodology: {
    primaryModel: string;
    modelsEvaluated: string[];
    backtestMetrics: {
      sampleWeeks: number;
      maeInflow: number | null;
      rmseInflow: number | null;
      mapeInflowPct: number | null;
      status: string;
    };
    note: string;
  };
  summary: {
    projectedEndBalance: number;
    totalExpectedInflow: number;
    totalExpectedOutflow: number;
    lowestProjectedCash: number;
    lowestProjectedDate: string;
  };
  warnings: Array<{ type: string; severity: string; date: string; title: string; reason: string }>;
  points: Array<{
    date: string;
    kind: 'actual' | 'forecast';
    projectedBalance: number;
    inflow: number;
    outflow: number;
    events: Array<{ type: string; amount: number; label: string }>;
  }>;
}

export const ForecastPage: React.FC = () => {
  const [horizon, setHorizon] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<ForecastResponse | null>(null);

  useEffect(() => {
    apiFetch<ForecastResponse>(`/api/finance/forecast?days=${horizon}`).then(setData).catch(() => {});
  }, [horizon]);

  if (!data) {
    return <div className="h-56 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  // Build crisp SVG line chart path
  const values = data.points.map((p) => p.projectedBalance);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(1000, ...values);
  const span = Math.max(1, maxVal - minVal);
  const width = 760;
  const height = 220;
  const padX = 20;
  const padY = 20;

  const coords = data.points.map((p, idx) => {
    const x = padX + (idx / Math.max(1, data.points.length - 1)) * (width - padX * 2);
    const y = padY + ((maxVal - p.projectedBalance) / span) * (height - padY * 2);
    return { x, y, p };
  });

  const pathD = coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const zeroY = padY + ((maxVal - 0) / span) * (height - padY * 2);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Predictive Cash-Flow Forecasting</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Forecasts inflows, outflows, and shortage risks using moving averages, exponential smoothing, and scheduled bills.
          </p>
        </div>

        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setHorizon(d)}
              className={`px-3 py-1.5 rounded-md cursor-pointer ${
                horizon === d ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {d}-Day Forecast
            </button>
          ))}
        </div>
      </div>

      {data.isPreliminary && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Preliminary Forecast Notice</p>
            <p className="mt-0.5">{data.methodology.note}</p>
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-surface p-4">
          <p className="text-xs text-slate-500">Actual Starting Cash (Today)</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {formatInr(data.dataSummary.startingAvailableCash)}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs text-slate-500">Predicted {horizon}d Inflows</p>
          <p className="text-xl font-bold text-blue-700 mt-1">
            +{formatInr(data.summary.totalExpectedInflow)}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs text-slate-500">Predicted {horizon}d Outflows</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            -{formatInr(data.summary.totalExpectedOutflow)}
          </p>
        </div>
        <div className="card-surface p-4 border-blue-200 bg-blue-50/40">
          <p className="text-xs text-blue-700 font-medium">Projected End Balance</p>
          <p className="text-xl font-bold text-blue-800 mt-1">
            {formatInr(data.summary.projectedEndBalance)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Lowest: {formatInr(data.summary.lowestProjectedCash)} ({data.summary.lowestProjectedDate})
          </p>
        </div>
      </section>

      {/* Chart */}
      <section className="card-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-blue-600" /> Projected Cash Balance Curve ({horizon} Days)
          </h2>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" /> Actual Today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-600 inline-block" /> Forecasted Trajectory
            </span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 min-w-[500px]">
            {/* Zero threshold line */}
            <line
              x1={padX}
              y1={zeroY}
              x2={width - padX}
              y2={zeroY}
              stroke="#cbd5e1"
              strokeDasharray="4 4"
            />
            <text x={padX} y={Math.max(12, zeroY - 4)} fill="#64748b" fontSize="10">
              ₹0 Cash Threshold
            </text>

            {/* Forecast Line */}
            <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />

            {/* Actual starting point */}
            {coords[0] && (
              <circle cx={coords[0].x} cy={coords[0].y} r="5" fill="#0f172a" />
            )}

            {/* End point */}
            {coords.length > 1 && (
              <circle
                cx={coords[coords.length - 1].x}
                cy={coords[coords.length - 1].y}
                r="4.5"
                fill="#2563eb"
              />
            )}
          </svg>
        </div>

        <div className="flex justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
          <span>Actual: {data.points[0]?.date} ({formatInr(data.points[0]?.projectedBalance)})</span>
          <span>Forecast Horizon End: {data.points[data.points.length - 1]?.date} ({formatInr(data.summary.projectedEndBalance)})</span>
        </div>
      </section>

      {/* Early Warnings & Backtesting Metrics */}
      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 card-surface p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Early Warnings & Financial Pressure Windows</h2>
          {data.warnings.length === 0 ? (
            <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100 text-xs text-blue-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              No cash shortages projected over the next {horizon} days based on current trends and scheduled obligations.
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.warnings.map((w, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                    w.severity === 'high'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{w.title}</p>
                    <p className="mt-0.5 opacity-90">{w.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 card-surface p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Model Selection & Backtest Quality</h2>
          <div className="text-xs text-slate-600 space-y-2">
            <p>
              <strong>Selected Model:</strong> {data.methodology.primaryModel}
            </p>
            <p>
              <strong>Observed History:</strong> {data.dataSummary.historyDaysObserved} days ({data.dataSummary.transactionCount} operating entries)
            </p>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
              <p className="font-semibold text-slate-800">Walk-Forward Weekly Backtest Metrics</p>
              <p>Status: {data.methodology.backtestMetrics.status}</p>
              {data.methodology.backtestMetrics.maeInflow !== null && (
                <>
                  <p>Weekly Inflow MAE: {formatInr(data.methodology.backtestMetrics.maeInflow)}</p>
                  <p>Weekly Inflow RMSE: {formatInr(data.methodology.backtestMetrics.rmseInflow)}</p>
                  {data.methodology.backtestMetrics.mapeInflowPct !== null && (
                    <p>MAPE: {data.methodology.backtestMetrics.mapeInflowPct}%</p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
