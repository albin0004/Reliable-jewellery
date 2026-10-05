import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { verifyDeletionPassword } from '../services/security';

export default function PasswordPromptModal({
  isOpen,
  tab,
  onClose,
  onConfirmDelete,
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setIsSuccess(false);
      setIsSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen || !tab) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the security password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Verify using cryptographic SHA-256 hash comparison
    const isValid = verifyDeletionPassword(password.trim());

    if (!isValid) {
      setIsSubmitting(false);
      setError('Incorrect security password. Authorization failed.');
      return;
    }

    setIsSuccess(true);
    setTimeout(async () => {
      try {
        await onConfirmDelete(tab.id, password.trim());
        setIsSubmitting(false);
        onClose();
      } catch (err) {
        setIsSubmitting(false);
        setIsSuccess(false);
        setError(err.message || 'Failed to delete tab.');
      }
    }, 400);
  };

  const tabDisplayName = tab.name || tab.defaultName || 'Selected Tab';

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-600 border border-rose-200">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 m-0">
                Security Authorization Required
              </h3>
              <p className="text-xs text-rose-700 m-0 font-medium">
                Encrypted Password Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span>Delete Category:</span>
              <span className="text-rose-600 font-bold px-1.5 py-0.5 rounded bg-rose-50 border border-rose-100">
                {tabDisplayName}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 m-0 leading-relaxed">
              Deleting this tab will permanently remove all associated transaction records. 
              An automatic safety backup snapshot will be generated. Please provide the administrative password to proceed.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Administrative Security Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter password..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white text-slate-800 text-xs rounded-xl pl-9 pr-10 py-2.5 font-mono outline-none transition-all shadow-2xs"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in duration-100">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="font-semibold">Password verified. Deleting tab...</div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isSuccess || !password.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white shadow-xs transition-all active:scale-98 flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Verifying...' : 'Verify & Delete Tab'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
