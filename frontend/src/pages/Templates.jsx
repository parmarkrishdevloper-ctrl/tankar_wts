import { useEffect, useMemo, useState } from 'react';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiFileText,
  FiCheckCircle,
  FiSend,
  FiCopy,
  FiCalendar,
  FiCreditCard,
  FiSmile,
  FiHelpCircle,
  FiSave,
  FiEye,
} from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { templatesAPI } from '../services/api';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Field, Textarea } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';

const CATEGORIES = [
  { value: 'welcome', label: 'Welcome', icon: FiSmile, tone: 'brand' },
  { value: 'pricing', label: 'Pricing', icon: FiCreditCard, tone: 'success' },
  { value: 'followup', label: 'Follow-up', icon: FiCalendar, tone: 'info' },
  { value: 'reminder', label: 'Reminder', icon: FiHelpCircle, tone: 'warning' },
  { value: 'payment', label: 'Payment', icon: FiCheckCircle, tone: 'violet' },
  { value: 'thankyou', label: 'Thank you', icon: FiSmile, tone: 'success' },
  { value: 'custom', label: 'Custom', icon: FiFileText, tone: 'neutral' },
];

const PRESETS = [
  {
    name: 'Welcome new lead',
    category: 'welcome',
    body:
      "Hi {{name}}! 👋 Thanks for reaching out to {{businessName}}. We help businesses with {{services}}. How can I help you today?",
  },
  {
    name: 'Pricing share',
    category: 'pricing',
    body:
      "Here's our package: {{pricing}}. Includes hosting, domain & basic SEO. Want me to send portfolio examples?",
  },
  {
    name: '24-hour gentle nudge',
    category: 'followup',
    body:
      "Hi {{name}}, following up on your enquiry. Did you have any questions about {{businessName}}? Happy to help when you're ready.",
  },
  {
    name: 'Payment confirmation',
    category: 'payment',
    body:
      "✅ Payment received. Thanks {{name}}! Your project with {{businessName}} kicks off now. Expect a kickoff message within 24 hours.",
  },
];

function findCategoryMeta(value) {
  return CATEGORIES.find((c) => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
}

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | preset object | existing template

  const load = async () => {
    try {
      const res = await templatesAPI.list();
      setTemplates(res.data.data || []);
    } catch {
      toast.error('Could not load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const byCat = {};
    for (const cat of CATEGORIES) byCat[cat.value] = [];
    templates.forEach((t) => {
      const cat = byCat[t.category] ? t.category : 'custom';
      byCat[cat].push(t);
    });
    return byCat;
  }, [templates]);

  const handleSave = async (data) => {
    try {
      if (editing?._id) {
        await templatesAPI.update(editing._id, data);
        toast.success('Template updated');
      } else {
        await templatesAPI.create(data);
        toast.success('Template created');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await templatesAPI.remove(id);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const copyBody = (body) => {
    navigator.clipboard?.writeText(body);
    toast.success('Copied template body');
  };

  if (loading) {
    return (
      <div className="center-block">
        <Spinner size="lg" /> Loading templates…
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Templates</h1>
          <p>Reusable messages with <code>{'{{'}variables{'}}'}</code> for outbound chats and campaigns.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <FiPlus /> New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={FiFileText}
              title="No templates yet"
              description="Templates make outbound messages instant and consistent — pick a preset to start."
            />
            <div style={{ marginTop: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                Start with a preset:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
                {PRESETS.map((p, i) => {
                  const meta = findCategoryMeta(p.category);
                  const Icon = meta.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setEditing(p)}
                      style={{
                        textAlign: 'left',
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--c-border)',
                        background: 'var(--c-surface-2)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        <span className={`stat-card-icon stat-tone-${meta.tone}`} style={{ width: 28, height: 28 }}>
                          <Icon />
                        </span>
                        <strong>{p.name}</strong>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)' }}>
                        {p.body}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {CATEGORIES.filter((c) => grouped[c.value].length > 0).map((cat) => {
            const Icon = cat.icon;
            return (
              <Card key={cat.value}>
                <CardHeader
                  title={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span className={`stat-card-icon stat-tone-${cat.tone}`} style={{ width: 28, height: 28 }}>
                        <Icon />
                      </span>
                      {cat.label}
                      <Badge tone="neutral">{grouped[cat.value].length}</Badge>
                    </span>
                  }
                />
                <CardBody style={{ padding: 0 }}>
                  {grouped[cat.value].map((t, idx) => (
                    <div
                      key={t._id}
                      style={{
                        padding: 'var(--space-4) var(--space-6)',
                        borderBottom:
                          idx < grouped[cat.value].length - 1 ? '1px solid var(--c-border)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                            <strong>{t.name}</strong>
                            {(t.variables || []).length > 0 && (
                              <Badge tone="brand">
                                {t.variables.length} variable{t.variables.length === 1 ? '' : 's'}
                              </Badge>
                            )}
                            {t.usageCount > 0 && (
                              <Badge tone="neutral">Used {t.usageCount}×</Badge>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--text-sm)',
                              color: 'var(--c-text)',
                              background: 'var(--c-surface-2)',
                              padding: 'var(--space-3)',
                              borderRadius: 'var(--radius-md)',
                              whiteSpace: 'pre-wrap',
                              marginBottom: t.lastUsedAt ? 'var(--space-2)' : 0,
                            }}
                          >
                            {t.body}
                          </div>
                          {t.lastUsedAt && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
                              Last used {formatDistanceToNow(new Date(t.lastUsedAt), { addSuffix: true })}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Button size="sm" variant="ghost" iconOnly onClick={() => copyBody(t.body)} title="Copy">
                            <FiCopy />
                          </Button>
                          <Button size="sm" variant="ghost" iconOnly onClick={() => setEditing(t)}>
                            <FiEdit2 />
                          </Button>
                          <Button size="sm" variant="ghost" iconOnly onClick={() => handleDelete(t._id)}>
                            <FiTrash2 />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <TemplateEditor
          initial={
            editing === 'new'
              ? { name: '', category: 'custom', body: '' }
              : editing
          }
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function TemplateEditor({ initial, onCancel, onSave }) {
  const [name, setName] = useState(initial.name || '');
  const [category, setCategory] = useState(initial.category || 'custom');
  const [body, setBody] = useState(initial.body || '');
  const [saving, setSaving] = useState(false);

  const variables = useMemo(() => {
    const set = new Set();
    const re = /\{\{\s*(\w+)\s*\}\}/g;
    let m;
    while ((m = re.exec(body)) !== null) set.add(m[1]);
    return [...set];
  }, [body]);

  const preview = useMemo(() => {
    const sample = {
      name: 'Aarav',
      businessName: 'Tankar Solutions',
      services: 'website development, hosting, SEO',
      pricing: '₹15,000 for a 5-page site',
      tagline: 'We build modern websites',
      workingHours: '10am–8pm IST',
      customerBusiness: 'Mehta Tailors',
      websiteType: 'Portfolio',
      budget: '₹15,000',
      timeline: '2 weeks',
    };
    return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => sample[k] ?? `{{${k}}}`);
  }, [body]);

  const canSave = name.trim().length > 0 && body.trim().length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    await onSave({ name: name.trim(), category, body: body.trim() });
    setSaving(false);
  };

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={initial._id ? 'Edit template' : 'New template'}
      maxWidth={760}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!canSave}>
            <FiSave /> Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 'var(--space-3)' }}>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome new lead" autoFocus />
          </Field>
          <Field label="Category">
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                height: 40,
                padding: '0 var(--space-3)',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--c-text)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Body"
          hint={
            <span>
              Use <code>{'{{'}name{'}}'}</code>, <code>{'{{'}businessName{'}}'}</code>, <code>{'{{'}services{'}}'}</code>, <code>{'{{'}pricing{'}}'}</code>, <code>{'{{'}budget{'}}'}</code>, <code>{'{{'}timeline{'}}'}</code> etc.
            </span>
          }
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Hi {{name}}! …" />
        </Field>

        {variables.length > 0 && (
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-subtle)', marginBottom: 'var(--space-2)' }}>
              Variables used
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {variables.map((v) => (
                <Badge key={v} tone="brand">{`{{${v}}}`}</Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-subtle)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <FiEye /> Preview (with sample data)
          </div>
          <div
            style={{
              padding: 'var(--space-4)',
              background: 'var(--c-brand-soft)',
              color: 'var(--c-brand-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              minHeight: 50,
            }}
          >
            {preview || <em>(empty)</em>}
          </div>
        </div>
      </form>
    </Modal>
  );
}
