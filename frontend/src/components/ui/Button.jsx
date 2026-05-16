import clsx from 'clsx';

export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  iconOnly = false,
  loading = false,
  disabled = false,
  className,
  children,
  ...rest
}) {
  return (
    <button
      className={clsx(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        block && 'btn-block',
        iconOnly && 'btn-icon',
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner" /> : children}
    </button>
  );
}
