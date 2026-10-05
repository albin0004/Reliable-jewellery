import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Clock,
  KeyRound,
  Eye,
  EyeOff,
  Zap,
  Lock,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { getStoredFirebaseConfig } from '../services/firebase.js';
import { createShareToken, generateShareUrl } from '../services/shareService.js';

export default function ShareModal({
  isOpen,
  onClose,
  onOpenSettings,
}) {
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [usePin, setUsePin] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const urlInputRef = useRef(null);

  // Check if Firebase is configured
  const firebaseConfig = getStoredFirebaseConfig();
  const isFirebaseConfigured = Boolean(
    firebaseConfig && firebaseConfig.databaseURL && firebaseConfig.apiKey
  );

  // Generate or regenerate share URL when options change
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setError(null);
      return;
    }

    if (!isFirebaseConfigured) {
      setError('Firebase Realtime Database is not configured. Please add your credentials in Settings first.');
      setShareUrl('');
      return;
    }

    try {
      setError(null);
      const token = createShareToken({
        config: firebaseConfig,
        expiresInDays,
        pinCode: usePin ? pinCode : '',
      });
      const url = generateShareUrl(token);
      setShareUrl(url);
    } catch (err) {
      setError(err.message || 'Failed to generate share link.');
      setShareUrl('');
    }
  }, [isOpen, expiresInDays, usePin, pinCode, isFirebaseConfigured]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      if (urlInputRef.current) {
        urlInputRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    }
  };

  const handleOpenPreview = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white px-5 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight m-0">
                Share Live Ledger (Read-Only)
              </h2>
              <p className="text-[11px] text-blue-100 m-0">
                Generate a secure link for real-time live view
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 text-xs text-slate-600">
          {!isFirebaseConfigured ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 text-amber-900">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-sm">Database Setup Required</div>
                  <p className="text-xs text-amber-800 leading-relaxed m-0">
                    To allow others to view your ledger live in real time on their own devices,
                    you must connect to a Firebase Realtime Database.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  if (onOpenSettings) onOpenSettings('database');
                }}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs flex items-center justify-center gap-2"
              >
                <span>Configure Firebase Database</span>
              </button>
            </div>
          ) : (
            <>
              {/* Permission & Security Guarantee Banner */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Recipient Permissions &amp; Security
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span><strong>Read-Only:</strong> Cannot edit or delete</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span><strong>Live Sync:</strong> Updates in real-time</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span><strong>Signed Token:</strong> Tamper-proof URL</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span><strong>No Login:</strong> Recipient opens directly</span>
                  </div>
                </div>
              </div>

              {/* Expiry Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Link Expiration</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '24 Hours', value: 1 },
                    { label: '7 Days', value: 7 },
                    { label: '30 Days', value: 30 },
                    { label: 'Never', value: 0 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setExpiresInDays(opt.value)}
                      className={`py-2 px-2 rounded-lg font-medium text-center transition-all cursor-pointer ${
                        expiresInDays === opt.value
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Passcode PIN */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="pin-toggle"
                    className="font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>Require 4-Digit Passcode</span>
                  </label>
                  <input
                    id="pin-toggle"
                    type="checkbox"
                    checked={usePin}
                    onChange={(e) => setUsePin(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {usePin && (
                  <div className="flex items-center gap-2 animate-in fade-in">
                    <div className="relative flex-1">
                      <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={8}
                        placeholder="Enter passcode (e.g. 7722)"
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 pr-9 font-mono text-slate-800 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      Viewer must enter this to see data
                    </span>
                  </div>
                )}
              </div>

              {/* Generated Shareable Link Output */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <label className="font-semibold text-slate-700 block">
                  Shareable Live Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={urlInputRef}
                    type="text"
                    readOnly
                    value={shareUrl}
                    onClick={(e) => e.target.select()}
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2.5 font-mono outline-none truncate select-all"
                  />
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-bold transition-all shadow-xs shrink-0 cursor-pointer ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Actions & Preview */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview Recipient View (Test)</span>
                </button>

                <span className="text-[11px] text-slate-400">
                  {expiresInDays > 0 ? `Valid for ${expiresInDays} day(s)` : 'Never expires'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-5 sm:px-6 py-3 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
