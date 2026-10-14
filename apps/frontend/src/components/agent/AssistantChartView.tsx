import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AssistantChart } from './assistantChart';

const money = (currency: 'UYU' | 'USD') => (value: number) =>
  new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export const AssistantChartView = ({ chart }: { chart: AssistantChart }) => {
  const format = money(chart.currency);

  return (
    <div className="mt-3 w-full">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-300">{chart.title}</p>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chart.kind === 'category' ? (
            <BarChart data={chart.data} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#d1d5db', fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#d1d5db', fontSize: 12 }} tickFormatter={format} width={88} />
              <Tooltip formatter={(value: number) => format(value)} contentStyle={{ background: '#111827', border: '1px solid #374151' }} />
              <Bar dataKey="value" name="Gasto" radius={[4, 4, 0, 0]}>
                {chart.data.map(point => (
                  <Cell key={point.name} fill={point.color} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={chart.data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#d1d5db', fontSize: 12 }} />
              <YAxis tick={{ fill: '#d1d5db', fontSize: 12 }} tickFormatter={format} width={88} />
              <Tooltip formatter={(value: number) => format(value)} contentStyle={{ background: '#111827', border: '1px solid #374151' }} />
              <Legend />
              <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gastos" name="Gastos" stroke="#f87171" strokeWidth={2} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
