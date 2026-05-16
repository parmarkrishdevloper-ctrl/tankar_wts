import { useEffect, useMemo, useState } from 'react';
import {
  FiInbox,
  FiUpload,
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiUser,
  FiPercent,
  FiRefreshCw,
  FiTrendingUp,
} from 'react-icons/fi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { analyticsAPI } from '../services/api';
import StatCard from '../components/ui/StatCard';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import Badge from '../components/ui/Badge';

function formatDuration(secs) {
  if (!secs || secs < 0) return '—';
  if (secs < 60) return `${secs.toFixed(1)}s`;
  if (secs < 3600) return `${(secs / 60).toFixed(1)}m`;
  return `${(secs / 3600).toFixed(1)}h`;
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState(30);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await analyticsAPI.get(range);
      setData(res.data.data);
      if (silent) toast.success('Refreshed');
    } catch {
      toast.error('Could not load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const trend = useMemo(() => {
    if (!data?.trend) return [];
    return data.trend.map((d) => ({ ...d, label: format(new Date(d.date), 'd MMM') }));
  }, [data]);

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

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Conversation analytics</h1>
          <p>How well the bot and agents are converting incoming messages into outcomes.</p>
        </div>
        <Button variant="secondary" onClick={() => load(true)} loading={refreshing}>
          <FiRefreshCw /> Refresh
        </Button>
      </div>

      <div className="grid-stats">
        <StatCard
          label="Total incoming"
          value={data.totals.incoming.toLocaleString()}
          icon={FiInbox}
          tone="brand"
          hint="messages from customers"
        />
        <StatCard
          label="Total outgoing"
          value={data.totals.outgoing.toLocaleString()}
          icon={FiUpload}
          tone="violet"
          hint="replies from bot / agents"
        />
        <StatCard
          label="Reply success rate"
          value={`${data.replySuccessRate.toFixed(1)}%`}
          icon={FiPercent}
          tone={data.replySuccessRate > 90 ? 'success' : data.replySuccessRate > 70 ? 'info' : 'warning'}
          hint="incoming messages that got a reply"
        />
        <StatCard
          label="Avg response time"
          value={formatDuration(data.avgResponseSecs)}
          icon={FiClock}
          tone="info"
          hint={
            data.fastestSecs > 0
              ? `fastest ${formatDuration(data.fastestSecs)} · slowest ${formatDuration(data.slowestSecs)}`
              : 'across all replies'
          }
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-4)' }}>
        <Card>
          <CardHeader title="Bot vs human" subtitle="Who's resolving leads and who's stepping in" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <PercentRow
                label="Bot resolution"
                hint={`${data.botResolvedEnquiries} / ${data.totalEnquiries} enquiries closed without human takeover`}
                value={data.botResolutionPct}
                tone="success"
                icon={FiCpu}
              />
              <PercentRow
                label="Human takeover"
                hint={`${data.everPausedContacts} / ${data.totalContacts} contacts had bot paused at some point`}
                value={data.humanTakeoverPct}
                tone="warning"
                icon={FiUser}
              />
              <PercentRow
                label="Completion rate"
                hint={`${data.completedEnquiries} / ${data.totalEnquiries} enquiries reached 'completed'`}
                value={data.totalEnquiries === 0 ? 0 : (data.completedEnquiries / data.totalEnquiries) * 100}
                tone="brand"
                icon={FiCheckCircle}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Message flow"
            subtitle={`Incoming vs outgoing, last ${range} days`}
            action={
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
            }
          />
          <CardBody>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--c-text-subtle)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.ceil(trend.length / 12)}
                  />
                  <YAxis
                    stroke="var(--c-text-subtle)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--c-surface)',
                      border: '1px solid var(--c-border)',
                      borderRadius: 8,
                      boxShadow: 'var(--shadow-md)',
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: 'var(--c-text-muted)' }}
                  />
                  <Bar dataKey="incoming" name="Incoming" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outgoing" name="Outgoing" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card padded>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div className="stat-card-icon stat-tone-info" style={{ width: 44, height: 44 }}>
            <FiTrendingUp />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>What "reply success" means</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
              A customer message is "successfully replied to" if an assistant message follows it within 24 hours.
              The bot and human replies are counted together. <Badge tone="brand">{data.totals.outgoing.toLocaleString()}</Badge> replies sent total.
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function PercentRow({ label, hint, value, tone, icon: Icon }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
        <div className={`stat-card-icon stat-tone-${tone}`} style={{ width: 32, height: 32 }}>
          <Icon />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{label}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>{hint}</div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{pct.toFixed(1)}%</div>
      </div>
      <div style={{ height: 6, background: 'var(--c-surface-hover)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: `var(--c-${tone})`,
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}
