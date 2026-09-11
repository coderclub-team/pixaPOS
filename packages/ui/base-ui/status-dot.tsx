
import { cn } from '../lib/utils';

type StatusDotProps = {
  isActive: boolean;
  className?: string;
  activeLabel?: string;
  inactiveLabel?: string;
};

function StatusDot({
  isActive,
  className,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
}: StatusDotProps) {
  const label = isActive ? activeLabel : inactiveLabel;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap',
        'text-sm leading-none',
        isActive ? 'text-foreground' : 'text-muted-foreground',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-2.5 items-center justify-center rounded-full',
          isActive
            ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30'
            : 'bg-muted-foreground/10 ring-1 ring-muted-foreground/20'
        )}
      >
        <span
          className={cn(
            'size-1.5 rounded-full',
            isActive ? 'bg-emerald-500' : 'bg-muted-foreground/50'
          )}
        />
      </span>

      <span>{label}</span>
    </span>
  );
}

export { StatusDot };
