import clsx from 'clsx';

export default function Badge({ tone = 'neutral', dot = false, children, className }) {
  return (
    <span className={clsx('badge', `badge-${tone}`, className)}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
