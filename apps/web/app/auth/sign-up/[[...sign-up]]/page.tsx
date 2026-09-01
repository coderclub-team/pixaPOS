import { Metadata } from 'next';
import { SignUp as ClerkSignUpForm } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'Authentication | Sign Up',
  description: 'Sign Up page for authentication.'
};

export default function SignUpPage() {
  return (
    <div className='flex min-h-screen items-center justify-center p-4'>
      <ClerkSignUpForm
        routing='path'
        path='/auth/sign-up'
        signInUrl='/auth/sign-in'
        fallbackRedirectUrl='/dashboard'
      />
    </div>
  );
}
