import clsx from 'clsx';

export function Card({ padded = false, className, children, ...rest }) {
  return (
    <div className={clsx('card', padded && 'card-padded', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={clsx('card-header', className)}>
      <div>
        {title && <h3>{title}</h3>}
        {subtitle && (
          <p style={{ fontSize: 'var(--text-sm)', marginTop: 2 }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={clsx('card-body', className)}>{children}</div>;
}
