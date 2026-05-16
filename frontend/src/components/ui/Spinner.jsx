import clsx from 'clsx';

export default function Spinner({ size = 'md', className }) {
  return <span className={clsx('spinner', size === 'lg' && 'spinner-lg', className)} />;
}

export function FullSpinner({ label }) {
  return (
    <div className="center-block">
      <Spinner size="lg" />
      {label && <p>{label}</p>}
    </div>
  );
}
