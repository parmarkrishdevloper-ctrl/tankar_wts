import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  FiSend,
  FiPlay,
  FiRotateCcw,
  FiPhone,
  FiUser,
  FiCpu,
  FiZap,
} from 'react-icons/fi';
import { toast } from 'sonner';
import { enquiriesAPI } from '../services/api';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Input, { Field } from '../components/ui/Input';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

const QUICK = [
  'Hi',
  'Mujhe ek website chahiye',
  'How much does it cost?',
  'I need a portfolio website',
  'Can you share examples?',
];

export default function Simulator() {
  const [phoneNumber, setPhoneNumber] = useState('919999999999');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (overrideText) => {
    const text = (overrideText ?? message).trim();
    if (!text) return;
    if (!phoneNumber.trim()) {
      toast.error('Enter a phone number first');
      return;
    }
    setLoading(true);
    setMessages((m) => [
      ...m,
      { role: 'user', content: text, timestamp: new Date().toISOString() },
    ]);
    if (!overrideText) setMessage('');
    try {
      const res = await enquiriesAPI.simulate(phoneNumber, text);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.data.reply || '(no reply)',
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      toast.error('Simulation failed — check backend logs');
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: '⚠️ Simulation failed. Check the backend logs.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([]);
    toast.info('Conversation reset');
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Simulator</h1>
          <p>Test how the bot will respond before sending real WhatsApp messages.</p>
        </div>
        <Button variant="secondary" onClick={reset} disabled={messages.length === 0}>
          <FiRotateCcw /> Reset
        </Button>
      </div>

      <div className="simulator-grid">
        <aside className="simulator-config">
          <Card>
            <CardHeader title="Sandbox" subtitle="Acts like a real WhatsApp contact" />
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Field label="Simulated phone number" hint="Use any number — kept isolated from production data.">
                  <Input
                    icon={FiPhone}
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="919999999999"
                  />
                </Field>

                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                    Quick prompts
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    {QUICK.map((q) => (
                      <Button
                        key={q}
                        size="sm"
                        variant="secondary"
                        onClick={() => send(q)}
                        disabled={loading}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card padded>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              <div className="stat-card-icon stat-tone-brand">
                <FiZap />
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Tips</div>
                <p style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
                  Try greeting first ("Hi"), then describe a business. The agent should detect language,
                  ask qualifying questions, and present your package.
                </p>
              </div>
            </div>
          </Card>
        </aside>

        <div className="simulator-stage">
          <div className="simulator-stage-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div className="avatar avatar-md"><FiUser /></div>
              <div>
                <div style={{ fontWeight: 600 }}>{phoneNumber || 'Sandbox contact'}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
                  {loading ? 'Bot is typing…' : 'WhatsApp simulation'}
                </div>
              </div>
            </div>
            <span className="badge badge-brand">
              <FiCpu /> AI agent
            </span>
          </div>

          <div className="simulator-messages" ref={scrollRef}>
            {messages.length === 0 ? (
              <EmptyState
                icon={FiPlay}
                title="Start a conversation"
                description="Send a greeting like “Hi” to begin testing your bot."
              />
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`chat-row ${m.role}`}>
                  <div className="chat-bubble">
                    <div>{m.content}</div>
                    <div className="chat-bubble-time">{format(new Date(m.timestamp), 'h:mm a')}</div>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="chat-row assistant">
                <div className="chat-bubble" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Spinner />
                  <span style={{ fontSize: 'var(--text-sm)' }}>Thinking…</span>
                </div>
              </div>
            )}
          </div>

          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Input
              placeholder="Type a message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !message.trim()}>
              <FiSend /> Send
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
