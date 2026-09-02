"use client";

import { UserProfile } from '@clerk/nextjs';

export default function ProfileViewPage() {
  return (
    <div className='flex w-full flex-col p-4'>
      <UserProfile routing='path' path='/template/dashboard/profile' />
    </div>
  );
}
