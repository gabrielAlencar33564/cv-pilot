import { Suspense } from 'react';
import { LoginForm } from '@/features/auth/LoginForm';

// o formulário lê o ?next= da URL, o que exige um Suspense no App Router
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
