import React from 'react';
import { SidebarTrigger } from '@pixa/ui/base-ui/sidebar';
import { Separator } from '@pixa/ui/base-ui/separator';
import { ThemeModeToggle } from '@pixa/ui/themes/theme-mode-toggle';

export default function Header() {
  return (
    <header className='bg-background/60 sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 backdrop-blur-md md:h-14'>
      <div className='flex items-center gap-2 px-4'>
        <SidebarTrigger className='-ml-1' />
        <Separator orientation='vertical' className='mr-2 h-4 data-vertical:self-center' />
      </div>

      <div className='flex items-center gap-2 px-4'>
        <ThemeModeToggle />
      </div>
    </header>
  );
}
