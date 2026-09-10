import { cn } from '../lib/utils';

function StatusDot({
  isActive,
  className,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
}: {
  isActive: boolean;
  className?: string;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  const label = isActive ? activeLabel : inactiveLabel;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      <span
        className={cn(
          'inline-block size-2 rounded-full',
          isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'
        )}
        title={label}
      />
      <span className={isActive ? '' : 'text-muted-foreground'}>{label}</span>
    </span>
  );
}

export { StatusDot };
