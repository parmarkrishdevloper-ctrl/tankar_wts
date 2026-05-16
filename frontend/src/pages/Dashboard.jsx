import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiInbox,
  FiCheckCircle,
  FiUsers,
  FiActivity,
  FiClock,
  FiPhoneCall,
  FiTrendingUp,
  FiRefreshCw,
  FiZap,
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { dashboardAPI } from '../services/api';
import StatCard from '../components/ui/StatCard';
import Skeleton from '../components/ui/Skeleton';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

const STATUS_BADGE = {
  new: 'warning',
  in_progress: 'info',
  completed: 'success',
  callback_requested: 'danger',
};

const STATUS_LABEL = {
  new: 'New',
  in_progress: 'In progress',
  completed: 'Completed',
  callback_requested: 'Callback',
};

function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function num(value) {
  return (value ?? 0).toLocaleString();
}

function compact(value) {
  const v = value ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [s, t, r] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getTrend(7),
        dashboardAPI.getRecent(5),
      ]);
      setStats(s.data.data);
      setTrend(t.data.data || []);
      setRecent(r.data.data || []);
      if (silent) toast.success('Dashboard refreshed');
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const breakdown = useMemo(() => {
    if (!stats) return [];
    const items = [
      { name: 'New', value: stats.pendingEnquiries || 0, color: '#d97706', status: 'new' },
      { name: 'In progress', value: stats.progressEnquiries || 0, color: '#0284c7', status: 'in_progress' },
      { name: 'Completed', value: stats.completedEnquiries || 0, color: '#16a34a', status: 'completed' },
      { name: 'Callbacks', value: stats.callbackRequests || 0, color: '#dc2626', status: 'callback_requested' },
    ];
    return items.filter((i) => i.value > 0 || items.every((j) => j.value === 0));
  }, [stats]);

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
        <div className="grid-2">
          <Skeleton height={320} radius="var(--radius-lg)" />
          <Skeleton height={320} radius="var(--radius-lg)" />
        </div>
      </>
    );
  }

  if (!stats) {
    return (
      <Card padded>
        <p>Unable to load statistics right now.</p>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Button onClick={() => load()}>Retry</Button>
        </div>
      </Card>
    );
  }

  const total = stats.totalEnquiries || 0;
  const completion = pct(stats.completedEnquiries, total);
  const trendTotal = trend.reduce((s, d) => s + d.count, 0);
  const trendAvg = trend.length ? (trendTotal / trend.length).toFixed(1) : 0;
  const tokens = stats.totalTokens || 0;

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Welcome back</h1>
          <p>Here's what is happening across your WhatsApp pipeline.</p>
        </div>
        <Button variant="secondary" onClick={() => load(true)} loading={refreshing}>
          <FiRefreshCw /> Refresh
        </Button>
      </div>

      <div className="grid-stats">
        <ClickableCard onClick={() => navigate('/enquiries')}>
          <StatCard
            label="Total Enquiries"
            value={num(stats.totalEnquiries)}
            icon={FiInbox}
            tone="brand"
            hint="all time"
          />
        </ClickableCard>

        <ClickableCard onClick={() => navigate('/enquiries?status=completed')}>
          <StatCard
            label="Completed Projects"
            value={num(stats.completedEnquiries)}
            icon={FiCheckCircle}
            tone="success"
            delta={`${completion}%`}
            deltaTone="success"
            hint="conversion"
          />
        </ClickableCard>

        <ClickableCard onClick={() => navigate('/conversations')}>
          <StatCard
            label="Active Contacts"
            value={num(stats.totalContacts)}
            icon={FiUsers}
            tone="violet"
            hint="unique customers"
          />
        </ClickableCard>

        <ClickableCard onClick={() => navigate('/enquiries?status=callback_requested')}>
          <StatCard
            label="Pending Callbacks"
            value={num(stats.callbackRequests)}
            icon={FiPhoneCall}
            tone="danger"
            hint="action required"
          />
        </ClickableCard>
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3>Enquiry trend</h3>
              <p>Last 7 days · {trendTotal} total · avg {trendAvg}/day</p>
            </div>
            <Badge tone="success" dot>
              <FiTrendingUp /> Live
            </Badge>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="enq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--c-brand)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--c-brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="var(--c-text-subtle)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--c-text-subtle)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
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
                  labelFormatter={(label, payload) => {
                    const d = payload?.[0]?.payload?.date;
                    return d ? format(new Date(d), 'EEE, d MMM') : label;
                  }}
                  formatter={(value) => [value, 'Enquiries']}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--c-brand)"
                  strokeWidth={2}
                  fill="url(#enq)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3>Status breakdown</h3>
              <p>Pipeline distribution</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            {total === 0 ? (
              <EmptyState
                icon={FiInbox}
                title="Nothing in the pipeline yet"
                description="Leads will appear here once they start coming in."
              />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={breakdown}
                    innerRadius={60}
                    outerRadius={92}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    cornerRadius={4}
                    onClick={(slice) => slice?.status && navigate(`/enquiries?status=${slice.status}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {breakdown.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
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
                    wrapperStyle={{ fontSize: 12, color: 'var(--c-text-muted)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-4)' }}>
        <Card>
          <CardHeader
            title="Recent enquiries"
            subtitle="Latest leads captured from WhatsApp"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/enquiries')}>
                View all <FiArrowRight />
              </Button>
            }
          />
          <CardBody>
            {recent.length === 0 ? (
              <EmptyState
                icon={FiInbox}
                title="No enquiries yet"
                description="When leads come in over WhatsApp, you'll see them here."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recent.map((e) => (
                  <button
                    key={e._id}
                    onClick={() => navigate('/enquiries')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) 0',
                      borderBottom: '1px solid var(--c-border)',
                      background: 'transparent',
                      border: 'none',
                      borderBottomWidth: 1,
                      borderBottomStyle: 'solid',
                      borderBottomColor: 'var(--c-border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div className="avatar avatar-md">
                      {(e.clientName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {e.clientName || e.phoneNumber}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
                        {e.businessName ? `${e.businessName} · ` : ''}
                        {e.createdAt
                          ? formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })
                          : '—'}
                      </div>
                    </div>
                    <Badge tone={STATUS_BADGE[e.status] || 'neutral'} dot>
                      {STATUS_LABEL[e.status] || e.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pipeline overview" subtitle="Status distribution" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <StatusRow icon={FiClock} tone="warning" label="New" hint="Awaiting review"
                value={stats.pendingEnquiries} total={total}
                onClick={() => navigate('/enquiries?status=new')} />
              <StatusRow icon={FiActivity} tone="info" label="In progress" hint="In discussion"
                value={stats.progressEnquiries} total={total}
                onClick={() => navigate('/enquiries?status=in_progress')} />
              <StatusRow icon={FiCheckCircle} tone="success" label="Completed" hint="Closed deals"
                value={stats.completedEnquiries} total={total}
                onClick={() => navigate('/enquiries?status=completed')} />
              <StatusRow icon={FiPhoneCall} tone="danger" label="Callbacks" hint="Action required"
                value={stats.callbackRequests} total={total}
                onClick={() => navigate('/enquiries?status=callback_requested')} />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card padded>
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="stat-card-icon stat-tone-violet" style={{ width: 44, height: 44 }}>
            <FiZap />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 600 }}>LLM token usage</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
              Total tokens consumed across all conversations
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, lineHeight: 1 }}>
              {compact(tokens)}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
              {num(tokens)} tokens
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function ClickableCard({ onClick, children }) {
  return (
    <div onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      style={{ cursor: 'pointer' }}>
      {children}
    </div>
  );
}

function StatusRow({ icon: Icon, tone, label, hint, value, total, onClick }) {
  const percent = pct(value, total);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        cursor: 'pointer',
        padding: 'var(--space-2)',
        marginInline: 'calc(var(--space-2) * -1)',
        borderRadius: 'var(--radius-md)',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div className={`stat-card-icon stat-tone-${tone}`}>
        <Icon />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{label}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>{hint}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>{num(value)}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>{percent}%</div>
          </div>
        </div>
        <div style={{ height: 6, background: 'var(--c-surface-hover)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${percent}%`,
              height: '100%',
              background: `var(--c-${tone})`,
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}
