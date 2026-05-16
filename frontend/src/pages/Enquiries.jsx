import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  FiSearch,
  FiInbox,
  FiUser,
  FiBriefcase,
  FiGlobe,
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiExternalLink,
  FiArrowUp,
  FiArrowDown,
  FiRefreshCw,
  FiMessageCircle,
  FiSettings,
  FiTag,
  FiX,
  FiGrid,
  FiList,
} from 'react-icons/fi';
import { toast } from 'sonner';
import { enquiriesAPI } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'callback_requested', label: 'Callback' },
];

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

const PAGE_SIZE = 10;

const SORTERS = {
  date: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  name: (a, b) => (a.clientName || '').localeCompare(b.clientName || ''),
  business: (a, b) => (a.businessName || '').localeCompare(b.businessName || ''),
  status: (a, b) => (a.status || '').localeCompare(b.status || ''),
};

export default function Enquiries() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const initialTag = searchParams.get('tag') || '';
  const initialView = searchParams.get('view') || 'list';

  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(initialStatus);
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [view, setView] = useState(initialView);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetchEnquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filter === 'all') next.delete('status');
    else next.set('status', filter);
    if (!tagFilter) next.delete('tag');
    else next.set('tag', tagFilter);
    if (view === 'list') next.delete('view');
    else next.set('view', view);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, tagFilter, view]);

  const allTags = useMemo(() => {
    const set = new Set();
    for (const e of enquiries) for (const t of e.tags || []) set.add(t);
    return [...set].sort();
  }, [enquiries]);

  const fetchEnquiries = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter, limit: 500 } : { limit: 500 };
      const res = await enquiriesAPI.getEnquiries(params);
      setEnquiries(res.data.data || []);
      setPage(1);
      if (silent) toast.success('Refreshed');
    } catch {
      toast.error('Could not load enquiries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const sorted = useMemo(() => {
    const arr = [...enquiries].sort(SORTERS[sortKey] || SORTERS.date);
    return sortDir === 'asc' ? arr.reverse() : arr;
  }, [enquiries, sortKey, sortDir]);

  const filtered = useMemo(() => {
    let arr = sorted;
    if (tagFilter) arr = arr.filter((e) => (e.tags || []).includes(tagFilter));
    const term = search.trim().toLowerCase();
    if (!term) return arr;
    return arr.filter((e) =>
      [e.clientName, e.phoneNumber, e.email, e.businessName, e.websiteType]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [sorted, search, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await enquiriesAPI.updateStatus(id, newStatus);
      toast.success('Status updated');
      setEnquiries((arr) =>
        arr.map((e) => (e._id === id ? { ...e, status: newStatus } : e))
      );
      if (selected?._id === id) setSelected({ ...selected, status: newStatus });
    } catch {
      toast.error('Failed to update status');
    }
  };

  const updateTags = async (id, nextTags) => {
    try {
      const res = await enquiriesAPI.updateTags(id, nextTags);
      const updated = res.data.data;
      setEnquiries((arr) => arr.map((e) => (e._id === id ? { ...e, tags: updated.tags } : e)));
      if (selected?._id === id) setSelected((s) => ({ ...s, tags: updated.tags }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update tags');
    }
  };

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.info('No enquiries to export');
      return;
    }
    const headers = [
      'Name', 'Phone', 'Email', 'Business', 'Website Type',
      'Pages', 'Domain', 'Style', 'Timeline', 'Budget', 'Status', 'Tags', 'Created',
    ];
    const rows = filtered.map((e) => [
      e.clientName || '',
      e.phoneNumber || '',
      e.email || '',
      e.businessName || '',
      e.websiteType || '',
      e.pagesCount || '',
      e.domainStatus || '',
      e.stylePreference || '',
      e.timeline || '',
      e.budget || '',
      STATUS_LABEL[e.status] || e.status,
      (e.tags || []).join('; '),
      e.createdAt ? new Date(e.createdAt).toISOString() : '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported CSV');
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Enquiries</h1>
          <p>Every lead captured from WhatsApp, in one place.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="secondary" onClick={() => fetchEnquiries(true)} loading={refreshing}>
            <FiRefreshCw /> Refresh
          </Button>
          <Button variant="secondary" onClick={exportCSV}>
            <FiDownload /> Export CSV
          </Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          {view === 'list' && (
            <div className="segmented">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`segmented-item ${filter === f.value ? 'active' : ''}`}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="toolbar-right">
          <div className="segmented" title="View mode">
            <button
              className={`segmented-item ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
            >
              <FiList /> List
            </button>
            <button
              className={`segmented-item ${view === 'board' ? 'active' : ''}`}
              onClick={() => setView('board')}
            >
              <FiGrid /> Board
            </button>
          </div>
          {view === 'list' && (
            <div style={{ width: 280 }}>
              <Input
                icon={FiSearch}
                placeholder="Search by name, phone, business…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {allTags.length > 0 && view === 'list' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Tags:
          </span>
          <button
            type="button"
            onClick={() => setTagFilter('')}
            className={`badge ${!tagFilter ? 'badge-brand' : 'badge-neutral'}`}
            style={{ border: 'none', cursor: 'pointer', height: 24, padding: '0 var(--space-2)' }}
          >
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTagFilter(t === tagFilter ? '' : t)}
              className={`badge ${tagFilter === t ? 'badge-brand' : 'badge-neutral'}`}
              style={{ border: 'none', cursor: 'pointer', height: 24, padding: '0 var(--space-2)' }}
            >
              <FiTag size={10} style={{ marginRight: 4 }} /> {t}
            </button>
          ))}
        </div>
      )}

      {view === 'board' ? (
        <KanbanBoard
          enquiries={filtered}
          loading={loading}
          onMove={updateStatus}
          onOpen={setSelected}
        />
      ) : (
      <div className="table-wrap">
        {loading ? (
          <div className="center-block" style={{ padding: 'var(--space-12)' }}>
            <Spinner size="lg" />
            <p>Loading enquiries…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FiInbox}
            title={search ? 'No matching enquiries' : 'No enquiries yet'}
            description={
              search
                ? 'Try a different search or clear the filter.'
                : 'Once leads come in over WhatsApp, you will see them here.'
            }
          />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <SortableTh label="Client" sortKey="name" current={sortKey} dir={sortDir} onSort={setSort} />
                  <th>Phone</th>
                  <SortableTh label="Business" sortKey="business" current={sortKey} dir={sortDir} onSort={setSort} />
                  <th>Website type</th>
                  <SortableTh label="Date" sortKey="date" current={sortKey} dir={sortDir} onSort={setSort} />
                  <SortableTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={setSort} />
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e._id} onClick={() => setSelected(e)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className="avatar avatar-sm">
                          {(e.clientName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{e.clientName || 'Unknown'}</div>
                          {e.email && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
                              {e.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{e.phoneNumber}</td>
                    <td>{e.businessName || '—'}</td>
                    <td>{e.websiteType || '—'}</td>
                    <td style={{ color: 'var(--c-text-muted)' }}>
                      {e.createdAt ? format(new Date(e.createdAt), 'd MMM, h:mm a') : '—'}
                    </td>
                    <td>
                      <Badge tone={STATUS_BADGE[e.status] || 'neutral'} dot>
                        {STATUS_LABEL[e.status] || e.status}
                      </Badge>
                    </td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(e)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <div className="pagination-info">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length}
              </div>
              <div className="pagination-controls">
                <Button
                  variant="secondary"
                  size="sm"
                  iconOnly
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <FiChevronLeft />
                </Button>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 var(--space-3)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--c-text-muted)',
                  }}
                >
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  iconOnly
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <FiChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Enquiry details"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                navigate(`/conversations/${selected.phoneNumber}`);
                setSelected(null);
              }}
            >
              <FiMessageCircle /> View conversation
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </>
        }
      >
        {selected && (
          <EnquiryDetail
            enquiry={selected}
            onUpdate={updateStatus}
            onTagsChange={(tags) => updateTags(selected._id, tags)}
          />
        )}
      </Modal>
    </>
  );
}

function SortableTh({ label, sortKey, current, dir, onSort }) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: active ? 'var(--c-text)' : undefined }}>
        {label}
        {active && (dir === 'asc' ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />)}
      </span>
    </th>
  );
}

function EnquiryDetail({ enquiry, onUpdate, onTagsChange }) {
  const created = enquiry.createdAt ? new Date(enquiry.createdAt) : null;
  const updated = enquiry.updatedAt ? new Date(enquiry.updatedAt) : null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <div className="avatar avatar-lg">
          {(enquiry.clientName || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h3>{enquiry.clientName || 'Unknown'}</h3>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            {enquiry.phoneNumber} {enquiry.email ? `• ${enquiry.email}` : ''}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 6, flexWrap: 'wrap' }}>
            <Badge tone={STATUS_BADGE[enquiry.status] || 'neutral'} dot>
              {STATUS_LABEL[enquiry.status] || enquiry.status}
            </Badge>
            {enquiry.conversationStage && (
              <Badge tone="neutral">Stage · {enquiry.conversationStage}</Badge>
            )}
            {enquiry.callbackRequested && (
              <Badge tone="danger" dot>Callback requested</Badge>
            )}
            {(enquiry.tags || []).map((t) => (
              <Badge key={t} tone="brand">
                <FiTag size={10} style={{ marginRight: 2 }} /> {t}
              </Badge>
            ))}
          </div>
          {(created || updated) && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)', marginTop: 6 }}>
              {created && <>Created {formatDistanceToNow(created, { addSuffix: true })}</>}
              {created && updated && updated.getTime() - created.getTime() > 60000 ? ' · ' : ''}
              {created && updated && updated.getTime() - created.getTime() > 60000 && (
                <>Updated {formatDistanceToNow(updated, { addSuffix: true })}</>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-block">
          <div className="detail-block-title"><FiUser /> Client</div>
          <Row label="Name" value={enquiry.clientName} />
          <Row label="Phone" value={enquiry.phoneNumber} />
          <Row label="Email" value={enquiry.email} />
          <Row label="Target audience" value={enquiry.targetAudience} />
        </div>

        <div className="detail-block">
          <div className="detail-block-title"><FiBriefcase /> Business</div>
          <Row label="Brand" value={enquiry.businessName} />
          <Row label="Website type" value={enquiry.websiteType} />
          <Row label="Pages count" value={enquiry.pagesCount} />
          <Row label="Style" value={enquiry.stylePreference} />
        </div>

        <div className="detail-block">
          <div className="detail-block-title"><FiGlobe /> Project</div>
          <Row label="Timeline" value={enquiry.timeline} />
          <Row
            label="Existing site"
            value={
              enquiry.existingWebsite ? (
                <a
                  href={
                    enquiry.existingWebsite.startsWith('http')
                      ? enquiry.existingWebsite
                      : `https://${enquiry.existingWebsite}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit <FiExternalLink style={{ verticalAlign: '-2px' }} />
                </a>
              ) : null
            }
          />
          <Row label="Domain status" value={enquiry.domainStatus} />
          <Row label="Core feature" value={enquiry.coreFeature} />
          <Row label="Other features" value={enquiry.features} />
          <Row label="Budget" value={enquiry.budget} />
        </div>
      </div>

      <div className="detail-block" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="detail-block-title"><FiTag /> Tags</div>
        <TagsEditor tags={enquiry.tags || []} onChange={onTagsChange} />
      </div>

      <div className="detail-block">
        <div className="detail-block-title"><FiSettings /> Update status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {STATUS_FILTERS.slice(1).map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={enquiry.status === f.value ? 'primary' : 'secondary'}
              onClick={() => onUpdate(enquiry._id, f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}

function TagsEditor({ tags, onChange }) {
  const [draft, setDraft] = useState('');

  const remove = (t) => onChange(tags.filter((x) => x !== t));
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (tags.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...tags, v]);
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
      {tags.map((t) => (
        <span key={t} className="badge badge-brand" style={{ height: 24, padding: '0 var(--space-2)' }}>
          {t}
          <button
            type="button"
            onClick={() => remove(t)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              marginLeft: 6,
              color: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            aria-label={`Remove tag ${t}`}
          >
            <FiX size={12} />
          </button>
        </span>
      ))}
      <input
        className="input"
        style={{ height: 28, width: 160, padding: '0 var(--space-2)', fontSize: 'var(--text-xs)' }}
        placeholder="Add tag…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

const KANBAN_COLUMNS = [
  { value: 'new', label: 'New', tone: 'warning' },
  { value: 'in_progress', label: 'In progress', tone: 'info' },
  { value: 'completed', label: 'Completed', tone: 'success' },
  { value: 'callback_requested', label: 'Callback', tone: 'danger' },
];

function KanbanBoard({ enquiries, loading, onMove, onOpen }) {
  const [dragOver, setDragOver] = useState(null);

  const grouped = useMemo(() => {
    const map = {};
    for (const col of KANBAN_COLUMNS) map[col.value] = [];
    for (const e of enquiries) {
      if (!map[e.status]) map[e.status] = [];
      map[e.status].push(e);
    }
    return map;
  }, [enquiries]);

  if (loading) {
    return (
      <div className="center-block">
        <Spinner size="lg" /> Loading board…
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, minmax(220px, 1fr))`,
        gap: 'var(--space-3)',
        alignItems: 'flex-start',
      }}
    >
      {KANBAN_COLUMNS.map((col) => (
        <div
          key={col.value}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(col.value);
          }}
          onDragLeave={() => setDragOver((c) => (c === col.value ? null : c))}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            setDragOver(null);
            if (id) onMove(id, col.value);
          }}
          style={{
            background: dragOver === col.value ? 'var(--c-brand-soft)' : 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3)',
            minHeight: 360,
            transition: 'background var(--transition-fast)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
            }}
          >
            <Badge tone={col.tone} dot>{col.label}</Badge>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)' }}>
              {grouped[col.value]?.length || 0}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {(grouped[col.value] || []).map((e) => (
              <div
                key={e._id}
                draggable
                onDragStart={(ev) => ev.dataTransfer.setData('text/plain', e._id)}
                onClick={() => onOpen(e)}
                style={{
                  background: 'var(--c-surface-2)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  cursor: 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div className="avatar avatar-sm">
                    {(e.clientName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.clientName || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>
                      {e.phoneNumber}
                    </div>
                  </div>
                </div>
                {e.businessName && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-muted)' }}>
                    {e.businessName} · {e.websiteType || 'website'}
                  </div>
                )}
                {(e.tags || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(e.tags || []).slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="badge badge-brand"
                        style={{ height: 18, padding: '0 6px', fontSize: '0.6875rem' }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(grouped[col.value] || []).length === 0 && (
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--c-text-subtle)',
                  textAlign: 'center',
                  padding: 'var(--space-4) var(--space-2)',
                  border: '1px dashed var(--c-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                Drop here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }) {
  const display = value ?? '—';
  return (
    <div className="detail-row">
      <span className="label">{label}</span>
      <span className="value">{display || '—'}</span>
    </div>
  );
}
