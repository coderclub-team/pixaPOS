import React from 'react';
import { SidebarTrigger } from '../base-ui/sidebar';
import { Separator } from '../base-ui/separator';
import { Breadcrumbs } from '../breadcrumbs';
import { ThemeSelector } from '../themes/theme-selector';
import { ThemeModeToggle } from '../themes/theme-mode-toggle';

interface HeaderProps {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export default function Header({ leftSlot, rightSlot }: HeaderProps) {
  return (
    <header className='bg-background/60 sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 backdrop-blur-md md:h-14'>
      <div className='flex items-center gap-2 px-4'>
        <SidebarTrigger className='-ml-1' />
        <Separator orientation='vertical' className='mr-2 h-4 data-vertical:self-center' />
        <Breadcrumbs />
        {leftSlot}
      </div>

      <div className='flex items-center gap-2 px-4'>
        {rightSlot}
        <ThemeModeToggle />
        <div className='hidden sm:block'>
          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}
