import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { KovaAvatar } from './KovaAvatar';
import { ArrowLeft, ArrowRight, Lock, Mail, User, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthScreenProps {
  onBackToLanding: () => void;
  initialMode?: 'login' | 'signup';
  initialAuthError?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onBackToLanding,
  initialMode = 'signup',
  initialAuthError = null,
}) => {
  const { loginWithEmail, signUpWithEmail, loginWithGoogle, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(initialAuthError);
  const [isEmailInUseError, setIsEmailInUseError] = useState(false);
  const [isUserNotFoundError, setIsUserNotFoundError] = useState(false);
  const [isInvalidCredentialError, setIsInvalidCredentialError] = useState(false);

  // Forgot Password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSentMessage, setResetSentMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsEmailInUseError(false);
    setIsUserNotFoundError(false);
    setIsInvalidCredentialError(false);
    setIsGoogleLoading(true);

    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('[AuthScreen] Google sign-in error:', err?.code, err?.message || err);
      const code = String(err?.code || '');
      const msg = String(err?.message || '').toLowerCase();
      // Gracefully handle cancellations without leaving error states or blocked loading overlays
      const isCancellation =
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === '12501' || // Google Play Services SIGN_IN_CANCELLED
        code === '16' ||    // Google Play Services CANCELED
        msg.includes('cancelled') ||
        msg.includes('canceled') ||
        msg.includes('popup-closed-by-user') ||
        msg.includes('popup closed');

      if (code === 'auth/account-exists-with-different-credential') {
        setAuthError('An account with this email already exists with a password. Please sign in with your email and password.');
      } else if (!isCancellation) {
        setAuthError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password.trim()) return;
    if (mode === 'signup' && !firstName.trim()) return;

    setAuthError(null);
    setIsEmailInUseError(false);
    setIsUserNotFoundError(false);
    setIsInvalidCredentialError(false);
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        await signUpWithEmail(cleanEmail, password, firstName.trim());
      } else {
        await loginWithEmail(cleanEmail, password);
      }
    } catch (err: any) {
      console.warn('[AuthScreen] Email auth error code:', err?.code, 'message:', err?.message || err);
      let msg = 'Authentication failed. Please check your details.';
      
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists — try logging in instead.';
        setIsEmailInUseError(true);
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        msg = 'An account with this email already exists with Google. Please sign in with Google instead.';
      } else if (err.code === 'auth/user-not-found') {
        if (mode === 'login') {
          msg = "We couldn't find an account with that email — want to sign up instead?";
          setIsUserNotFoundError(true);
        } else {
          msg = 'No account found. Please check your email or sign up.';
        }
      } else if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-login-credentials'
      ) {
        if (mode === 'login') {
          msg = "That password doesn't look right — try again, or reset your password.";
          setIsInvalidCredentialError(true);
        } else {
          msg = 'Invalid credentials. Please check your details.';
        }
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Access temporarily locked due to many failed attempts. Try again later or reset your password.';
        setIsInvalidCredentialError(true);
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.message) {
        msg = err.message;
      }
      setAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setResetError('Please enter your email address.');
      return;
    }

    setResetError(null);
    setIsSendingReset(true);
    try {
      await sendPasswordReset(cleanEmail);
      setResetSentMessage('Check your inbox for a reset link. Once reset, return here to log in with your new password.');
    } catch (err: any) {
      console.warn('[AuthScreen] Password reset error code:', err?.code, 'message:', err?.message || err);
      if (err.code === 'auth/user-not-found') {
        setResetError('No account found with that email address.');
      } else if (err.code === 'auth/invalid-email') {
        setResetError('Please enter a valid email address.');
      } else {
        setResetError(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setIsSendingReset(false);
    }
  };

  const switchMode = (newMode: 'login' | 'signup') => {
    setAuthError(null);
    setIsEmailInUseError(false);
    setIsUserNotFoundError(false);
    setIsInvalidCredentialError(false);
    setShowForgotPassword(false);
    setResetSentMessage(null);
    setResetError(null);
    setMode(newMode);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between px-4 py-6 font-sans max-w-md mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLanding}
          className="text-xs text-[#8A8A8E] hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <KovaAvatar size="sm" isPulsing={true} />
          <span className="text-xs font-bold text-white tracking-tight">Kova</span>
        </div>
      </div>

      {/* Main Glass Auth Card */}
      <div className="my-auto py-6 space-y-4">
        <div className="glass-card rounded-[28px] p-6 border border-white/15 bg-[#18181A]/95 shadow-2xl relative space-y-5">
          {showForgotPassword ? (
            /* Forgot Password Flow */
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-serif-headline font-normal text-white">
                  Reset your password
                </h2>
                <p className="text-xs text-[#8A8A8E]">
                  Enter your email and Kova will send you a reset link
                </p>
              </div>

              {resetSentMessage ? (
                <div className="space-y-4 pt-1">
                  <div className="text-xs text-[#30D158] bg-[#30D158]/10 border border-[#30D158]/20 rounded-2xl p-4 flex items-center gap-2.5 justify-center">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#30D158]" />
                    <span className="font-medium">{resetSentMessage}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetSentMessage(null);
                      setResetError(null);
                    }}
                    className="w-full py-3.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Log in</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                  {resetError && (
                    <div className="text-[11px] text-[#FF6B6B] bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-2xl p-3.5 flex items-start justify-center gap-1.5 font-medium leading-relaxed text-center">
                      <AlertCircle className="w-4 h-4 shrink-0 text-[#FF6B6B] mt-0.5" />
                      <span className="break-words text-[11px] text-[#FF8080]">{resetError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#8A8A8E] uppercase tracking-wider block">
                      Account email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="name@domain.com"
                        className="w-full bg-[#121214] border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white/30 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className="w-full py-3.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingReset ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black shrink-0" />
                        <span>Sending reset link...</span>
                      </>
                    ) : (
                      <>
                        <span>Send reset link</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetError(null);
                      }}
                      className="text-xs text-[#8A8A8E] hover:text-white transition-colors underline underline-offset-4 cursor-pointer"
                    >
                      Back to Log in
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Standard Login / Signup Flow */
            <>
              {/* Header Title */}
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-serif-headline font-normal text-white">
                  {mode === 'signup' ? 'Welcome to Kova' : 'Welcome back'}
                </h2>
                <p className="text-xs text-[#8A8A8E]">
                  {mode === 'signup'
                    ? 'Create your space for money conversations'
                    : 'Enter your credentials to continue'}
                </p>
              </div>

              {/* Segmented Pill Switch */}
              <div className="flex justify-center">
                <div className="bg-[#121214] p-1 rounded-full border border-white/10 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                      mode === 'signup' ? 'bg-white text-black shadow-md' : 'text-[#8A8A8E] hover:text-white'
                    }`}
                  >
                    Sign up
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                      mode === 'login' ? 'bg-white text-black shadow-md' : 'text-[#8A8A8E] hover:text-white'
                    }`}
                  >
                    Log in
                  </button>
                </div>
              </div>

              {/* Google Sign-In Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isSubmitting}
                  className="w-full py-3 px-4 rounded-full bg-white hover:bg-neutral-100 text-black font-semibold text-xs flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {isGoogleLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black shrink-0" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              </div>

              {/* Divider with "or" */}
              <div className="relative flex items-center justify-center my-1">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-[#18181A] px-3 text-[11px] text-[#8A8A8E] lowercase font-medium relative z-10 shrink-0">
                  or with email
                </span>
              </div>

              {/* Error Display with Conditional Switch Buttons */}
              {authError && (
                <div className="text-[11px] text-[#FF6B6B] bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-2xl p-3.5 space-y-2.5 text-center">
                  <div className="flex items-start justify-center gap-1.5 font-medium leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#FF6B6B] mt-0.5" />
                    <span className="break-words text-[11px] text-[#FF8080]">{authError}</span>
                  </div>
                  {isEmailInUseError && (
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-black hover:bg-white/90 rounded-full text-[11px] font-semibold transition-all cursor-pointer shadow-md active:scale-95"
                    >
                      <span>Switch to Log In</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  )}
                  {isUserNotFoundError && (
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-black hover:bg-white/90 rounded-full text-[11px] font-semibold transition-all cursor-pointer shadow-md active:scale-95"
                    >
                      <span>Switch to Sign Up</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  )}
                  {isInvalidCredentialError && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email.trim().toLowerCase());
                        setResetSentMessage(null);
                        setResetError(null);
                        setShowForgotPassword(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-black hover:bg-white/90 rounded-full text-[11px] font-semibold transition-all cursor-pointer shadow-md active:scale-95"
                    >
                      <span>Reset your password</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  )}
                </div>
              )}

              {/* Form Fields */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* First Name (Only for Sign Up) */}
                {mode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#8A8A8E] uppercase tracking-wider block">
                      What should Kova call you?
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required={mode === 'signup'}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First Name (e.g., Alex)"
                        className="w-full bg-[#121214] border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white/30 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Email Field */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#8A8A8E] uppercase tracking-wider block">
                    Where should Kova reach you?
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      className="w-full bg-[#121214] border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white/30 transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#8A8A8E] uppercase tracking-wider block">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#121214] border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white/30 transition-all"
                    />
                  </div>
                  {/* Forgot Password Link (Only for Log In) */}
                  {mode === 'login' && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email.trim());
                          setResetSentMessage(null);
                          setResetError(null);
                          setShowForgotPassword(true);
                        }}
                        className="text-xs text-[#8A8A8E] hover:text-white transition-colors underline underline-offset-4 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>

                {/* Submit Action Pill Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || isGoogleLoading}
                  className="w-full py-3.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <span>
                    {isSubmitting
                      ? 'Connecting...'
                      : mode === 'signup'
                      ? 'Get to know Kova'
                      : 'Enter Kova'}
                  </span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </form>

              {/* Toggle Helper Link */}
              <div className="text-center pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
                  className="text-xs text-[#8A8A8E] hover:text-white transition-colors underline underline-offset-4 cursor-pointer"
                >
                  {mode === 'signup'
                    ? 'Already have an account? Log in'
                    : "Don't have an account? Sign up"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer minimal text */}
      <div className="text-center text-[10px] text-[#8A8A8E]">
        Protected by Kova's private encryption standard.
      </div>
    </div>
  );
};

