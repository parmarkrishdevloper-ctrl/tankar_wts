import { useEffect, useMemo, useState } from 'react';
import {
  FiCpu,
  FiHelpCircle,
  FiSave,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiPower,
  FiInfo,
  FiZap,
} from 'react-icons/fi';
import { toast } from 'sonner';
import { settingsAPI } from '../services/api';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Field, Textarea } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

const DEFAULT_PROMPT = `You are the friendly AI assistant for {{businessName}} — {{tagline}}.
We offer: {{services}}.
Pricing: {{pricing}}.

Always respond in the user's language (English, Hindi, or Hinglish).
Ask qualifying questions one at a time. Keep replies under 3 sentences.
Tone: warm, professional, helpful.`;

export default function Settings() {
  const [tab, setTab] = useState('bot');
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await settingsAPI.getBot();
        setCfg(res.data.data);
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="center-block">
        <Spinner size="lg" /> Loading settings…
      </div>
    );
  }

  if (!cfg) {
    return (
      <Card padded>
        <p>Could not load bot settings.</p>
      </Card>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Settings</h1>
          <p>Customise how the bot represents your business.</p>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: 'var(--space-4)' }}>
        <button
          className={`segmented-item ${tab === 'bot' ? 'active' : ''}`}
          onClick={() => setTab('bot')}
        >
          <FiCpu /> Bot configuration
        </button>
        <button
          className={`segmented-item ${tab === 'qa' ? 'active' : ''}`}
          onClick={() => setTab('qa')}
        >
          <FiHelpCircle /> Q&A library
        </button>
        <button
          className={`segmented-item ${tab === 'qr' ? 'active' : ''}`}
          onClick={() => setTab('qr')}
        >
          <FiZap /> Quick replies
        </button>
      </div>

      {tab === 'bot' && <BotConfigTab cfg={cfg} onChange={setCfg} />}
      {tab === 'qa' && <QATab cfg={cfg} onChange={setCfg} />}
      {tab === 'qr' && <QuickRepliesTab cfg={cfg} onChange={setCfg} />}
    </>
  );
}

function BotConfigTab({ cfg, onChange }) {
  const [form, setForm] = useState(() => ({
    businessName: cfg.businessName || '',
    tagline: cfg.tagline || '',
    services: cfg.services || '',
    pricing: cfg.pricing || '',
    workingHours: cfg.workingHours || '',
    languages: (cfg.languages || []).join(', '),
    promptTemplate: cfg.promptTemplate || '',
    botEnabled: cfg.botEnabled !== false,
  }));
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = () => setForm((f) => ({ ...f, botEnabled: !f.botEnabled }));

  const save = async () => {
    setSaving(true);
    try {
      const patch = {
        ...form,
        languages: form.languages
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      };
      const res = await settingsAPI.updateBot(patch);
      onChange(res.data.data);
      toast.success('Bot configuration saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const usePromptDefault = () =>
    setForm((f) => ({ ...f, promptTemplate: DEFAULT_PROMPT }));

  return (
    <div className="grid-2">
      <Card>
        <CardHeader title="Business" subtitle="The bot will use these in every reply." />
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Field label="Business name">
              <Input value={form.businessName} onChange={set('businessName')} placeholder="e.g. Tankar Solutions" />
            </Field>
            <Field label="Tagline">
              <Input value={form.tagline} onChange={set('tagline')} placeholder="e.g. We build modern websites" />
            </Field>
            <Field label="Services" hint="What you offer — comma separated is fine.">
              <Textarea
                value={form.services}
                onChange={set('services')}
                rows={3}
                placeholder="e.g. Website design, development, hosting, SEO"
              />
            </Field>
            <Field label="Pricing summary">
              <Input value={form.pricing} onChange={set('pricing')} placeholder="e.g. Starting at ₹15,000 for a 5-page site" />
            </Field>
            <Field label="Languages" hint="Comma separated. e.g. english, hindi, hinglish">
              <Input value={form.languages} onChange={set('languages')} />
            </Field>
            <Field label="Working hours" hint="Used only in replies if mentioned in the prompt.">
              <Input value={form.workingHours} onChange={set('workingHours')} placeholder="e.g. 10am–8pm IST" />
            </Field>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                background: form.botEnabled ? 'var(--c-success-soft)' : 'var(--c-danger-soft)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <FiPower style={{ color: form.botEnabled ? 'var(--c-success-text)' : 'var(--c-danger-text)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Auto-reply bot</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)' }}>
                  {form.botEnabled
                    ? 'Bot is replying to incoming WhatsApp messages automatically.'
                    : 'Bot is paused — incoming messages will not be auto-replied.'}
                </div>
              </div>
              <Button
                size="sm"
                variant={form.botEnabled ? 'secondary' : 'primary'}
                onClick={toggle}
              >
                {form.botEnabled ? 'Pause bot' : 'Enable bot'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Custom system prompt"
          subtitle="Advanced — overrides the default persona."
          action={
            <Button size="sm" variant="ghost" onClick={usePromptDefault}>
              Insert default
            </Button>
          }
        />
        <CardBody>
          <Field
            label="System prompt"
            hint={
              <span>
                Use <code>{'{{'}businessName{'}}'}</code>, <code>{'{{'}services{'}}'}</code>, <code>{'{{'}pricing{'}}'}</code> as placeholders. Leave blank to use the auto-generated prompt.
              </span>
            }
          >
            <Textarea
              value={form.promptTemplate}
              onChange={set('promptTemplate')}
              rows={14}
              placeholder={DEFAULT_PROMPT}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}
            />
          </Field>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-3)',
              padding: 'var(--space-3)',
              background: 'var(--c-info-soft)',
              color: 'var(--c-info-text)',
              fontSize: 'var(--text-xs)',
              borderRadius: 'var(--radius-md)',
              lineHeight: 1.5,
            }}
          >
            <FiInfo style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              The system prompt is sent to the LLM with every conversation. Keep it concise — large prompts cost more tokens per reply.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <Button onClick={save} loading={saving}>
              <FiSave /> Save changes
            </Button>
          </div>
        </CardBody>
      </Card>

      <LLMRatesCard cfg={cfg} onChange={onChange} />
    </div>
  );
}

function LLMRatesCard({ cfg, onChange }) {
  const initial = cfg.llmPricing || {};
  const [model, setModel] = useState(initial.llmModel || 'llama-3.1-8b-instant');
  const [inputRate, setInputRate] = useState(initial.inputPer1M ?? 0.05);
  const [outputRate, setOutputRate] = useState(initial.outputPer1M ?? 0.08);
  const [currency, setCurrency] = useState(initial.currency || 'USD');
  const [usdToInr, setUsdToInr] = useState(initial.usdToInr ?? 83);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await settingsAPI.updateBot({
        llmPricing: {
          llmModel: model,
          inputPer1M: Number(inputRate),
          outputPer1M: Number(outputRate),
          currency,
          usdToInr: Number(usdToInr),
        },
      });
      onChange(res.data.data);
      toast.success('LLM rates saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ gridColumn: '1 / -1' }}>
      <CardHeader
        title="LLM rates"
        subtitle="Used by the Cost page to estimate your spend. Update if your model or pricing changes."
      />
      <CardBody>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <Field label="Model identifier" hint="Whatever you call it — purely informational.">
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="llama-3.1-8b-instant" />
          </Field>
          <Field label="Input rate per 1M tokens">
            <Input type="number" step="0.001" value={inputRate} onChange={(e) => setInputRate(e.target.value)} />
          </Field>
          <Field label="Output rate per 1M tokens">
            <Input type="number" step="0.001" value={outputRate} onChange={(e) => setOutputRate(e.target.value)} />
          </Field>
          <Field label="Currency" hint="USD or INR. Used as the display unit on the Cost page.">
            <select
              className="select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
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
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </Field>
          <Field label="USD → INR rate" hint="Set 0 to hide INR conversion on the Cost page.">
            <Input type="number" step="0.01" value={usdToInr} onChange={(e) => setUsdToInr(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <Button onClick={save} loading={saving}>
            <FiSave /> Save rates
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function QATab({ cfg, onChange }) {
  const [editing, setEditing] = useState(null); // null | 'new' | { _id, keywords, answer, enabled }

  const handleSave = async (data) => {
    try {
      if (editing === 'new') {
        const res = await settingsAPI.addQA({
          keywords: data.keywords,
          answer: data.answer,
          enabled: data.enabled,
        });
        onChange({ ...cfg, qa: [...cfg.qa, res.data.data] });
        toast.success('Q&A added');
      } else {
        const res = await settingsAPI.updateQA(editing._id, data);
        onChange({
          ...cfg,
          qa: cfg.qa.map((q) => (q._id === editing._id ? res.data.data : q)),
        });
        toast.success('Q&A updated');
      }
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this Q&A?')) return;
    try {
      await settingsAPI.deleteQA(id);
      onChange({ ...cfg, qa: cfg.qa.filter((q) => q._id !== id) });
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleToggle = async (qa) => {
    try {
      const res = await settingsAPI.updateQA(qa._id, { enabled: !qa.enabled });
      onChange({
        ...cfg,
        qa: cfg.qa.map((q) => (q._id === qa._id ? res.data.data : q)),
      });
    } catch {
      toast.error('Toggle failed');
    }
  };

  return (
    <Card>
      <CardHeader
        title="Q&A library"
        subtitle="When a customer message contains any keyword, the bot replies with the answer instantly — no LLM call."
        action={
          <Button size="sm" onClick={() => setEditing('new')}>
            <FiPlus /> Add Q&A
          </Button>
        }
      />
      <CardBody style={{ padding: 0 }}>
        {cfg.qa.length === 0 ? (
          <EmptyState
            icon={FiHelpCircle}
            title="No Q&A pairs yet"
            description="Add common questions and exact replies. Bot will use these before calling the LLM."
            action={
              <Button size="sm" onClick={() => setEditing('new')}>
                <FiPlus /> Add your first Q&A
              </Button>
            }
          />
        ) : (
          <div style={{ padding: 'var(--space-4)' }}>
            {cfg.qa.map((qa) => (
              <div
                key={qa._id}
                style={{
                  padding: 'var(--space-4)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-3)',
                  background: qa.enabled ? 'var(--c-surface)' : 'var(--c-surface-2)',
                  opacity: qa.enabled ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(qa.keywords || []).map((k) => (
                      <Badge key={k} tone="brand">{k}</Badge>
                    ))}
                    {!qa.enabled && <Badge tone="neutral">disabled</Badge>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="sm" variant="ghost" iconOnly onClick={() => handleToggle(qa)} title={qa.enabled ? 'Disable' : 'Enable'}>
                      <FiPower />
                    </Button>
                    <Button size="sm" variant="ghost" iconOnly onClick={() => setEditing(qa)}>
                      <FiEdit2 />
                    </Button>
                    <Button size="sm" variant="ghost" iconOnly onClick={() => handleDelete(qa._id)}>
                      <FiTrash2 />
                    </Button>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--c-text)', whiteSpace: 'pre-wrap' }}>
                  {qa.answer}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>

      {editing && (
        <QAEditor
          initial={editing === 'new' ? { keywords: [], answer: '', enabled: true } : editing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </Card>
  );
}

function QuickRepliesTab({ cfg, onChange }) {
  const [editing, setEditing] = useState(null); // null | 'new' | { _id, label, body }

  const handleSave = async (data) => {
    try {
      if (editing === 'new') {
        const res = await settingsAPI.addQuickReply(data);
        onChange({ ...cfg, quickReplies: [...(cfg.quickReplies || []), res.data.data] });
        toast.success('Quick reply added');
      } else {
        const res = await settingsAPI.updateQuickReply(editing._id, data);
        onChange({
          ...cfg,
          quickReplies: cfg.quickReplies.map((q) => (q._id === editing._id ? res.data.data : q)),
        });
        toast.success('Quick reply updated');
      }
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this quick reply?')) return;
    try {
      await settingsAPI.deleteQuickReply(id);
      onChange({ ...cfg, quickReplies: cfg.quickReplies.filter((q) => q._id !== id) });
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const replies = cfg.quickReplies || [];

  return (
    <Card>
      <CardHeader
        title="Quick replies"
        subtitle="One-click snippets agents can insert into the composer when chatting with a contact."
        action={
          <Button size="sm" onClick={() => setEditing('new')}>
            <FiPlus /> Add reply
          </Button>
        }
      />
      <CardBody style={{ padding: 0 }}>
        {replies.length === 0 ? (
          <EmptyState
            icon={FiZap}
            title="No quick replies yet"
            description="Add common phrases your team uses so they're a single click away."
            action={
              <Button size="sm" onClick={() => setEditing('new')}>
                <FiPlus /> Add your first
              </Button>
            }
          />
        ) : (
          <div style={{ padding: 'var(--space-4)' }}>
            {replies.map((q) => (
              <div
                key={q._id}
                style={{
                  padding: 'var(--space-4)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-3)',
                  background: 'var(--c-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                  <Badge tone="brand">{q.label}</Badge>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="sm" variant="ghost" iconOnly onClick={() => setEditing(q)}>
                      <FiEdit2 />
                    </Button>
                    <Button size="sm" variant="ghost" iconOnly onClick={() => handleDelete(q._id)}>
                      <FiTrash2 />
                    </Button>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--c-text)', whiteSpace: 'pre-wrap' }}>
                  {q.body}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>

      {editing && (
        <QuickReplyEditor
          initial={editing === 'new' ? { label: '', body: '' } : editing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </Card>
  );
}

function QuickReplyEditor({ initial, onCancel, onSave }) {
  const [label, setLabel] = useState(initial.label || '');
  const [body, setBody] = useState(initial.body || '');
  const [saving, setSaving] = useState(false);

  const canSave = label.trim().length > 0 && body.trim().length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    await onSave({ label: label.trim(), body: body.trim() });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="modal-header">
            <h2>{initial._id ? 'Edit quick reply' : 'New quick reply'}</h2>
          </div>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Field label="Short label" hint="Shown as a chip in the composer.">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Greeting" autoFocus />
              </Field>
              <Field label="Message body">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Hi! Thanks for reaching out…"
                />
              </Field>
            </div>
          </div>
          <div className="modal-footer">
            <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={!canSave}>Save</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QAEditor({ initial, onCancel, onSave }) {
  const [keywords, setKeywords] = useState((initial.keywords || []).join(', '));
  const [answer, setAnswer] = useState(initial.answer || '');
  const [enabled, setEnabled] = useState(initial.enabled !== false);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(
    () => keywords.trim().length > 0 && answer.trim().length > 0,
    [keywords, answer]
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    await onSave({
      keywords: keywords.split(',').map((s) => s.trim()).filter(Boolean),
      answer: answer.trim(),
      enabled,
    });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="modal-header">
            <h2>{initial._id ? 'Edit Q&A' : 'New Q&A'}</h2>
          </div>
          <div className="modal-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Field
                label="Trigger keywords"
                hint="Comma separated. Bot replies if the user's message contains any of these (case insensitive)."
              >
                <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. price, cost, kitna, charge" autoFocus />
              </Field>
              <Field label="Reply">
                <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} placeholder="Our packages start at ₹15,000…" />
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Active
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={!canSave}>Save</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
