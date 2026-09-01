'use client';

import * as React from 'react';
import { useTheme } from './theme-provider';
import { Icons } from '../icons';

export function ThemeModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className='inline-flex size-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-foreground'
    >
      {theme === 'dark' ? <Icons.sun className='size-4' /> : <Icons.moon className='size-4' />}
      <span className='sr-only'>Toggle theme</span>
    </button>
  );
}
