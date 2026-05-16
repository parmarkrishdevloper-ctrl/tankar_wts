import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiDollarSign,
  FiTrendingUp,
  FiZap,
  FiCalendar,
  FiRefreshCw,
  FiSettings,
  FiArrowRight,
} from 'react-icons/fi';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { dashboardAPI } from '../services/api';
import StatCard from '../components/ui/StatCard';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

function compact(value) {
  const v = value ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

function formatMoney(value, currency, usdToInr) {
  const v = value ?? 0;
  const base = `${currency === 'INR' ? '₹' : '$'}${v.toFixed(4)}`;
  if (currency === 'USD' && usdToInr) {
    const inr = v * usdToInr;
    return `${base} · ≈ ₹${inr.toFixed(2)}`;
  }
  return base;
}

function shortMoney(value, currency) {
  const v = value ?? 0;
  const sym = currency === 'INR' ? '₹' : '$';
  if (v >= 1) return `${sym}${v.toFixed(2)}`;
  if (v >= 0.01) return `${sym}${v.toFixed(4)}`;
  return `${sym}${v.toFixed(6)}`;
}

export default function Cost() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState(30);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await dashboardAPI.getCost(range);
      setData(res.data.data);
      if (silent) toast.success('Refreshed');
    } catch {
      toast.error('Failed to load cost data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const trendCost = useMemo(() => {
    if (!data?.trend) return [];
    return data.trend.map((d) => ({
      ...d,
      label: format(new Date(d.date), 'd MMM'),
    }));
  }, [data]);

  const totalTrendCost = useMemo(
    () => trendCost.reduce((s, d) => s + (d.cost || 0), 0),
    [trendCost]
  );
  const peakDay = useMemo(() => {
    if (!trendCost.length) return null;
    return trendCost.reduce((max, d) => (d.cost > (max?.cost || 0) ? d : max), null);
  }, [trendCost]);

  if (loading) {
    return (
      <>
        <div className="grid-stats">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card">
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={28} />
              <Skeleton width="80%" height={12} />
            </div>
          ))}
        </div>
        <Skeleton height={320} radius="var(--radius-lg)" />
      </>
    );
  }

  if (!data) return null;

  const { rates, today, week, month, lifetime, topContacts } = data;
  const currency = rates.currency;
  const usdToInr = rates.usdToInr;

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>LLM cost</h1>
          <p>
            Token usage and estimated spend based on{' '}
            <strong>{rates.llmModel}</strong> @ {shortMoney(rates.inputPer1M, currency)} in /{' '}
            {shortMoney(rates.outputPer1M, currency)} out per 1M tokens.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Link
            to="/settings"
            className="btn btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            <FiSettings /> Edit rates
          </Link>
          <Button variant="secondary" onClick={() => load(true)} loading={refreshing}>
            <FiRefreshCw /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid-stats">
        <StatCard
          label="Today"
          value={shortMoney(today.cost, currency)}
          icon={FiZap}
          tone="brand"
          hint={`${(today.messages || 0).toLocaleString()} messages · ${compact((today.inputTokens || 0) + (today.outputTokens || 0))} tokens`}
        />
        <StatCard
          label="Last 7 days"
          value={shortMoney(week.cost, currency)}
          icon={FiCalendar}
          tone="info"
          hint={`${(week.messages || 0).toLocaleString()} messages · ${compact((week.inputTokens || 0) + (week.outputTokens || 0))} tokens`}
        />
        <StatCard
          label="Last 30 days"
          value={shortMoney(month.cost, currency)}
          icon={FiTrendingUp}
          tone="violet"
          hint={`${(month.messages || 0).toLocaleString()} messages · ${compact((month.inputTokens || 0) + (month.outputTokens || 0))} tokens`}
        />
        <StatCard
          label="Lifetime"
          value={shortMoney(lifetime.cost, currency)}
          icon={FiDollarSign}
          tone="success"
          hint={`${compact((lifetime.inputTokens || 0) + (lifetime.outputTokens || 0))} tokens total`}
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3>Daily cost</h3>
              <p>
                Last {range} days · total {shortMoney(totalTrendCost, currency)}
                {peakDay && peakDay.cost > 0 && (
                  <> · peak {format(new Date(peakDay.date), 'd MMM')} ({shortMoney(peakDay.cost, currency)})</>
                )}
              </p>
            </div>
            <div className="segmented" style={{ padding: 2 }}>
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  className={`segmented-item ${range === d ? 'active' : ''}`}
                  onClick={() => setRange(d)}
                  style={{ fontSize: 'var(--text-xs)', height: 24, padding: '0 8px' }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={trendCost} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--c-brand)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--c-brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--c-text-subtle)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.ceil(trendCost.length / 12)}
                />
                <YAxis
                  stroke="var(--c-text-subtle)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => shortMoney(v, currency)}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 8,
                    boxShadow: 'var(--shadow-md)',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--c-text-muted)' }}
                  formatter={(value, name, props) => {
                    if (name === 'cost') return [shortMoney(value, currency), 'Cost'];
                    return [value, name];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="var(--c-brand)"
                  strokeWidth={2}
                  fill="url(#cost)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3>Token usage</h3>
              <p>Input vs output, per day</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={trendCost} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--c-text-subtle)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.ceil(trendCost.length / 12)}
                />
                <YAxis
                  stroke="var(--c-text-subtle)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => compact(v)}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 8,
                    boxShadow: 'var(--shadow-md)',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--c-text-muted)' }}
                  formatter={(value) => value.toLocaleString()}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: 'var(--c-text-muted)' }}
                />
                <Bar dataKey="inputTokens" name="Input" stackId="t" fill="#4f46e5" radius={[0, 0, 0, 0]} />
                <Bar dataKey="outputTokens" name="Output" stackId="t" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Top contacts by spend"
          subtitle="Contacts that have used the most LLM tokens"
          action={
            <Link
              to="/conversations"
              className="btn btn-ghost btn-sm"
              style={{ textDecoration: 'none' }}
            >
              All conversations <FiArrowRight />
            </Link>
          }
        />
        <CardBody style={{ padding: 0 }}>
          {topContacts.length === 0 || lifetime.cost === 0 ? (
            <EmptyState
              icon={FiZap}
              title="No usage yet"
              description="Once the bot starts replying to WhatsApp messages, spend will appear here."
            />
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Conversations</th>
                    <th>Input</th>
                    <th>Output</th>
                    <th>Total tokens</th>
                    <th>Spend</th>
                    <th>Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {topContacts.map((c) => (
                    <tr key={c.phoneNumber}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div className="avatar avatar-sm">
                            {c.phoneNumber.slice(-2)}
                          </div>
                          <Link
                            to={`/conversations/${c.phoneNumber}`}
                            style={{
                              fontWeight: 600,
                              color: 'var(--c-text)',
                              textDecoration: 'none',
                            }}
                          >
                            {c.phoneNumber}
                          </Link>
                        </div>
                      </td>
                      <td style={{ color: 'var(--c-text-muted)' }}>{c.totalConversations}</td>
                      <td style={{ color: 'var(--c-text-muted)' }}>{compact(c.inputTokens)}</td>
                      <td style={{ color: 'var(--c-text-muted)' }}>{compact(c.outputTokens)}</td>
                      <td style={{ fontWeight: 600 }}>{compact(c.inputTokens + c.outputTokens)}</td>
                      <td style={{ fontWeight: 600 }}>{shortMoney(c.cost, currency)}</td>
                      <td style={{ color: 'var(--c-text-muted)' }}>
                        {c.lastContactDate
                          ? formatDistanceToNow(new Date(c.lastContactDate), { addSuffix: true })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {currency === 'USD' && usdToInr > 0 && lifetime.cost > 0 && (
        <Card padded style={{ marginTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div className="stat-card-icon stat-tone-info" style={{ width: 44, height: 44 }}>
              <FiDollarSign />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Lifetime spend in INR</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
                At ₹{usdToInr}/USD — change this in Settings if your rate differs.
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, lineHeight: 1 }}>
                ₹{(lifetime.cost * usdToInr).toFixed(2)}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
                {formatMoney(lifetime.cost, currency, 0)}
              </div>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
