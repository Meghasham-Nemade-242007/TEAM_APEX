import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Scale, Lock, Mail, User, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('demo@legal.local');
  const [password, setPassword] = useState('demo1234');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isRegistering) {
        if (!fullName.trim()) {
          setError('Please provide your full legal counsel name');
          setSubmitting(false);
          return;
        }
        await register(email, password, fullName);
      } else {
        await login(email, password);
      }
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : err instanceof Error
          ? err.message
          : 'Authentication failed. Please check credentials or ensure backend is running.';
      setError(String(msg || 'Authentication failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseDemo = () => {
    setIsRegistering(false);
    setEmail('demo@legal.local');
    setPassword('demo1234');
  };

  return (
    <div className="min-h-screen bg-page-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-navy text-blue-300 shadow-lg border border-navy-dark mb-4">
          <Scale className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">
          Legal Document Analysis System
        </h1>
        <p className="mt-1 text-xs text-text-secondary tracking-wide uppercase font-medium">
          Official Review & Intelligence Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card-bg py-8 px-4 sm:px-10 shadow-card rounded-xl border border-border">
          {/* Header tabs */}
          <div className="flex border-b border-border mb-6">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(false);
                setError(null);
              }}
              className={`flex-1 pb-3 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors ${
                !isRegistering
                  ? 'border-blue-primary text-blue-primary'
                  : 'border-transparent text-text-secondary hover:text-navy'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(true);
                setError(null);
              }}
              className={`flex-1 pb-3 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors ${
                isRegistering
                  ? 'border-blue-primary text-blue-primary'
                  : 'border-transparent text-text-secondary hover:text-navy'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-error">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-medium text-navy mb-1.5">
                  Full Name & Title
                </label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Adv. Rajesh Sharma"
                    className="block w-full pl-9 pr-3 py-2 border border-border rounded-md text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-primary focus:border-transparent text-navy"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-navy mb-1.5">
                Official Email Address
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="counsel@court.gov.in"
                  className="block w-full pl-9 pr-3 py-2 border border-border rounded-md text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-primary focus:border-transparent text-navy"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-navy mb-1.5">Password</label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 border border-border rounded-md text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-primary focus:border-transparent text-navy"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={submitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isRegistering ? 'Register & Continue' : 'Sign In to Portal'}
            </Button>
          </form>

          {/* Demo account hint badge */}
          <div className="mt-6 pt-5 border-t border-border">
            <div className="p-3 bg-blue-light/50 border border-blue-200/80 rounded-lg flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-primary shrink-0 mt-0.5" />
                <div className="text-[11px] text-navy">
                  <p className="font-semibold">Hackathon Demo Access</p>
                  <p className="text-text-secondary mt-0.5">
                    Username: <span className="font-mono text-navy">demo@legal.local</span>
                    <br />
                    Password: <span className="font-mono text-navy">demo1234</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUseDemo}
                className="text-xs text-blue-primary hover:underline font-medium shrink-0"
              >
                Auto-fill
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
