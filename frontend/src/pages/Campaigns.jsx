import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiPlus,
  FiSend,
  FiUsers,
  FiPlay,
  FiTrash2,
  FiArrowRight,
  FiFileText,
  FiCheckCircle,
  FiAlertTriangle,
  FiTarget,
} from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { campaignsAPI, templatesAPI } from '../services/api';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Field } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import StatCard from '../components/ui/StatCard';

const STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'callback_requested', label: 'Callback' },
];

const STATE_TONE = {
  draft: 'neutral',
  queued: 'warning',
  sending: 'info',
  completed: 'success',
  cancelled: 'danger',
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const [c, t] = await Promise.all([campaignsAPI.list(), templatesAPI.list()]);
      setCampaigns(c.data.data || []);
      setTemplates(t.data.data || []);
    } catch {
      toast.error('Could not load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const totalSent = campaigns.reduce((s, c) => s + (c.stats?.sent || 0) + (c.stats?.simulated || 0), 0);
    const totalFailed = campaigns.reduce((s, c) => s + (c.stats?.failed || 0), 0);
    const totalReplies = campaigns.reduce((s, c) => s + (c.stats?.replied || 0), 0);
    return { totalSent, totalFailed, totalReplies, totalCampaigns: campaigns.length };
  }, [campaigns]);

  const onSend = async (id) => {
    if (!confirm('Send this campaign right now? Messages will go out immediately.')) return;
    try {
      const res = await campaignsAPI.send(id);
      const { sent, simulated, failed } = res.data.data;
      toast.success(
        `Campaign sent — ${sent + simulated} delivered${simulated ? ` (${simulated} simulated)` : ''}${failed ? `, ${failed} failed` : ''}`
      );
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
    }
  };

  const onDelete = async (id) => {
    if (!confirm('Delete this campaign? Already-sent messages stay in conversation history.')) return;
    try {
      await campaignsAPI.remove(id);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="center-block">
        <Spinner size="lg" /> Loading campaigns…
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Campaigns</h1>
          <p>Send a templated broadcast to a targeted slice of your contacts.</p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={templates.length === 0}>
          <FiPlus /> New campaign
        </Button>
      </div>

      {templates.length === 0 && (
        <Card padded style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <FiAlertTriangle style={{ color: 'var(--c-warning-text)' }} />
            <div style={{ flex: 1 }}>
              <strong>Templates required</strong>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--c-text-muted)' }}>
                Campaigns send a template — create at least one first.
              </div>
            </div>
            <Link to="/templates" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Open Templates <FiArrowRight />
            </Link>
          </div>
        </Card>
      )}

      <div className="grid-stats">
        <StatCard label="Total campaigns" value={stats.totalCampaigns} icon={FiTarget} tone="brand" />
        <StatCard label="Messages delivered" value={stats.totalSent.toLocaleString()} icon={FiSend} tone="success" />
        <StatCard label="Failures" value={stats.totalFailed.toLocaleString()} icon={FiAlertTriangle} tone="danger" />
        <StatCard label="Replies received" value={stats.totalReplies.toLocaleString()} icon={FiUsers} tone="info" />
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={FiTarget}
              title="No campaigns yet"
              description="Create your first campaign to send a template to a targeted contact group."
              action={
                <Button onClick={() => setCreating(true)} disabled={templates.length === 0}>
                  <FiPlus /> New campaign
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody style={{ padding: 0 }}>
            {campaigns.map((c, idx) => (
              <div
                key={c._id}
                style={{
                  padding: 'var(--space-4) var(--space-6)',
                  borderBottom: idx < campaigns.length - 1 ? '1px solid var(--c-border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 4 }}>
                      <strong style={{ fontSize: 'var(--text-md)' }}>{c.name}</strong>
                      <Badge tone={STATE_TONE[c.state] || 'neutral'} dot>
                        {c.state}
                      </Badge>
                      {c.templateId && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)' }}>
                          <FiFileText size={11} style={{ verticalAlign: '-2px' }} /> {c.templateId.name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)', marginBottom: 'var(--space-2)' }}>
                      Created {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      {c.sentAt && (
                        <> · Sent {formatDistanceToNow(new Date(c.sentAt), { addSuffix: true })}</>
                      )}
                      {c.target?.statuses?.length > 0 && (
                        <> · Status: {c.target.statuses.join(', ')}</>
                      )}
                      {c.target?.tags?.length > 0 && (
                        <> · Tags: {c.target.tags.join(', ')}</>
                      )}
                    </div>
                    {c.state === 'completed' && (
                      <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
                        <span><FiCheckCircle style={{ color: 'var(--c-success-text)' }} /> Sent: <strong>{(c.stats?.sent || 0) + (c.stats?.simulated || 0)}</strong>{c.stats?.simulated > 0 && ` (${c.stats.simulated} simulated)`}</span>
                        <span>Failed: <strong>{c.stats?.failed || 0}</strong></span>
                        <span>Replies: <strong>{c.stats?.replied || 0}</strong></span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {c.state === 'draft' && (
                      <Button size="sm" onClick={() => onSend(c._id)}>
                        <FiPlay /> Send now
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" iconOnly onClick={() => onDelete(c._id)} title="Delete">
                      <FiTrash2 />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {creating && (
        <CampaignBuilder
          templates={templates}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </>
  );
}

function CampaignBuilder({ templates, onCancel, onCreated }) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(templates[0]?._id || '');
  const [statuses, setStatuses] = useState([]);
  const [tagsInput, setTagsInput] = useState('');
  const [inactiveDaysMin, setInactiveDaysMin] = useState(0);
  const [respectPaused, setRespectPaused] = useState(true);
  const [preview, setPreview] = useState({ count: null, sample: [] });
  const [creating, setCreating] = useState(false);

  const tags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput]
  );

  const buildTarget = () => ({
    statuses,
    tags,
    inactiveDaysMin: Number(inactiveDaysMin) || 0,
    respectPaused,
  });

  const runPreview = async () => {
    try {
      const res = await campaignsAPI.preview(buildTarget());
      setPreview(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Preview failed');
    }
  };

  useEffect(() => {
    runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, tagsInput, inactiveDaysMin, respectPaused]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !templateId) return;
    setCreating(true);
    try {
      await campaignsAPI.create({
        name: name.trim(),
        templateId,
        target: buildTarget(),
      });
      toast.success('Campaign created');
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = (s) => {
    setStatuses((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));
  };

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title="New campaign"
      maxWidth={680}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit} loading={creating} disabled={!name || !templateId}>
            Create as draft
          </Button>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Field label="Campaign name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali offer 2026" autoFocus />
        </Field>

        <Field label="Template" hint="The message body that gets sent.">
          <select
            className="select"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            style={{
              height: 40,
              padding: '0 var(--space-3)',
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--c-text)',
              fontSize: 'var(--text-sm)',
              width: '100%',
            }}
          >
            {templates.map((t) => (
              <option key={t._id} value={t._id}>
                [{t.category}] {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Target — enquiry statuses" hint="Leave all unchecked to target every status.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {STATUSES.map((s) => {
              const on = statuses.includes(s.value);
              return (
                <label
                  key={s.value}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${on ? 'var(--c-brand)' : 'var(--c-border)'}`,
                    background: on ? 'var(--c-brand-soft)' : 'var(--c-surface)',
                    color: on ? 'var(--c-brand-text)' : 'var(--c-text)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <input type="checkbox" checked={on} onChange={() => toggleStatus(s.value)} />
                  {s.label}
                </label>
              );
            })}
          </div>
        </Field>

        <Field
          label="Tags filter"
          hint="Comma-separated. Targets contacts whose enquiry has ANY of these tags. Leave empty to ignore tags."
        >
          <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. high-priority, e-com" />
        </Field>

        <Field label="Minimum days of inactivity" hint="Only target contacts with no activity in the last N days. 0 = no filter.">
          <Input type="number" min={0} value={inactiveDaysMin} onChange={(e) => setInactiveDaysMin(e.target.value)} />
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
          <input type="checkbox" checked={respectPaused} onChange={(e) => setRespectPaused(e.target.checked)} />
          Skip contacts with "Bot paused" (recommended — those are being handled manually)
        </label>

        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--c-info-soft)',
            color: 'var(--c-info-text)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <FiUsers />
          <strong>{preview.count ?? 0} contacts</strong>
          {preview.count > 0 && preview.sample.length > 0 && (
            <span style={{ opacity: 0.8, fontSize: 'var(--text-xs)' }}>
              · e.g. {preview.sample.slice(0, 3).map((c) => c.phoneNumber).join(', ')}
              {preview.sample.length > 3 && ' …'}
            </span>
          )}
        </div>
      </form>
    </Modal>
  );
}
