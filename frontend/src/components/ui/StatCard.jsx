import clsx from 'clsx';

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  delta,
  deltaTone = 'success',
  hint,
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {Icon && (
          <span className={clsx('stat-card-icon', `stat-tone-${tone}`)}>
            <Icon />
          </span>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      {(delta || hint) && (
        <div className="stat-card-meta">
          {delta && (
            <span className={clsx('stat-card-delta', `stat-delta-${deltaTone}`)}>{delta}</span>
          )}
          {hint && <span className="stat-card-hint">{hint}</span>}
        </div>
      )}
    </div>
  );
}
