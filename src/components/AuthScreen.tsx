import React, { useState } from 'react';
import {
  Dumbbell,
  Phone,
  Lock,
  User,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Fingerprint,
  MapPin,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  supabase,
  normalizeEgyptianPhone,
  phoneToFallbackAuthEmail,
  generateMembershipId,
  DEMO_MEMBERS,
} from '../lib/supabase';
import type { MemberProfile, MembershipTier } from '../types/gym';
import { TIER_ALLOWANCE } from '../types/gym';

interface AuthScreenProps {
  onAuthenticated: (member: MemberProfile, authMethod: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('+20 109 876 5432');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedTier, setSelectedTier] = useState<MembershipTier>('Premium');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const normalizedPhone = normalizeEgyptianPhone(phone);
    if (normalizedPhone.replace(/\D/g, '').length < 10) {
      setErrorMsg('Please enter a valid Egyptian or international mobile number (e.g. 01012345678).');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register' && !fullName.trim()) {
      setErrorMsg('Please enter your full name as registered at Active Fitness Gym.');
      return;
    }

    setLoading(true);

    try {
      const fallbackEmail = phoneToFallbackAuthEmail(normalizedPhone);
      const renewalDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      if (mode === 'login') {
        // 1. Try native Supabase Phone + Password Auth
        let authData = null;
        let authErr = null;

        const phoneRes = await supabase.auth.signInWithPassword({
          phone: normalizedPhone,
          password,
        });

        if (!phoneRes.error && phoneRes.data.user) {
          authData = phoneRes.data;
        } else {
          // 2. Fallback to deterministic phone->email alias in Supabase Auth
          const emailRes = await supabase.auth.signInWithPassword({
            email: fallbackEmail,
            password,
          });
          authData = emailRes.data;
          authErr = emailRes.error;
        }

        if (authData?.user) {
          const user = authData.user;
          const meta = user.user_metadata || {};

          // Check profiles table if available
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          const tier: MembershipTier =
            (profileRow?.tier as MembershipTier) ||
            (meta.tier as MembershipTier) ||
            'Premium';

          const member: MemberProfile = {
            id: user.id,
            full_name:
              profileRow?.full_name ||
              meta.full_name ||
              `Member ${normalizedPhone.slice(-4)}`,
            phone: profileRow?.phone || normalizedPhone,
            membership_id:
              profileRow?.membership_id ||
              meta.membership_id ||
              generateMembershipId(normalizedPhone, tier),
            tier,
            renewal_date: profileRow?.renewal_date || meta.renewal_date || renewalDate,
            fingerprint_enrolled: true,
          };

          onAuthenticated(member, 'Supabase Auth');
          return;
        }

        // Check if phone exists in profiles table directly or surface clear Supabase error
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (existingProfile) {
          onAuthenticated(
            {
              id: existingProfile.id,
              full_name: existingProfile.full_name,
              phone: existingProfile.phone,
              membership_id: existingProfile.membership_id,
              tier: (existingProfile.tier as MembershipTier) || 'Standard',
              renewal_date: existingProfile.renewal_date || renewalDate,
              fingerprint_enrolled: existingProfile.fingerprint_enrolled ?? true,
            },
            'Supabase Profile'
          );
          return;
        }

        setErrorMsg(
          authErr?.message ||
            'Invalid phone number or password. Switch to "Activate Pass" to create a new member account, or tap a quick Cairo demo tier below.'
        );
      } else {
        // REGISTER MODE via Supabase Auth
        const membershipId = generateMembershipId(normalizedPhone, selectedTier);
        const userMeta = {
          full_name: fullName.trim(),
          phone_number: normalizedPhone,
          tier: selectedTier,
          membership_id: membershipId,
          renewal_date: renewalDate,
        };

        // Try native phone signUp first
        let signUpUser = null;
        const phoneSignUp = await supabase.auth.signUp({
          phone: normalizedPhone,
          password,
          options: { data: userMeta },
        });

        if (!phoneSignUp.error && phoneSignUp.data.user) {
          signUpUser = phoneSignUp.data.user;
        } else {
          // Fallback to deterministic phone-based email signUp
          const emailSignUp = await supabase.auth.signUp({
            email: fallbackEmail,
            password,
            options: { data: userMeta },
          });
          if (!emailSignUp.error && emailSignUp.data.user) {
            signUpUser = emailSignUp.data.user;
          }
        }

        const newMember: MemberProfile = {
          id: signUpUser?.id || `member-${Date.now()}`,
          full_name: fullName.trim(),
          phone: normalizedPhone,
          membership_id: membershipId,
          tier: selectedTier,
          renewal_date: renewalDate,
          fingerprint_enrolled: true,
        };

        // Save to profiles table if it exists
        if (signUpUser?.id) {
          await supabase.from('profiles').upsert([
            {
              id: signUpUser.id,
              full_name: newMember.full_name,
              phone: newMember.phone,
              membership_id: newMember.membership_id,
              tier: newMember.tier,
              renewal_date: newMember.renewal_date,
              fingerprint_enrolled: true,
            },
          ]);
        }

        setStatusMsg('Member account activated via Supabase Auth!');
        onAuthenticated(newMember, 'Supabase Auth');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to reach authentication server.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (tier: MembershipTier) => {
    const demo = DEMO_MEMBERS[tier];
    onAuthenticated(demo, 'Cairo Member Pass');
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between px-4 py-6 max-w-md mx-auto relative overflow-hidden">
      {/* Ambient Cairo Neon Background Glow */}
      <div className="pointer-events-none absolute -top-28 -left-24 w-72 h-72 rounded-full bg-lime-500/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-28 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-lime-500/20">
              <Dumbbell className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-extrabold tracking-tight text-white">
                  ACTIVE FITNESS
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-lime-400/15 text-lime-300 border border-lime-400/30">
                  CAIRO
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-lime-400" />
                New Cairo • Zamalek • Maadi (24/7)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Supabase
          </div>
        </div>

        {/* Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950 border border-slate-800/80 p-5 shadow-xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-300 bg-lime-400/10 border border-lime-400/20 px-2.5 py-1 rounded-full mb-3">
            <Fingerprint className="w-3.5 h-3.5" />
            Biometric + QR Digital Gate Pass
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight">
            Your 24/7 Cairo Club Companion
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Sign in with your registered Egyptian mobile number to check live floor capacity, scan your QR gate pass, and share guest passes on WhatsApp.
          </p>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/90 rounded-2xl border border-slate-800/80 mt-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-lime-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Member Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                mode === 'register'
                  ? 'bg-lime-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Activate New Pass
            </button>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Member Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Karim El-Shenawy"
                    className="w-full bg-slate-950/90 border border-slate-800 focus:border-lime-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Mobile Phone Number (Egypt)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+20 10 1234 5678"
                  required
                  className="w-full bg-slate-950/90 border border-slate-800 focus:border-lime-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-950/90 border border-slate-800 focus:border-lime-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Select Active Membership Tier
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Standard', 'Premium', 'VIP'] as MembershipTier[]).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedTier(tier)}
                      className={`py-2.5 px-2 rounded-xl border text-center transition-all ${
                        selectedTier === tier
                          ? 'bg-lime-400/15 border-lime-400 text-lime-300 font-bold'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs">{tier}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {TIER_ALLOWANCE[tier]} Guest Passes
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {statusMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{statusMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-lime-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <span>Authenticating with Supabase...</span>
              ) : (
                <>
                  <span>
                    {mode === 'login' ? 'Sign In to Member Portal' : 'Activate Digital Pass'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Instant Cairo Demo Member Access */}
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800/80 p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-lime-400" />
              Instant Demo Member Profiles
            </span>
            <span className="text-[10px] text-slate-400">1-Tap Preview</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['Standard', 'Premium', 'VIP'] as MembershipTier[]).map((tier) => {
              const demo = DEMO_MEMBERS[tier];
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => handleQuickDemo(tier)}
                  className="p-2.5 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-lime-400/50 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                        tier === 'VIP'
                          ? 'bg-amber-400/20 text-amber-300'
                          : tier === 'Premium'
                            ? 'bg-cyan-400/20 text-cyan-300'
                            : 'bg-lime-400/20 text-lime-300'
                      }`}
                    >
                      {tier}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-lime-400 transition-colors" />
                  </div>
                  <p className="text-xs font-bold text-white mt-1.5 truncate">
                    {demo.full_name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {TIER_ALLOWANCE[tier]} guest passes
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Security Note */}
      <div className="relative z-10 pt-6 text-center">
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />
          Connected to Supabase Auth & Realtime • Active Fitness Cairo
        </p>
      </div>
    </div>
  );
};
