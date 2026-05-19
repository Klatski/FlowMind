import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  Tooltip, ReferenceArea, ReferenceLine, CartesianGrid, Legend,
} from 'recharts';
import { useMemo } from 'react';
import { fmt } from '../cashflow.js';

const tickShort = (v) => new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(v);
const tickDay = (d) => d.slice(5);

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{
      background: '#0b1530', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: 10, fontSize: 13, minWidth: 220,
    }}>
      <div style={{ color: '#9aa6cf', marginBottom: 4 }}>{label}</div>
      <div>Баланс: <b style={{ color: p.balance < 0 ? '#ef4444' : '#e6ebff' }}>{fmt(p.balance)} ₸</b></div>
      {p.previewBalance !== undefined && p.previewBalance !== null && (
        <div>После AI: <b style={{ color: p.previewBalance < 0 ? '#ef4444' : '#22d3ee' }}>
          {fmt(p.previewBalance)} ₸
        </b></div>
      )}
      {p.inflow > 0 && <div>Поступления: <b style={{ color: '#22c55e' }}>+{fmt(p.inflow)}</b></div>}
      {p.outflow > 0 && <div>Списания: <b style={{ color: '#f59e0b' }}>−{fmt(p.outflow)}</b></div>}
    </div>
  );
}

export default function Timeline({ series, gaps, previewSeries = null, previewGaps = null }) {
  // Merge preview balance into the main series rows so a single chart can
  // render both the solid current curve and the dashed preview curve.
  const data = useMemo(() => {
    if (!previewSeries) return series;
    const byDay = new Map(previewSeries.map((p) => [p.day, p.balance]));
    return series.map((p) => ({ ...p, previewBalance: byDay.has(p.day) ? byDay.get(p.day) : null }));
  }, [series, previewSeries]);

  const showPreview = Boolean(previewSeries);

  return (
    <div className="chart-wrap">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={tickDay} stroke="#6f7aa1" fontSize={11} />
          <YAxis tickFormatter={tickShort} stroke="#6f7aa1" fontSize={11} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
          {showPreview && (
            <Legend
              verticalAlign="top"
              align="right"
              height={24}
              iconType="plainline"
              wrapperStyle={{ fontSize: 11, color: '#9aa6cf' }}
            />
          )}

          {gaps.map((g, i) => (
            <ReferenceArea key={`gap-${i}`} x1={g.start} x2={g.end} y1="auto" y2="auto"
              fill="#ef4444" fillOpacity={0.18} stroke="#ef4444" strokeOpacity={0.45} />
          ))}
          {showPreview && previewGaps && previewGaps.map((g, i) => (
            <ReferenceArea key={`pgap-${i}`} x1={g.start} x2={g.end} y1="auto" y2="auto"
              fill="#22d3ee" fillOpacity={0.10} stroke="#22d3ee" strokeOpacity={0.35} strokeDasharray="4 4" />
          ))}
          <ReferenceLine y={0} stroke="rgba(239, 68, 68, 0.6)" strokeDasharray="4 4" />

          <Area type="monotone" dataKey="balance" name="Текущий"
            stroke="#3b82f6" fill="url(#balanceFill)" strokeWidth={2.5} isAnimationActive={false} />
          {showPreview && (
            <Line type="monotone" dataKey="previewBalance" name="После AI-сценария"
              stroke="#22d3ee" strokeWidth={2.2} strokeDasharray="6 4"
              dot={false} activeDot={{ r: 4, fill: '#22d3ee', stroke: '#0b1530', strokeWidth: 1.5 }}
              connectNulls isAnimationActive={false} />
          )}
          <Line type="monotone" dataKey="balance" stroke="transparent"
            dot={(p) => {
              if (!p.payload.isGap) return null;
              return <circle key={p.index} cx={p.cx} cy={p.cy} r={3.5} fill="#ef4444" stroke="#0b1530" strokeWidth={1.5} />;
            }} activeDot={false} legendType="none" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
