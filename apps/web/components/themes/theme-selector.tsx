'use client';

import * as React from 'react';
import { useThemeConfig } from './active-theme';
import { THEMES } from './theme.config';
import { Icons } from '../icons';

export function ThemeSelector() {
  const { activeTheme, setActiveTheme } = useThemeConfig();

  return (
    <div className='flex items-center gap-1'>
      <button
        onClick={() => setActiveTheme('vercel')}
        className={`inline-flex size-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-foreground ${
          activeTheme === 'vercel' ? 'bg-muted text-foreground' : ''
        }`}
        title='Vercel theme'
      >
        <Icons.logo className='size-4' />
      </button>
      <button
        onClick={() => setActiveTheme('claude')}
        className={`inline-flex size-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-foreground ${
          activeTheme === 'claude' ? 'bg-muted text-foreground' : ''
        }`}
        title='Claude theme'
      >
        <Icons.pizza className='size-4' />
      </button>
      <button
        onClick={() => setActiveTheme('discord')}
        className={`inline-flex size-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-foreground ${
          activeTheme === 'discord' ? 'bg-muted text-foreground' : ''
        }`}
        title='Discord theme'
      >
        <Icons.chat className='size-4' />
      </button>
    </div>
  );
}
