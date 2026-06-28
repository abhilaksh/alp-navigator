'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { signIn, signUp } from './actions';
import { ActionState } from '@/lib/auth/middleware';

export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const inviteId = searchParams.get('inviteId');

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: '' }
  );

  return (
    <div className="min-h-[100dvh] flex bg-paper">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[420px] bg-spruce flex-col justify-between p-12">
        <div>
          <span className="font-display italic text-brass text-2xl tracking-tight">alp</span>
        </div>
        <div>
          <p className="text-white/40 text-sm font-sans">
            Quote Builder for Fora Pro advisors.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24">
        <div className="w-full max-w-sm">
          {/* Mobile monogram */}
          <div className="lg:hidden mb-10">
            <span className="font-display italic text-spruce text-2xl tracking-tight">alp</span>
          </div>

          <h1 className="font-display text-3xl text-ink mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-ink-mute text-sm mb-8">
            {mode === 'signin'
              ? 'Sign in to your Navigator account.'
              : 'Start building luxury travel quotes.'}
          </p>

          <form className="space-y-5" action={formAction}>
            <input type="hidden" name="redirect" value={redirect || ''} />
            <input type="hidden" name="inviteId" value={inviteId || ''} />

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={state.email}
                required
                maxLength={255}
                className="w-full px-3.5 py-2.5 bg-white border border-glacier rounded text-sm text-ink placeholder-ink-mute focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                defaultValue={state.password}
                required
                minLength={8}
                maxLength={100}
                className="w-full px-3.5 py-2.5 bg-white border border-glacier rounded text-sm text-ink placeholder-ink-mute focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-colors"
                placeholder={mode === 'signin' ? '••••••••' : 'Min. 8 characters'}
              />
            </div>

            {state?.error && (
              <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded px-3 py-2">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-spruce hover:bg-spruce-light text-white text-sm font-medium rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-mute">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <Link
              href={mode === 'signin' ? '/sign-up' : '/sign-in'}
              className="text-brass hover:text-brass-light font-medium transition-colors"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
