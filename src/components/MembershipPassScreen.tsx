import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Fingerprint,
  Calendar,
  Award,
  Copy,
  Check,
  Maximize2,
  X,
  ShieldCheck,
  Sparkles,
  Sun,
  Phone,
} from 'lucide-react';
import type { MemberProfile, MembershipTier } from '../types/gym';
import { TIER_DETAILS } from '../types/gym';
import { generateMembershipId } from '../lib/supabase';

interface MembershipPassScreenProps {
  member: MemberProfile;
  onTierChange: (newTier: MembershipTier) => void;
}

export const MembershipPassScreen: React.FC<MembershipPassScreenProps> = ({
  member,
  onTierChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [fullscreenQr, setFullscreenQr] = useState(false);

  const tierStyle = TIER_DETAILS[member.tier];

  const formattedRenewal = (() => {
    try {
      const d = new Date(member.renewal_date);
      if (isNaN(d.getTime())) return member.renewal_date;
      return d.toLocaleDateString('en-EG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return member.renewal_date;
    }
  })();

  const handleCopyId = () => {
    navigator.clipboard.writeText(member.membership_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xs text-slate-400">Turnstile & Biometric Backup</p>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Membership & Digital Pass
          </h2>
        </div>
        <span
          className={`px-3 py-1 rounded-full border text-xs font-extrabold uppercase tracking-wider ${tierStyle.badgeBg} ${tierStyle.badgeText}`}
        >
          {member.tier} Tier
        </span>
      </div>

      {/* DIGITAL MEMBERSHIP PASS CARD */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${tierStyle.cardGradient} border ${tierStyle.borderAccent} p-5 shadow-2xl ${tierStyle.glowColor}`}
      >
        {/* Top Row: Club Branding + Active Tier Badge */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-widest uppercase text-lime-400">
                ACTIVE FITNESS GYM
              </span>
              <span className="text-[10px] text-slate-400">• CAIRO</span>
            </div>
            <h3 className="text-xl font-extrabold text-white mt-1">
              {member.full_name}
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-slate-500" />
              {member.phone}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              Active Tier
            </span>
            <span
              className={`inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded-xl border text-xs font-extrabold ${tierStyle.badgeBg} ${tierStyle.badgeText}`}
            >
              <Award className="w-3.5 h-3.5" />
              {member.tier}
            </span>
          </div>
        </div>

        {/* Center Scannable QR Code Section */}
        <div className="my-5 flex flex-col items-center">
          <div className="relative p-4 rounded-3xl bg-white shadow-xl border-4 border-lime-400/80">
            {/* Animated Scanner Line */}
            <div className="pointer-events-none absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-lime-500 to-transparent shadow-[0_0_8px_#84cc16] animate-scanline" />

            <QRCodeSVG
              value={member.membership_id}
              size={188}
              level="H"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#090d16"
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-lime-400/50 text-xs font-mono font-bold text-slate-200 transition-colors cursor-pointer"
            >
              <span>{member.membership_id}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setFullscreenQr(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-lime-400/15 hover:bg-lime-400/25 border border-lime-400/30 text-xs font-bold text-lime-300 transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Gate Scan</span>
            </button>
          </div>
        </div>

        {/* Metadata Grid: Renewal Date & Fingerprint Sync */}
        <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-white/10">
          <div className="p-3 rounded-2xl bg-slate-950/75 border border-white/5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-lime-400" />
              <span>Renewal Date</span>
            </div>
            <p className="text-sm font-extrabold text-white mt-1">
              {formattedRenewal}
            </p>
            <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
              Status: Active & Paid
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/75 border border-white/5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
              <span>Biometric Entry</span>
            </div>
            <p className="text-sm font-extrabold text-white mt-1">
              Fingerprint + QR
            </p>
            <p className="text-[10px] text-cyan-300 font-medium mt-0.5">
              Dual-Gate Synced
            </p>
          </div>
        </div>
      </div>

      {/* Biometric + QR Complement Explanation Card */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center shrink-0 mt-0.5">
          <Fingerprint className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold text-white">
            Complements Your Fingerprint Gate Access
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Scan this QR code at any Active Fitness Cairo optical turnstile whenever your hands are chalked, wrapped, or wet after swimming/sauna.
          </p>
        </div>
      </div>

      {/* Active Tier Perks & Instant Tier Switcher */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-lime-400" />
            {member.tier} Tier Privileges
          </h4>
          <span className="text-[11px] font-bold text-lime-400">
            {tierStyle.allowance} Guest Passes / mo
          </span>
        </div>

        <ul className="space-y-1.5">
          {tierStyle.perks.map((perk) => (
            <li
              key={perk}
              className="text-xs text-slate-300 flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-lime-400 shrink-0" />
              <span>{perk}</span>
            </li>
          ))}
        </ul>

        {/* Switch Tier for Testing */}
        <div className="pt-3 border-t border-slate-800">
          <p className="text-[11px] text-slate-400 mb-2 font-medium">
            Preview Membership Tier & Guest Pass Quota:
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['Standard', 'Premium', 'VIP'] as MembershipTier[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTierChange(t)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  member.tier === t
                    ? 'bg-lime-400 text-slate-950 border-lime-400 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {t} ({TIER_DETAILS[t].allowance})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* High-Brightness Turnstile Scanner Modal */}
      {fullscreenQr && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white text-slate-950 p-6 text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                <Sun className="w-3.5 h-3.5" />
                High-Brightness Gate Mode
              </span>
              <button
                type="button"
                onClick={() => setFullscreenQr(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-950">
                {member.full_name}
              </h3>
              <p className="text-xs font-bold text-slate-500">
                {member.tier} Member • Renewal: {formattedRenewal}
              </p>
            </div>

            <div className="flex justify-center py-2">
              <QRCodeSVG
                value={member.membership_id}
                size={240}
                level="H"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            <p className="font-mono text-sm font-black tracking-wider bg-slate-100 py-2 rounded-xl text-slate-900">
              {member.membership_id}
            </p>
            <p className="text-[11px] text-slate-500">
              Hold 10–15 cm from the Active Fitness Cairo optical reader
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export { generateMembershipId };
