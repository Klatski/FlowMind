import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  Tooltip, ReferenceArea, ReferenceLine, CartesianGrid,
} from 'recharts';
import { fmt } from '../cashflow.js';

const tickShort = (v) => new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(v);
const tickDay = (d) => d.slice(5);

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{
      background: '#0b1530', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: 10, fontSize: 13, minWidth: 200,
    }}>
      <div style={{ color: '#9aa6cf', marginBottom: 4 }}>{label}</div>
      <div>Баланс: <b style={{ color: p.balance < 0 ? '#ef4444' : '#e6ebff' }}>{fmt(p.balance)} ₸</b></div>
      {p.inflow > 0 && <div>Поступления: <b style={{ color: '#22c55e' }}>+{fmt(p.inflow)}</b></div>}
      {p.outflow > 0 && <div>Списания: <b style={{ color: '#f59e0b' }}>−{fmt(p.outflow)}</b></div>}
    </div>
  );
}

export default function Timeline({ series, gaps }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer>
        <ComposedChart data={series} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
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

          {gaps.map((g, i) => (
            <ReferenceArea key={i} x1={g.start} x2={g.end} y1="auto" y2="auto"
              fill="#ef4444" fillOpacity={0.18} stroke="#ef4444" strokeOpacity={0.45} />
          ))}
          <ReferenceLine y={0} stroke="rgba(239, 68, 68, 0.6)" strokeDasharray="4 4" />

          <Area type="monotone" dataKey="balance" stroke="#3b82f6" fill="url(#balanceFill)" strokeWidth={2.5} />
          <Line type="monotone" dataKey="balance" stroke="transparent"
            dot={(p) => {
              if (!p.payload.isGap) return null;
              return <circle key={p.index} cx={p.cx} cy={p.cy} r={3.5} fill="#ef4444" stroke="#0b1530" strokeWidth={1.5} />;
            }} activeDot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
