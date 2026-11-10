import React, { useState } from 'react';
import {
  Ticket,
  UserPlus,
  Phone,
  User,
  MessageCircle,
  MessageSquare,
  Copy,
  Check,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Send,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { GuestPass, MemberProfile, MembershipTier } from '../types/gym';
import { TIER_ALLOWANCE } from '../types/gym';
import { createGuestPassRecord, normalizeEgyptianPhone } from '../lib/supabase';

interface GuestPassHubProps {
  member: MemberProfile;
  passes: GuestPass[];
  fromSupabase: boolean;
  onPassCreated: (newPass: GuestPass, savedToSupabase: boolean) => void;
  onTierChange: (newTier: MembershipTier) => void;
}

export const GuestPassHub: React.FC<GuestPassHubProps> = ({
  member,
  passes,
  fromSupabase,
  onPassCreated,
  onTierChange,
}) => {
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [latestPass, setLatestPass] = useState<GuestPass | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const maxAllowance = TIER_ALLOWANCE[member.tier];
  const usedCount = passes.length;
  const remainingCount = Math.max(0, maxAllowance - usedCount);

  const buildShareMessage = (pass: GuestPass) => {
    const expiryDate = new Date(pass.expires_at).toLocaleDateString('en-EG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return (
      `🏋️ *ACTIVE FITNESS GYM CAIRO — VIP GUEST PASS*\n\n` +
      `Hi ${pass.guest_name}! ${member.full_name} (${member.tier} Member) invited you for a complimentary workout session at Active Fitness Gym Cairo (Open 24/7).\n\n` +
      `🔑 *Unique Pass Code:* ${pass.pass_code}\n` +
      `📅 *Valid Until:* ${expiryDate}\n` +
      `📍 *Entry:* Present this code + ID at the reception gate.`
    );
  };

  const getWhatsAppUrl = (pass: GuestPass) => {
    const cleanDigits = normalizeEgyptianPhone(pass.guest_phone).replace(/\D/g, '');
    const text = encodeURIComponent(buildShareMessage(pass));
    return `https://wa.me/${cleanDigits}?text=${text}`;
  };

  const getSmsUrl = (pass: GuestPass) => {
    const normalized = normalizeEgyptianPhone(pass.guest_phone);
    const body = encodeURIComponent(
      `Active Fitness Gym Cairo Guest Pass from ${member.full_name}! Your Unique Pass Code: ${pass.pass_code}. Present at the 24/7 reception gate.`
    );
    return `sms:${normalized}?body=${body}`;
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const handleGeneratePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSyncNotice(null);

    if (remainingCount <= 0) {
      setErrorMsg(
        `You have used all ${maxAllowance} guest passes for your ${member.tier} tier. Upgrade tier to unlock more passes.`
      );
      return;
    }

    if (!guestName.trim() || guestName.trim().length < 2) {
      setErrorMsg("Please enter the guest's full name.");
      return;
    }

    const normalizedPhone = normalizeEgyptianPhone(guestPhone);
    if (normalizedPhone.replace(/\D/g, '').length < 10) {
      setErrorMsg(
        'Please enter a valid Egyptian or international mobile number (e.g. 01012345678).'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await createGuestPassRecord({
        member,
        guestName: guestName.trim(),
        guestPhone: normalizedPhone,
      });

      setLatestPass(result.pass);
      onPassCreated(result.pass, result.savedToSupabase);
      setGuestName('');
      setGuestPhone('');
      setSyncNotice(
        result.savedToSupabase
          ? `Pass ${result.pass.pass_code} saved to Supabase guest_passes table!`
          : `Pass ${result.pass.pass_code} generated & ready to share!`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to generate guest pass.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xs text-slate-400">Bring a Training Partner</p>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Tiered Guest Pass Hub
          </h2>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-lime-400">
          {fromSupabase ? 'guest_passes live' : 'guest_passes'}
        </span>
      </div>

      {/* TIER ALLOWANCE BANNER (Standard = 2, Premium = 4, VIP = 6) */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-5 shadow-xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-lime-400">
              {member.tier} Tier Allowance
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-white">
                {remainingCount}
              </span>
              <span className="text-sm font-bold text-slate-400">
                of {maxAllowance} Passes Available
              </span>
            </div>
          </div>

          <div className="w-11 h-11 rounded-2xl bg-lime-400/15 border border-lime-400/30 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-lime-400" />
          </div>
        </div>

        {/* Visual Quota Slots */}
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6 }).map((_, idx) => {
            const isUnlockedForTier = idx < maxAllowance;
            const isUsed = idx < usedCount;
            return (
              <div
                key={idx}
                className={`h-2.5 rounded-full transition-all ${
                  !isUnlockedForTier
                    ? 'bg-slate-900 border border-slate-800/80 opacity-40'
                    : isUsed
                      ? 'bg-slate-600'
                      : 'bg-gradient-to-r from-lime-400 to-emerald-400 shadow-sm shadow-lime-500/30'
                }`}
              />
            );
          })}
        </div>

        {/* Tier Allowance Breakdown Pills (Standard = 2, Premium = 4, VIP = 6) */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {(['Standard', 'Premium', 'VIP'] as MembershipTier[]).map((tier) => {
            const isCurrent = member.tier === tier;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => onTierChange(tier)}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-lime-400/15 border-lime-400 text-white'
                    : 'bg-slate-950/70 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold">{tier}</span>
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-lime-400" />
                  )}
                </div>
                <p className="text-[11px] font-bold text-lime-300 mt-0.5">
                  {TIER_ALLOWANCE[tier]} Passes
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* GENERATE NEW GUEST PASS FORM */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white">
              Generate Guest Pass Code
            </h3>
            <p className="text-[11px] text-slate-400">
              Saves directly to `guest_passes` with instant WhatsApp / SMS invite
            </p>
          </div>
        </div>

        <form onSubmit={handleGeneratePass} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Guest Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Tarek Abdelaziz"
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-lime-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Guest Mobile Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+20 10 1234 5678"
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-lime-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {syncNotice && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{syncNotice}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || remainingCount <= 0}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-lime-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {submitting
                ? 'Generating & Saving Pass...'
                : remainingCount > 0
                  ? `Generate Guest Pass (${remainingCount} Left)`
                  : 'Tier Pass Limit Reached'}
            </span>
          </button>
        </form>
      </div>

      {/* NEWLY GENERATED PASS SPOTLIGHT WITH INSTANT WHATSAPP / SMS SHARING */}
      {latestPass && (
        <div className="rounded-3xl bg-gradient-to-br from-emerald-950/90 via-slate-900 to-slate-950 border-2 border-lime-400/60 p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-lime-400/20 text-lime-300 border border-lime-400/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ready to Share
            </span>
            <span className="text-xs text-slate-400">Valid 7 Days</span>
          </div>

          <div className="flex items-center justify-between gap-4 bg-slate-950/90 p-4 rounded-2xl border border-slate-800">
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Guest Pass For</p>
              <h4 className="text-base font-extrabold text-white">
                {latestPass.guest_name}
              </h4>
              <p className="text-xs text-slate-400">{latestPass.guest_phone}</p>
              <div className="pt-1 flex items-center gap-2">
                <span className="font-mono text-lg font-black text-lime-400 tracking-wider">
                  {latestPass.pass_code}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(latestPass.pass_code)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  {copiedCode === latestPass.pass_code ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-white shrink-0">
              <QRCodeSVG value={latestPass.pass_code} size={72} level="M" />
            </div>
          </div>

          {/* Instant WhatsApp & SMS Share Triggers */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={getWhatsAppUrl(latestPass)}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-slate-950" />
              <span>Share on WhatsApp</span>
            </a>

            <a
              href={getSmsUrl(latestPass)}
              className="py-3 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-400/20 transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send via SMS</span>
            </a>
          </div>
        </div>
      )}

      {/* ISSUED GUEST PASSES LIST (From guest_passes table) */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-lime-400" />
            Issued Guest Passes ({passes.length})
          </h3>
          <span className="text-[11px] text-slate-400">
            {remainingCount} remaining
          </span>
        </div>

        {passes.length === 0 ? (
          <div className="text-center py-6 px-4 rounded-2xl bg-slate-950/60 border border-slate-800/70">
            <Ticket className="w-7 h-7 text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-300">
              No guest passes generated yet
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Enter your friend&apos;s name and Egyptian mobile number above to generate a pass code.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {passes.map((pass) => (
              <div
                key={pass.id}
                className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/90 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">
                        {pass.guest_name}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {pass.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {pass.guest_phone}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyCode(pass.pass_code)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-lime-400/40 font-mono text-xs font-extrabold text-lime-400 cursor-pointer"
                  >
                    <span>{pass.pass_code}</span>
                    {copiedCode === pass.pass_code ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                  <a
                    href={getWhatsAppUrl(pass)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href={getSmsUrl(pass)}
                    className="flex-1 py-2 px-3 rounded-xl bg-cyan-400/15 hover:bg-cyan-400/25 border border-cyan-400/40 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>SMS</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
