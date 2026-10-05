import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  RefreshCw,
  Globe,
  QrCode,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { getStoredFirebaseConfig } from '../services/firebase.js';
import { createShareToken, generateShareUrl } from '../services/shareService.js';
import {
  shortenUrl,
  getHostedBaseUrl,
  setHostedBaseUrl,
} from '../services/urlShortener.js';

export default function ShareModal({
  isOpen,
  onClose,
  onOpenSettings,
}) {
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [usePin, setUsePin] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [showPin, setShowPin] = useState(false);

  // URLs & Shortener State
  const [rawShareUrl, setRawShareUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [linkMode, setLinkMode] = useState('short'); // 'short' | 'full'
  const [isShortening, setIsShortening] = useState(false);
  const [shortProvider, setShortProvider] = useState(null);
  const [shortError, setShortError] = useState(null);

  // Extras: QR Code, Domain Config, Copy
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showDomainSettings, setShowDomainSettings] = useState(false);
  const [hostedDomain, setHostedDomain] = useState(() => getHostedBaseUrl());
  const [domainInput, setDomainInput] = useState(() => getHostedBaseUrl());
  const [domainSaved, setDomainSaved] = useState(false);

  const [error, setError] = useState(null);
  const urlInputRef = useRef(null);
  const shortenReqIdRef = useRef(0);

  // Check if Firebase is configured
  const firebaseConfig = getStoredFirebaseConfig();
  const isFirebaseConfigured = Boolean(
    firebaseConfig && firebaseConfig.databaseURL && firebaseConfig.apiKey
  );

  // Local file preview URL for instant testing on PC
  const [localFileUrl, setLocalFileUrl] = useState('');

  // Active displayed URL
  const activeUrl = linkMode === 'short' && shortUrl ? shortUrl : rawShareUrl;

  // Shorten a generated raw URL
  const triggerShorten = useCallback(async (longUrl, force = false) => {
    if (!longUrl || !longUrl.startsWith('http')) return;
    const reqId = ++shortenReqIdRef.current;

    setIsShortening(true);
    setShortError(null);

    try {
      const res = await shortenUrl(longUrl, { forceRefresh: force });
      if (reqId === shortenReqIdRef.current) {
        if (res.success && res.shortUrl) {
          setShortUrl(res.shortUrl);
          setShortProvider(res.provider || 'spoo.me');
          setShortError(null);
        } else {
          setShortUrl(longUrl);
          setShortError(res.error || 'Shortening unavailable. Using full direct link.');
        }
      }
    } catch (e) {
      if (reqId === shortenReqIdRef.current) {
        setShortUrl(longUrl);
        setShortError(e.message || 'Failed to shorten URL');
      }
    } finally {
      if (reqId === shortenReqIdRef.current) {
        setIsShortening(false);
      }
    }
  }, []);

  // Generate share URL and trigger shortener when options change
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setError(null);
      setShowQr(false);
      return;
    }

    if (!isFirebaseConfigured) {
      setError('Firebase Realtime Database is not configured. Please add your credentials in Settings first.');
      setRawShareUrl('');
      setShortUrl('');
      return;
    }

    try {
      setError(null);
      const token = createShareToken({
        config: firebaseConfig,
        expiresInDays,
        pinCode: usePin ? pinCode : '',
      });

      const url = generateShareUrl(token, hostedDomain);
      setRawShareUrl(url);

      if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        setLocalFileUrl(`${window.location.href.split('?')[0]}?share=${token}`);
      } else {
        setLocalFileUrl('');
      }

      // Trigger URL shortener
      triggerShorten(url, false);
    } catch (err) {
      setError(err.message || 'Failed to generate share link.');
      setRawShareUrl('');
      setShortUrl('');
    }
  }, [isOpen, expiresInDays, usePin, pinCode, hostedDomain, isFirebaseConfigured, triggerShorten]);

  // Copy active link to clipboard
  const handleCopy = async () => {
    if (!activeUrl) return;
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback selection
      if (urlInputRef.current) {
        urlInputRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    }
  };

  // Open Preview in new tab
  const handleOpenPreview = () => {
    if (activeUrl) {
      window.open(activeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    if (!activeUrl) return;
    const msg = `View Reliable Jewellery - Gold Loss Live Ledger:\n${activeUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Save custom domain
  const handleSaveDomain = () => {
    const clean = domainInput.trim();
    if (!clean) return;
    setHostedBaseUrl(clean);
    setHostedDomain(clean);
    setDomainSaved(true);
    setTimeout(() => setDomainSaved(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight m-0">
                Share Live Ledger (Read-Only)
              </h2>
              <p className="text-[11px] text-blue-100 m-0">
                User-friendly short links with real-time sync
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
        <div className="p-5 sm:p-6 space-y-4 text-xs text-slate-600 overflow-y-auto flex-1">
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
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Recipient Permissions &amp; Security
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span><strong>Read-Only:</strong> Cannot edit</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span><strong>Live Sync:</strong> Real-time</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span><strong>Tamper-Proof:</strong> Signed</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span><strong>Short Link:</strong> Easy to share</span>
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
                      className={`py-1.5 px-2 rounded-lg font-medium text-center transition-all cursor-pointer ${
                        expiresInDays === opt.value
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
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
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 pr-9 font-mono text-slate-800 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
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
                      Viewer must enter this PIN
                    </span>
                  </div>
                )}
              </div>

              {/* Link Format Mode (Short Link vs Full Direct Link) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Shareable Link</span>
                  </label>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setLinkMode('short')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                        linkMode === 'short'
                          ? 'bg-white text-blue-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>Short Link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLinkMode('full')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        linkMode === 'full'
                          ? 'bg-white text-blue-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Full Link</span>
                    </button>
                  </div>
                </div>

                {/* Short URL Box */}
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={urlInputRef}
                        type="text"
                        readOnly
                        value={isShortening && linkMode === 'short' ? 'Generating short URL...' : activeUrl}
                        onClick={(e) => e.target.select()}
                        className={`w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg pl-3 pr-8 py-2.5 font-mono outline-none truncate select-all ${
                          isShortening && linkMode === 'short' ? 'text-slate-400 italic' : ''
                        }`}
                      />
                      {isShortening && linkMode === 'short' && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-600">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleCopy}
                      disabled={isShortening && linkMode === 'short'}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-bold transition-all shadow-xs shrink-0 cursor-pointer text-xs ${
                        copied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                      }`}
                    >
                      {copied ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* Status & Shortener Provider Info */}
                  <div className="flex items-center justify-between mt-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      {linkMode === 'short' && !isShortening && shortUrl && (
                        <span className="text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Shortened via {shortProvider || 'URL Shortener'}</span>
                        </span>
                      )}
                      {shortError && linkMode === 'short' && (
                        <span className="text-amber-700 text-[10px]">{shortError}</span>
                      )}
                    </div>

                    {linkMode === 'short' && (
                      <button
                        type="button"
                        onClick={() => triggerShorten(rawShareUrl, true)}
                        title="Re-shorten URL"
                        className="text-slate-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${isShortening ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Refresh short link</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Share Buttons (WhatsApp, QR Code, Preview) */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold transition-colors cursor-pointer text-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQr(!showQr)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border font-semibold transition-colors cursor-pointer text-xs ${
                      showQr
                        ? 'bg-purple-100 border-purple-300 text-purple-800'
                        : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5 text-purple-600" />
                    <span>QR Code</span>
                  </button>

                  {localFileUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => window.open(localFileUrl, '_blank')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold transition-colors cursor-pointer text-xs"
                        title="Test recipient view directly on this PC"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                        <span>Test Local Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenPreview}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold transition-colors cursor-pointer text-xs"
                        title="Open live web link"
                      >
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        <span>Open Web Link</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold transition-colors cursor-pointer text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                      <span>Test Preview</span>
                    </button>
                  )}
                </div>

                {/* QR Code Display Card */}
                {showQr && activeUrl && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center gap-2 animate-in fade-in">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                          activeUrl
                        )}`}
                        alt="Scan QR Code to open Ledger"
                        className="w-32 h-32 block"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Scan with any smartphone camera to view live ledger
                    </span>
                  </div>
                )}
              </div>

              {/* Advanced Hosted Domain Settings Toggle */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDomainSettings(!showDomainSettings)}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-medium text-[11px] cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hosted Target Web Domain:</span>
                  <span className="font-mono text-slate-700 truncate max-w-[200px]">
                    {hostedDomain}
                  </span>
                  <span className="text-blue-600 ml-auto font-semibold">
                    {showDomainSettings ? 'Hide' : 'Configure'}
                  </span>
                </button>

                {showDomainSettings && (
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in text-xs">
                    <p className="text-[11px] text-slate-500 m-0 leading-relaxed">
                      Short links redirect recipients to your live website. By default, this uses your
                      hosted GitHub Pages site (<strong>https://albin0004.github.io/Reliable-jewellery/gold loss/</strong>).
                      If you use another domain or Firebase Hosting, enter it here:
                    </p>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="url"
                        placeholder="https://albin0004.github.io/Reliable-jewellery/gold%20loss/"
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-800 outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveDomain}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        {domainSaved ? 'Saved!' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-5 sm:px-6 py-3 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            {expiresInDays > 0 ? `Valid for ${expiresInDays} day(s)` : 'Never expires'}
          </span>
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
