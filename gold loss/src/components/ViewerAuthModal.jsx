import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  AlertCircle,
  Clock,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { clearShareParamFromUrl } from '../services/shareService.js';

export default function ViewerAuthModal({
  status, // 'pin_required' | 'expired' | 'invalid'
  shareMetadata,
  onAuthenticatePin,
}) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (status === 'pin_required') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [status]);

  if (!status || status === 'authorized') return null;

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter the passcode.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const success = onAuthenticatePin(pin.trim());
    if (!success) {
      setError('Incorrect passcode. Access denied.');
      setIsSubmitting(false);
    } else {
      setIsSubmitting(false);
    }
  };

  const handleExitViewer = () => {
    clearShareParamFromUrl();
    window.location.reload();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in"
    >
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5">
        {/* Expired Link State */}
        {status === 'expired' && (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <Clock className="w-7 h-7 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 m-0">
                Share Link Has Expired
              </h2>
              <p className="text-xs text-slate-500 mt-1 m-0 leading-relaxed">
                This real-time ledger link was set with an expiration date and is no longer valid.
                Please contact the ledger owner to request a newly generated share link.
              </p>
            </div>
            {shareMetadata?.expiresAt && (
              <div className="text-[11px] text-slate-400 font-mono bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200">
                Expired: {new Date(shareMetadata.expiresAt).toLocaleString()}
              </div>
            )}
            <button
              onClick={handleExitViewer}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Exit to Home
            </button>
          </div>
        )}

        {/* Invalid Token State */}
        {status === 'invalid' && (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertCircle className="w-7 h-7 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 m-0">
                Invalid Share Link
              </h2>
              <p className="text-xs text-slate-500 mt-1 m-0 leading-relaxed">
                This share link is corrupted, invalid, or has been altered. Please request a new link
                from the ledger administrator.
              </p>
            </div>
            <button
              onClick={handleExitViewer}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Exit to Home
            </button>
          </div>
        )}

        {/* Passcode Required State */}
        {status === 'pin_required' && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto border border-blue-200">
                <Lock className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 m-0">
                  Passcode Protected Ledger
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 m-0">
                  Enter the 4-digit passcode provided by the owner to view live records.
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Security Passcode
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPin ? 'text' : 'password'}
                  maxLength={10}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter passcode..."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 text-slate-900 text-sm font-mono tracking-widest text-center rounded-xl py-2.5 pr-10 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Unlock &amp; View Live</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleExitViewer}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Exit
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
