import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import {
  FiSearch,
  FiMessageCircle,
  FiUser,
  FiInbox,
  FiDownload,
  FiUpload,
  FiSend,
  FiPlus,
  FiUsers,
  FiPhone,
  FiPower,
  FiZap,
  FiInfo,
  FiX,
  FiEdit3,
  FiCheck,
  FiArrowRight,
  FiCpu,
  FiRefreshCw,
} from 'react-icons/fi';
import { toast } from 'sonner';
import { dashboardAPI, messagesAPI, settingsAPI, enquiriesAPI } from '../services/api';
import Input, { Field, Textarea } from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

function dateLabel(date) {
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMM yyyy');
}

function timeShort(date) {
  return format(new Date(date), 'h:mm a');
}

function listTimestamp(date) {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMM');
}

export default function Conversations() {
  const { phoneNumber } = useParams();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [messages, setMessages] = useState([]);
  const [details, setDetails] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesRef = useRef(null);

  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const [quickReplies, setQuickReplies] = useState([]);
  const [showQR, setShowQR] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);

  // Contact details drawer
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesState, setNotesState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const notesTimerRef = useRef(null);
  const [linkedEnquiry, setLinkedEnquiry] = useState(null);

  // AI summary
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState(null); // { text, generatedAt }
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await settingsAPI.getBot();
        setQuickReplies(res.data.data?.quickReplies || []);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const togglePause = async () => {
    if (!details) return;
    setTogglingPause(true);
    try {
      const next = !details.botPaused;
      const res = await dashboardAPI.updateContact(phoneNumber, { botPaused: next });
      setDetails((d) => ({ ...d, botPaused: res.data.data.botPaused }));
      toast.success(next ? 'Bot paused — you handle this chat now' : 'Bot re-enabled');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setTogglingPause(false);
    }
  };

  const insertQuickReply = (body) => {
    setReplyText((cur) => (cur ? cur + ' ' + body : body));
    setShowQR(false);
  };

  const openSummary = async () => {
    setSummaryOpen(true);
    setSummaryError(null);
    if (summary) return; // already have one for this contact
    await regenerateSummary();
  };

  const regenerateSummary = async () => {
    if (!phoneNumber) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await dashboardAPI.summarize(phoneNumber);
      setSummary(res.data.data);
    } catch (err) {
      setSummaryError(err.response?.data?.error || 'Could not summarise');
    } finally {
      setSummaryLoading(false);
    }
  };

  const refreshContacts = async () => {
    try {
      const res = await dashboardAPI.getContacts(1, 200, '');
      setContacts(res.data.data || []);
    } catch {
      toast.error('Could not load contacts');
    }
  };

  useEffect(() => {
    (async () => {
      setContactsLoading(true);
      await refreshContacts();
      setContactsLoading(false);
    })();
  }, []);

  const loadMessages = async () => {
    if (!phoneNumber) {
      setMessages([]);
      setDetails(null);
      setLinkedEnquiry(null);
      setNotesDraft('');
      setSummary(null);
      setSummaryOpen(false);
      return;
    }
    setSummary(null);
    setSummaryOpen(false);
    setMessagesLoading(true);
    try {
      const [convoRes, detailRes, enquiryRes] = await Promise.all([
        dashboardAPI.getConversations(phoneNumber, 1, 1000),
        dashboardAPI.getContact(phoneNumber).catch(() => ({ data: { data: null } })),
        enquiriesAPI.getByPhone(phoneNumber).catch(() => ({ data: { data: null } })),
      ]);
      const flat = [];
      (convoRes.data.data || []).forEach((c) => {
        (c.messages || []).forEach((m) => {
          flat.push({ ...m, conversationId: c._id });
        });
      });
      flat.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setMessages(flat);
      setDetails(detailRes.data.data);
      setNotesDraft(detailRes.data.data?.notes || '');
      setNotesState('idle');
      setLinkedEnquiry(enquiryRes.data.data || null);

      // Pull cached AI summary from the most recent conversation, if any
      const latest = (convoRes.data.data || []).slice().reverse().find((c) => c.aiSummary?.text);
      if (latest?.aiSummary?.text) {
        setSummary({ text: latest.aiSummary.text, generatedAt: latest.aiSummary.generatedAt });
      }
    } catch {
      toast.error('Could not load conversation');
    } finally {
      setMessagesLoading(false);
    }
  };

  const saveNotes = async (value) => {
    if (!phoneNumber) return;
    setNotesState('saving');
    try {
      const res = await dashboardAPI.updateContact(phoneNumber, { notes: value });
      setDetails((d) => ({ ...(d || {}), notes: res.data.data.notes }));
      setNotesState('saved');
      setTimeout(() => setNotesState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch {
      setNotesState('error');
      toast.error('Could not save notes');
    }
  };

  const onNotesChange = (e) => {
    const value = e.target.value;
    setNotesDraft(value);
    setNotesState('saving');
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => saveNotes(value), 800);
  };

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber]);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((c) => c.phoneNumber.toLowerCase().includes(term));
  }, [contacts, search]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const m of messages) {
      const key = new Date(m.timestamp).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }
    return groups;
  }, [messages]);

  const send = async (e) => {
    e?.preventDefault();
    const body = replyText.trim();
    if (!body || !phoneNumber) return;
    setSending(true);
    try {
      const res = await messagesAPI.send(phoneNumber, body);
      setReplyText('');
      await loadMessages();
      if (res.data.simulated) {
        toast.message('Message saved (simulated send)', {
          description: 'WhatsApp credentials are not configured locally — the message is stored but was not actually sent to WhatsApp.',
        });
      } else {
        toast.success('Message sent');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-shell" style={{ margin: 'calc(var(--space-8) * -1)', height: 'calc(100vh - var(--topbar-height))', overflow: 'hidden' }}>
      <aside className="chat-list">
        <div className="chat-list-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h3>Conversations</h3>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button size="sm" variant="ghost" iconOnly onClick={() => setBroadcastOpen(true)} title="Broadcast">
                <FiUsers />
              </Button>
              <Button size="sm" onClick={() => setNewMsgOpen(true)} title="New message">
                <FiPlus />
              </Button>
            </div>
          </div>
          <Input
            icon={FiSearch}
            placeholder="Search by phone number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="chat-list-items">
          {contactsLoading ? (
            <div className="center-block">
              <Spinner /> Loading contacts…
            </div>
          ) : filteredContacts.length === 0 ? (
            <EmptyState
              icon={FiInbox}
              title="No contacts"
              description={search ? 'Try a different search.' : 'Start a new conversation to add your first contact.'}
              action={
                !search && (
                  <Button size="sm" onClick={() => setNewMsgOpen(true)}>
                    <FiPlus /> New message
                  </Button>
                )
              }
            />
          ) : (
            filteredContacts.map((c) => (
              <button
                key={c._id || c.phoneNumber}
                className={`chat-list-item ${phoneNumber === c.phoneNumber ? 'active' : ''}`}
                onClick={() => navigate(`/conversations/${c.phoneNumber}`)}
                style={{ border: 'none', textAlign: 'left', width: '100%', background: 'inherit' }}
              >
                <div className="avatar avatar-md">
                  <FiUser />
                </div>
                <div className="chat-list-item-body">
                  <div className="chat-list-item-row">
                    <span className="chat-list-item-name">{c.phoneNumber}</span>
                    {c.lastContactDate && (
                      <span className="chat-list-item-time">{listTimestamp(c.lastContactDate)}</span>
                    )}
                  </div>
                  <div className="chat-list-item-preview">
                    {(c.totalConversations || 0).toLocaleString()} conversation
                    {c.totalConversations === 1 ? '' : 's'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="chat-main" style={{ position: 'relative' }}>
        {!phoneNumber ? (
          <EmptyState
            icon={FiMessageCircle}
            title="Select a conversation"
            description="Pick a contact on the left, or start a new chat."
            action={
              <Button onClick={() => setNewMsgOpen(true)}>
                <FiPlus /> New message
              </Button>
            }
          />
        ) : (
          <>
            <div className="chat-main-header">
              <div className="chat-main-header-info">
                <div className="avatar avatar-lg">
                  <FiUser />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>
                    {phoneNumber}
                  </div>
                  {details && (
                    <div className="chat-stats">
                      <span><FiMessageCircle /> {details.totalConversations || 0} chats</span>
                      <span>•</span>
                      <span><FiDownload /> {(details.totalInputTokens || 0).toLocaleString()} in</span>
                      <span>•</span>
                      <span><FiUpload /> {(details.totalOutputTokens || 0).toLocaleString()} out</span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                {details?.botPaused ? (
                  <Badge tone="warning" dot>Bot paused</Badge>
                ) : (
                  <Badge tone="success" dot>Bot active</Badge>
                )}
                <Button
                  size="sm"
                  variant={details?.botPaused ? 'primary' : 'secondary'}
                  onClick={togglePause}
                  loading={togglingPause}
                  disabled={!details}
                  title={details?.botPaused ? 'Resume auto-reply for this contact' : 'Stop auto-reply and take over manually'}
                >
                  <FiPower />
                  {details?.botPaused ? 'Resume bot' : 'Take over'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={openSummary}
                  disabled={messages.length === 0}
                  title="AI summary of this conversation"
                >
                  <FiCpu />
                  Summarise
                </Button>
                <Button
                  size="sm"
                  variant={detailsOpen ? 'primary' : 'secondary'}
                  onClick={() => setDetailsOpen((v) => !v)}
                  title="Contact details and notes"
                  style={{ position: 'relative' }}
                >
                  <FiInfo />
                  Details
                  {!!details?.notes?.trim() && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--c-success)',
                        border: '2px solid var(--c-surface)',
                      }}
                    />
                  )}
                </Button>
              </div>
            </div>

            {details?.botPaused && (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  background: 'var(--c-warning-soft)',
                  color: 'var(--c-warning-text)',
                  fontSize: 'var(--text-sm)',
                  borderBottom: '1px solid var(--c-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <FiPower />
                  <span>
                    <strong>Controlled by you</strong> — bot is paused and won't auto-reply to this contact.
                  </span>
                </div>
                {details.botPausedAt && (
                  <span style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>
                    Since {formatDistanceToNow(new Date(details.botPausedAt), { addSuffix: true })}
                    {details.botPausedTotalCount > 1 && ` · ${details.botPausedTotalCount} takeovers total`}
                  </span>
                )}
              </div>
            )}

            <div className="chat-messages" ref={messagesRef}>
              {messagesLoading ? (
                <div className="center-block"><Spinner /> Loading messages…</div>
              ) : messages.length === 0 ? (
                <EmptyState
                  icon={FiMessageCircle}
                  title="No messages yet"
                  description="When this contact replies, you'll see their messages here. You can also send the first message below."
                />
              ) : (
                Array.from(grouped.entries()).map(([key, msgs]) => (
                  <div
                    key={key}
                    style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
                  >
                    <div className="chat-date-divider">
                      <span>{dateLabel(key)}</span>
                    </div>
                    {msgs.map((m, idx) => (
                      <div key={`${m.conversationId}-${idx}`} className={`chat-row ${m.role}`}>
                        <div className="chat-bubble">
                          <div>{m.content}</div>
                          <div className="chat-bubble-time">{timeShort(m.timestamp)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {showQR && quickReplies.length > 0 && (
              <div
                style={{
                  background: 'var(--c-surface)',
                  borderTop: '1px solid var(--c-border)',
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                {quickReplies.map((q) => (
                  <button
                    key={q._id}
                    type="button"
                    className="badge badge-brand"
                    style={{ cursor: 'pointer', border: 'none', height: 28, padding: '0 var(--space-3)' }}
                    onClick={() => insertQuickReply(q.body)}
                    title={q.body}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            <form className="chat-composer" onSubmit={send}>
              <Button
                type="button"
                variant={showQR ? 'primary' : 'ghost'}
                iconOnly
                onClick={() => setShowQR((s) => !s)}
                title={quickReplies.length === 0 ? 'No quick replies yet — add them in Settings' : 'Quick replies'}
                disabled={quickReplies.length === 0}
              >
                <FiZap />
              </Button>
              <Input
                placeholder="Type a message…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !replyText.trim()} loading={sending}>
                <FiSend /> Send
              </Button>
            </form>
          </>
        )}

        {phoneNumber && detailsOpen && (
          <ContactDetailsDrawer
            phoneNumber={phoneNumber}
            details={details}
            linkedEnquiry={linkedEnquiry}
            notesDraft={notesDraft}
            notesState={notesState}
            onNotesChange={onNotesChange}
            onClose={() => setDetailsOpen(false)}
            onGoToEnquiries={() => navigate(`/enquiries`)}
          />
        )}
      </section>

      <NewMessageModal
        open={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        onSent={async (to) => {
          setNewMsgOpen(false);
          await refreshContacts();
          navigate(`/conversations/${to}`);
        }}
      />

      <BroadcastModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        contacts={contacts}
        onSent={async () => {
          setBroadcastOpen(false);
          await refreshContacts();
          if (phoneNumber) loadMessages();
        }}
      />

      <Modal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        title="AI conversation summary"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={regenerateSummary}
              loading={summaryLoading}
              disabled={summaryLoading}
            >
              <FiRefreshCw /> Regenerate
            </Button>
            <Button variant="ghost" onClick={() => setSummaryOpen(false)}>Close</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              color: 'var(--c-text-subtle)',
            }}
          >
            <FiCpu />
            <span>
              Generated by Groq from the last 60 messages with {phoneNumber}.
            </span>
          </div>

          {summaryLoading && !summary ? (
            <div className="center-block" style={{ padding: 'var(--space-6)' }}>
              <Spinner /> <span>Reading conversation…</span>
            </div>
          ) : summaryError ? (
            <div
              style={{
                padding: 'var(--space-4)',
                background: 'var(--c-danger-soft)',
                color: 'var(--c-danger-text)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {summaryError}
            </div>
          ) : summary?.text ? (
            <>
              <div
                style={{
                  padding: 'var(--space-4)',
                  background: 'var(--c-surface-2)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {summary.text}
              </div>
              {summary.generatedAt && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
                  Generated {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}
                </div>
              )}
            </>
          ) : (
            <div className="center-block" style={{ padding: 'var(--space-4)' }}>
              <span>No summary yet.</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

const STATUS_LABEL = {
  new: 'New',
  in_progress: 'In progress',
  completed: 'Completed',
  callback_requested: 'Callback',
};

const STATUS_TONE = {
  new: 'warning',
  in_progress: 'info',
  completed: 'success',
  callback_requested: 'danger',
};

function ContactDetailsDrawer({
  phoneNumber,
  details,
  linkedEnquiry,
  notesDraft,
  notesState,
  onNotesChange,
  onClose,
  onGoToEnquiries,
}) {
  const firstSeen = details?.firstContactDate || details?.createdAt;
  const lastSeen = details?.lastContactDate;

  return (
    <aside
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 360,
        maxWidth: '100%',
        background: 'var(--c-surface)',
        borderLeft: '1px solid var(--c-border)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideUp 0.18s ease',
        zIndex: 10,
      }}
    >
      <header
        style={{
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--c-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>Contact details</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
            {phoneNumber}
          </div>
        </div>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={onClose}
          aria-label="Close details"
        >
          <FiX />
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <section>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--c-text-subtle)',
              marginBottom: 'var(--space-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span><FiEdit3 size={12} style={{ marginRight: 4 }} /> Notes</span>
            <NotesStatus state={notesState} />
          </div>
          <Textarea
            value={notesDraft}
            onChange={onNotesChange}
            rows={6}
            placeholder="Private notes — never shown to the customer. Auto-saved."
          />
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--c-text-subtle)',
              marginTop: 'var(--space-1)',
            }}
          >
            Internal only · auto-saves as you type
          </div>
        </section>

        <section>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--c-text-subtle)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Activity
          </div>
          <Row label="Phone" value={phoneNumber} />
          <Row
            label="First seen"
            value={
              firstSeen
                ? `${formatDistanceToNow(new Date(firstSeen), { addSuffix: true })} · ${format(new Date(firstSeen), 'd MMM yyyy')}`
                : '—'
            }
          />
          <Row
            label="Last activity"
            value={
              lastSeen
                ? `${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })} · ${format(new Date(lastSeen), 'd MMM yyyy, h:mm a')}`
                : '—'
            }
          />
          <Row label="Conversations" value={(details?.totalConversations ?? 0).toLocaleString()} />
          <Row
            label="Tokens"
            value={`${(details?.totalInputTokens ?? 0).toLocaleString()} in · ${(details?.totalOutputTokens ?? 0).toLocaleString()} out`}
          />
        </section>

        {linkedEnquiry && (
          <section>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--c-text-subtle)',
                marginBottom: 'var(--space-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Linked enquiry</span>
              <button
                type="button"
                onClick={onGoToEnquiries}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--c-brand)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                Open <FiArrowRight size={11} />
              </button>
            </div>

            <div
              style={{
                background: 'var(--c-surface-2)',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <strong style={{ fontSize: 'var(--text-sm)' }}>
                  {linkedEnquiry.clientName || 'Unknown'}
                </strong>
                <Badge tone={STATUS_TONE[linkedEnquiry.status] || 'neutral'} dot>
                  {STATUS_LABEL[linkedEnquiry.status] || linkedEnquiry.status}
                </Badge>
              </div>
              {linkedEnquiry.businessName && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)' }}>
                  {linkedEnquiry.businessName}
                  {linkedEnquiry.websiteType ? ` · ${linkedEnquiry.websiteType}` : ''}
                </div>
              )}
              {linkedEnquiry.budget && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)' }}>
                  Budget: <strong>{linkedEnquiry.budget}</strong>
                </div>
              )}
              {(linkedEnquiry.tags || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {(linkedEnquiry.tags || []).map((t) => (
                    <Badge key={t} tone="brand">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

function NotesStatus({ state }) {
  if (state === 'saving') {
    return (
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)', fontWeight: 500 }}>
        Saving…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--c-success-text)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <FiCheck size={12} /> Saved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--c-danger-text)', fontWeight: 600 }}>
        Save failed
      </span>
    );
  }
  return null;
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: 'var(--space-2) 0',
        borderBottom: '1px dashed var(--c-border)',
        fontSize: 'var(--text-sm)',
      }}
    >
      <span style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function NewMessageModal({ open, onClose, onSent }) {
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const to = phone.trim().replace(/\D/g, '');
    const msg = body.trim();
    if (!to || !msg) return;
    setSending(true);
    try {
      const res = await messagesAPI.send(to, msg);
      if (res.data.simulated) {
        toast.message('Message saved (simulated send)', {
          description: 'No live WhatsApp credentials in this environment.',
        });
      } else {
        toast.success('Message sent');
      }
      setPhone('');
      setBody('');
      onSent(to);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New message"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={sending} disabled={!phone || !body.trim()}>
            <FiSend /> Send
          </Button>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Field
          label="Recipient phone number"
          hint="With country code, digits only. Example: 919812345678"
        >
          <Input
            icon={FiPhone}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="919812345678"
            autoFocus
          />
        </Field>
        <Field label="Message">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Hi! Following up on your enquiry…"
          />
        </Field>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--c-text-muted)',
            background: 'var(--c-surface-2)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          ℹ️ WhatsApp policy: if you have not received a message from this number in the last 24 hours, your text must use a Meta-approved template. Otherwise it may be rejected.
        </div>
      </form>
    </Modal>
  );
}

function BroadcastModal({ open, onClose, contacts, onSent }) {
  const [body, setBody] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setSelected(new Set(contacts.map((c) => c.phoneNumber)));
  }, [open, contacts]);

  const allSelected = selected.size === contacts.length && contacts.length > 0;
  const toggle = (phone) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(contacts.map((c) => c.phoneNumber)));
  };

  const submit = async () => {
    if (selected.size === 0 || !body.trim()) return;
    if (!confirm(`Send this message to ${selected.size} contacts?`)) return;
    setSending(true);
    try {
      const res = await messagesAPI.broadcast([...selected], body.trim());
      const { sent, simulated, failed } = res.data;
      if (failed > 0) {
        toast.warning(`Sent ${sent}, failed ${failed}`);
      } else if (simulated > 0) {
        toast.message(`Saved ${simulated} messages (simulated)`, {
          description: 'No live WhatsApp credentials — messages recorded locally only.',
        });
      } else {
        toast.success(`Broadcast sent to ${sent} contacts`);
      }
      setBody('');
      onSent();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Broadcast failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Broadcast message"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={sending} disabled={selected.size === 0 || !body.trim()}>
            <FiSend /> Send to {selected.size}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Field label="Message" hint="Sent to every selected contact.">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Hi! We have a special offer this week…"
          />
        </Field>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              Recipients ({selected.size} of {contacts.length})
            </div>
            <Button size="sm" variant="ghost" onClick={toggleAll}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </Button>
          </div>
          <div
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2)',
            }}
          >
            {contacts.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', color: 'var(--c-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
                No contacts yet.
              </div>
            ) : (
              contacts.map((c) => (
                <label
                  key={c.phoneNumber}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.phoneNumber)}
                    onChange={() => toggle(c.phoneNumber)}
                  />
                  <span style={{ flex: 1 }}>{c.phoneNumber}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
                    {(c.totalConversations || 0)} chats
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--c-text-muted)',
            background: 'var(--c-surface-2)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          ℹ️ For contacts who haven't messaged in the last 24 hours, WhatsApp requires a pre-approved template. The dashboard will still record the message; delivery is subject to Meta's rules.
        </div>
      </div>
    </Modal>
  );
}
