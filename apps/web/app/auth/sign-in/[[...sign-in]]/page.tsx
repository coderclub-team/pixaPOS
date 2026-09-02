import { Metadata } from 'next';
import { SignIn as ClerkSignInForm } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'Authentication | Sign In',
  description: 'Sign In page for authentication.'
};

export default function SignInPage() {
  return (
    <div className='flex min-h-screen items-center justify-center p-4'>
      <ClerkSignInForm
        routing='path'
        path='/auth/sign-in'
        signUpUrl='/auth/sign-up'
        fallbackRedirectUrl='/dashboard'
      />
    </div>
  );
}
