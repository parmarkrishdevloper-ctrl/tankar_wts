import { useEffect, useMemo, useState } from 'react';
import {
  FiClock,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiPower,
  FiPlay,
  FiSend,
  FiInfo,
  FiCheckCircle,
} from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { followupsAPI } from '../services/api';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Field, Textarea } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'callback_requested', label: 'Callback' },
];

const PRESETS = [
  {
    name: '24-hour nudge for silent leads',
    afterMinutes: 24 * 60,
    statuses: ['new', 'in_progress'],
    messageBody:
      "Hi! Just checking in — did you have any other questions about {{businessName}}? Happy to help when you're ready.",
  },
  {
    name: '48-hour final follow-up',
    afterMinutes: 48 * 60,
    statuses: ['new'],
    messageBody:
      "Last note from {{businessName}} — should I close out your enquiry, or would you like to keep talking?",
  },
  {
    name: '7-day post-project check-in',
    afterMinutes: 7 * 24 * 60,
    statuses: ['completed'],
    messageBody:
      'Hi! Hope your website is working out well. Anything you need from {{businessName}}?',
  },
];

function minutesToHuman(min) {
  if (min < 60) return `${min}m`;
  if (min < 1440) {
    const h = Math.round(min / 60);
    return `${h}h`;
  }
  const d = Math.round(min / 1440);
  return `${d}d`;
}

export default function Followups() {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | seq

  const load = async () => {
    try {
      const res = await followupsAPI.list();
      setSequences(res.data.data || []);
    } catch {
      toast.error('Failed to load follow-up sequences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalSent = useMemo(
    () => sequences.reduce((s, x) => s + (x.totalSent || 0), 0),
    [sequences]
  );
  const totalWaiting = useMemo(
    () => sequences.filter((s) => s.enabled).reduce((sum, x) => sum + (x.matchesNow || 0), 0),
    [sequences]
  );
  const enabledCount = sequences.filter((s) => s.enabled).length;

  const handleSave = async (data) => {
    try {
      if (editing === 'new' || (typeof editing === 'object' && !editing._id)) {
        const res = await followupsAPI.create(data);
        toast.success('Sequence created');
      } else {
        await followupsAPI.update(editing._id, data);
        toast.success('Sequence updated');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const handleToggle = async (seq) => {
    try {
      await followupsAPI.update(seq._id, { enabled: !seq.enabled });
      load();
    } catch {
      toast.error('Failed to toggle');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this sequence? Already-sent followups will stay in conversation history.')) return;
    try {
      await followupsAPI.remove(id);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleRunNow = async (seq) => {
    if (!confirm(`Run "${seq.name}" right now? Matching contacts (${seq.matchesNow || 0}) will receive the message immediately.`)) return;
    try {
      const res = await followupsAPI.runNow(seq._id);
      const { sent } = res.data;
      toast.success(`Fired — sent to ${sent} contact${sent === 1 ? '' : 's'}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Run failed');
    }
  };

  if (loading) {
    return (
      <div className="center-block">
        <Spinner size="lg" /> Loading sequences…
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Follow-ups</h1>
          <p>Automatically nudge silent leads. The scheduler runs every minute.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <FiPlus /> New sequence
        </Button>
      </div>

      <div className="grid-stats" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Active sequences</span>
            <span className="stat-card-icon stat-tone-brand">
              <FiPower />
            </span>
          </div>
          <div className="stat-card-value">{enabledCount}</div>
          <div className="stat-card-meta">
            <span className="stat-card-hint">{sequences.length} total</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Waiting right now</span>
            <span className="stat-card-icon stat-tone-warning">
              <FiClock />
            </span>
          </div>
          <div className="stat-card-value">{totalWaiting}</div>
          <div className="stat-card-meta">
            <span className="stat-card-hint">contacts due a nudge</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Total followups sent</span>
            <span className="stat-card-icon stat-tone-success">
              <FiCheckCircle />
            </span>
          </div>
          <div className="stat-card-value">{totalSent.toLocaleString()}</div>
          <div className="stat-card-meta">
            <span className="stat-card-hint">all time</span>
          </div>
        </div>
      </div>

      {sequences.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={FiClock}
              title="No follow-up sequences yet"
              description="Set up an automated nudge for silent leads. Start with a preset below."
              action={
                <Button onClick={() => setEditing('new')}>
                  <FiPlus /> Create your first
                </Button>
              }
            />
            <div style={{ marginTop: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                Or start with a preset:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setEditing({
                        name: p.name,
                        afterMinutes: p.afterMinutes,
                        statuses: p.statuses,
                        maxSendsPerContact: 1,
                        messageBody: p.messageBody,
                        enabled: true,
                      })
                    }
                    style={{
                      textAlign: 'left',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--c-border)',
                      background: 'var(--c-surface-2)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)' }}>
                      Fires after {minutesToHuman(p.afterMinutes)} of silence on: {p.statuses.join(', ')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody style={{ padding: 0 }}>
            {sequences.map((seq, idx) => (
              <div
                key={seq._id}
                style={{
                  padding: 'var(--space-4) var(--space-6)',
                  borderBottom: idx < sequences.length - 1 ? '1px solid var(--c-border)' : 'none',
                  background: seq.enabled ? 'var(--c-surface)' : 'var(--c-surface-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <div className="stat-card-icon stat-tone-violet" style={{ width: 36, height: 36 }}>
                    <FiClock />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 4 }}>
                      <strong style={{ fontSize: 'var(--text-md)' }}>{seq.name}</strong>
                      {seq.enabled ? (
                        <Badge tone="success" dot>Active</Badge>
                      ) : (
                        <Badge tone="neutral">Paused</Badge>
                      )}
                      {(seq.matchesNow || 0) > 0 && seq.enabled && (
                        <Badge tone="warning">
                          {seq.matchesNow} waiting
                        </Badge>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)', marginBottom: 'var(--space-2)' }}>
                      Fires after <strong>{minutesToHuman(seq.afterMinutes)}</strong> of silence
                      {seq.statuses && seq.statuses.length > 0 && (
                        <> on <strong>{seq.statuses.join(', ')}</strong> enquiries</>
                      )}
                      {' · '}
                      Max <strong>{seq.maxSendsPerContact}</strong> send{seq.maxSendsPerContact === 1 ? '' : 's'} per contact
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--c-text)',
                        background: 'var(--c-surface-2)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        whiteSpace: 'pre-wrap',
                        marginBottom: 'var(--space-2)',
                      }}
                    >
                      {seq.messageBody}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
                      <span>📤 Sent total: <strong>{seq.totalSent || 0}</strong></span>
                      {seq.lastRunAt && (
                        <span>Last run: {formatDistanceToNow(new Date(seq.lastRunAt), { addSuffix: true })}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRunNow(seq)}
                      disabled={!seq.enabled || (seq.matchesNow || 0) === 0}
                      title={seq.enabled ? 'Fire immediately for matching contacts' : 'Enable the sequence first'}
                    >
                      <FiPlay /> Run now
                    </Button>
                    <Button size="sm" variant="ghost" iconOnly onClick={() => handleToggle(seq)} title={seq.enabled ? 'Disable' : 'Enable'}>
                      <FiPower />
                    </Button>
                    <Button size="sm" variant="ghost" iconOnly onClick={() => setEditing(seq)}>
                      <FiEdit2 />
                    </Button>
                    <Button size="sm" variant="ghost" iconOnly onClick={() => handleDelete(seq._id)}>
                      <FiTrash2 />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {editing && (
        <FollowupEditor
          initial={
            editing === 'new'
              ? {
                  name: '',
                  afterMinutes: 1440,
                  statuses: ['new', 'in_progress'],
                  maxSendsPerContact: 1,
                  messageBody: '',
                  enabled: true,
                }
              : editing
          }
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function FollowupEditor({ initial, onCancel, onSave }) {
  const [name, setName] = useState(initial.name || '');
  const [afterMinutes, setAfterMinutes] = useState(initial.afterMinutes || 1440);
  const [statuses, setStatuses] = useState(initial.statuses || []);
  const [maxSendsPerContact, setMaxSends] = useState(initial.maxSendsPerContact || 1);
  const [messageBody, setMessageBody] = useState(initial.messageBody || '');
  const [enabled, setEnabled] = useState(initial.enabled !== false);
  const [saving, setSaving] = useState(false);

  const toggleStatus = (s) => {
    setStatuses((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));
  };

  const canSave =
    name.trim().length > 0 &&
    Number(afterMinutes) > 0 &&
    messageBody.trim().length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      afterMinutes: Number(afterMinutes),
      statuses,
      maxSendsPerContact: Number(maxSendsPerContact),
      messageBody: messageBody.trim(),
      enabled,
    });
    setSaving(false);
  };

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={initial._id ? 'Edit follow-up sequence' : 'New follow-up sequence'}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!canSave}>
            <FiSend /> Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Field label="Sequence name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 24-hour nudge" autoFocus />
        </Field>

        <Field
          label="Trigger after (minutes of silence)"
          hint="Example: 1440 = 24 hours, 60 = 1 hour, 10080 = 7 days"
        >
          <Input
            type="number"
            value={afterMinutes}
            onChange={(e) => setAfterMinutes(e.target.value)}
            min={1}
          />
        </Field>

        <Field
          label="Apply to enquiry statuses"
          hint="Leave all unchecked to target every status."
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {STATUS_OPTIONS.map((s) => (
              <label
                key={s.value}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${statuses.includes(s.value) ? 'var(--c-brand)' : 'var(--c-border)'}`,
                  background: statuses.includes(s.value) ? 'var(--c-brand-soft)' : 'var(--c-surface)',
                  color: statuses.includes(s.value) ? 'var(--c-brand-text)' : 'var(--c-text)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <input
                  type="checkbox"
                  checked={statuses.includes(s.value)}
                  onChange={() => toggleStatus(s.value)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Max sends per contact" hint="Don't send the same nudge more than this many times to any one contact.">
          <Input
            type="number"
            value={maxSendsPerContact}
            onChange={(e) => setMaxSends(e.target.value)}
            min={1}
          />
        </Field>

        <Field
          label="Message body"
          hint={
            <span>
              Supports <code>{'{{'}businessName{'}}'}</code>, <code>{'{{'}services{'}}'}</code>, <code>{'{{'}pricing{'}}'}</code>.
            </span>
          }
        >
          <Textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            rows={5}
            placeholder="Hi! Just checking in…"
          />
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled — sequence will run automatically
        </label>

        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            background: 'var(--c-info-soft)',
            color: 'var(--c-info-text)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-xs)',
            lineHeight: 1.5,
          }}
        >
          <FiInfo style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            For contacts who haven't messaged in the last 24 hours, WhatsApp Cloud API requires a pre-approved
            template. The dashboard will still record the followup; live delivery is subject to Meta's rules.
            Paused contacts and contacts who already received this sequence the max times are skipped automatically.
          </div>
        </div>
      </form>
    </Modal>
  );
}
