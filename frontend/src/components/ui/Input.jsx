import clsx from 'clsx';

export default function Input({ icon: Icon, className, ...rest }) {
  if (Icon) {
    return (
      <div className="input-wrap">
        <Icon />
        <input className={clsx('input', className)} {...rest} />
      </div>
    );
  }
  return <input className={clsx('input', className)} {...rest} />;
}

export function Textarea({ className, ...rest }) {
  return <textarea className={clsx('textarea', className)} {...rest} />;
}

export function Field({ label, hint, error, children }) {
  return (
    <div className="input-group">
      {label && <label className="label">{label}</label>}
      {children}
      {hint && !error && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)' }}>{hint}</div>
      )}
      {error && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--c-danger-text)' }}>{error}</div>
      )}
    </div>
  );
}
