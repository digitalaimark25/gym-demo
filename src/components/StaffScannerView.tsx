import { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  Keyboard,
  Clock,
  RotateCcw,
  Sparkles,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import CounterScanner, { type ScanVerificationResult } from './CounterScanner';
import { supabase, DEMO_MEMBERS } from '../lib/supabase';

interface StaffScannerViewProps {
  onClose?: () => void;
}

interface ScanHistoryItem extends ScanVerificationResult {
  id: string;
  timestamp: string;
}

export function StaffScannerView({ onClose }: StaffScannerViewProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [verifyingManual, setVerifyingManual] = useState(false);
  const [currentResult, setCurrentResult] = useState<ScanVerificationResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sound effect via Web Audio API synth
  const playFeedbackTone = (success: boolean) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (success) {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(220.00, audioCtx.currentTime); // A3
        osc.frequency.setValueAtTime(164.81, audioCtx.currentTime + 0.12); // E3
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // AudioContext not allowed without gesture or unsupported
    }
  };

  const handleScanSuccess = (result: ScanVerificationResult) => {
    setCurrentResult(result);
    playFeedbackTone(result.valid);

    // Add to history
    const historyItem: ScanHistoryItem = {
      ...result,
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setHistory((prev) => [historyItem, ...prev.slice(0, 9)]);
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setVerifyingManual(true);
    const cleanText = manualCode.trim();

    try {
      // Check profiles table by id, membership_id, or phone
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .or(`id.eq.${cleanText},membership_id.eq.${cleanText},phone.eq.${cleanText}`)
        .maybeSingle();

      if (profile) {
        const renewal = profile.renewal_date ? new Date(profile.renewal_date) : null;
        const isExpired = renewal ? renewal.getTime() < Date.now() : false;
        const tier = profile.membership_tier || profile.tier || 'Standard';

        if (isExpired) {
          handleScanSuccess({
            valid: false,
            type: 'member',
            isExpired: true,
            statusBadge: 'Pass Expired',
            member: profile,
            message: `Membership expired on ${profile.renewal_date}`,
            decodedText: cleanText,
          });
        } else {
          handleScanSuccess({
            valid: true,
            type: 'member',
            statusBadge: `Access Granted - Active Member (${tier})`,
            member: profile,
            decodedText: cleanText,
          });
        }
        setManualCode('');
        return;
      }

      // Check guest_passes table
      const { data: guestPass } = await supabase
        .from('guest_passes')
        .select('*')
        .or(`pass_code.eq.${cleanText},id.eq.${cleanText}`)
        .maybeSingle();

      if (guestPass) {
        const expires = guestPass.expires_at ? new Date(guestPass.expires_at) : null;
        const isExpired = expires ? expires.getTime() < Date.now() : false;

        if (isExpired || guestPass.status === 'Expired') {
          handleScanSuccess({
            valid: false,
            type: 'guest',
            isExpired: true,
            statusBadge: 'Pass Expired',
            guestPass,
            message: `Guest pass expired for ${guestPass.guest_name}`,
            decodedText: cleanText,
          });
        } else {
          handleScanSuccess({
            valid: true,
            type: 'guest',
            statusBadge: `Access Granted - Guest Pass (${guestPass.guest_name})`,
            guestPass,
            decodedText: cleanText,
          });
        }
        setManualCode('');
        return;
      }

      // Demo fallback check
      const demoMatch = Object.values(DEMO_MEMBERS).find(
        (m) => m.id === cleanText || m.membership_id === cleanText || m.phone === cleanText
      );

      if (demoMatch) {
        handleScanSuccess({
          valid: true,
          type: 'member',
          statusBadge: `Access Granted - Active Member (${demoMatch.tier})`,
          member: demoMatch,
          decodedText: cleanText,
        });
        setManualCode('');
        return;
      }

      handleScanSuccess({
        valid: false,
        type: 'error',
        statusBadge: 'Access Denied',
        message: 'Unrecognized QR code or Pass ID',
        decodedText: cleanText,
      });
      setManualCode('');
    } catch (err) {
      handleScanSuccess({
        valid: false,
        type: 'error',
        statusBadge: 'Verification Error',
        message: err instanceof Error ? err.message : 'Database query failed',
        decodedText: cleanText,
      });
    } finally {
      setVerifyingManual(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Front-Desk Staff Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
              STAFF SCANNER
            </span>
            <span className="text-[10px] text-slate-400">• Optical Reception Gate</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mt-0.5">
            Front-Desk Turnstile Verification
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title={soundEnabled ? 'Mute Beeper' : 'Enable Beeper'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-lime-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher: Camera / Manual Entry */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === 'camera'
              ? 'bg-lime-400 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Camera Optical Reader</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === 'manual'
              ? 'bg-lime-400 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>Manual Code Lookup</span>
        </button>
      </div>

      {/* LIVE SCANNER RESULT POPUP BANNER */}
      {currentResult && (
        <div
          className={`relative overflow-hidden rounded-3xl border-2 p-5 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200 ${
            currentResult.valid
              ? 'bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 border-emerald-400 shadow-emerald-500/20'
              : 'bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 border-rose-500 shadow-rose-500/20'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  currentResult.valid
                    ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30'
                    : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                }`}
              >
                {currentResult.valid ? (
                  <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                ) : (
                  <XCircle className="w-7 h-7 stroke-[2.5]" />
                )}
              </div>

              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider mb-1 ${
                    currentResult.valid
                      ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {currentResult.statusBadge || (currentResult.valid ? 'Access Granted' : 'Access Denied')}
                </span>

                <h3 className="text-lg font-black text-white">
                  {currentResult.member?.full_name ||
                    currentResult.guestPass?.guest_name ||
                    (currentResult.valid ? 'Verified Member' : 'Entry Rejected')}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentResult(null)}
              className="p-1 rounded-lg bg-slate-900/80 text-slate-400 hover:text-white"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Detailed Verification Info */}
          <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
            {currentResult.member && (
              <>
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Tier & ID</span>
                  <p className="font-bold text-white mt-0.5">
                    {currentResult.member.membership_tier || currentResult.member.tier || 'Standard'} Member
                  </p>
                  <p className="text-[10px] font-mono text-lime-400 truncate mt-0.5">
                    {currentResult.member.membership_id || currentResult.member.id}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Renewal Status</span>
                  <p
                    className={`font-bold mt-0.5 ${
                      currentResult.isExpired ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {currentResult.isExpired ? 'EXPIRED' : 'ACTIVE & PAID'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {currentResult.member.renewal_date || 'Current Session'}
                  </p>
                </div>
              </>
            )}

            {currentResult.guestPass && (
              <>
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Guest Phone</span>
                  <p className="font-bold text-white mt-0.5">
                    {currentResult.guestPass.guest_phone || 'N/A'}
                  </p>
                  <p className="text-[10px] font-mono text-cyan-400 truncate mt-0.5">
                    Code: {currentResult.guestPass.pass_code}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Pass Status</span>
                  <p
                    className={`font-bold mt-0.5 ${
                      currentResult.valid ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {currentResult.guestPass.status || 'Active'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Host: {currentResult.guestPass.member_name || 'Member Invite'}
                  </p>
                </div>
              </>
            )}

            {!currentResult.member && !currentResult.guestPass && (
              <div className="col-span-2 p-2.5 rounded-xl bg-slate-950/70 border border-rose-500/20 text-rose-300">
                <span className="text-[10px] uppercase font-bold text-rose-400">Error Details:</span>
                <p className="mt-0.5">{currentResult.message || 'QR code payload could not be verified in Supabase.'}</p>
                {currentResult.decodedText && (
                  <p className="font-mono text-[10px] text-slate-400 mt-1 truncate">
                    Payload: {currentResult.decodedText}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Scanner Screen Container */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 shadow-xl">
        {activeTab === 'camera' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <Camera className="w-3.5 h-3.5 text-lime-400" />
                Point camera at member phone or guest pass QR
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-lime-400 font-mono">
                10 FPS
              </span>
            </div>

            {/* Html5QrcodeScanner Component */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 p-2">
              <CounterScanner onScanSuccess={handleScanSuccess} />
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Works with both member membership IDs (`profiles`) and guest codes (`guest_passes`).
            </p>
          </div>
        ) : (
          /* Manual Input Mode */
          <form onSubmit={handleManualVerify} className="space-y-3.5 py-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Enter Membership ID, UUID, Phone, or Guest Pass Code
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. AFG-PRM-CAI-8195432 or AFG-W7K9P"
                className="w-full bg-slate-950 border border-slate-800 focus:border-lime-400 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={verifyingManual || !manualCode.trim()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-lime-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>{verifyingManual ? 'Verifying with Supabase...' : 'Verify Pass in Supabase'}</span>
            </button>

            {/* Quick Demo Test Buttons */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-medium block mb-2">
                Quick Test Codes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(DEMO_MEMBERS).map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => {
                      setManualCode(demo.membership_id);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-lime-400/50 text-[10px] font-mono text-slate-300"
                  >
                    {demo.tier} ({demo.full_name.split(' ')[0]})
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}
      </div>

      {/* RECENT SCANS LOG */}
      {history.length > 0 && (
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-lime-400" />
              Recent Turnstile Gate Scans ({history.length})
            </span>
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Clear Log
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  {item.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold text-white truncate max-w-[190px]">
                      {item.member?.full_name || item.guestPass?.guest_name || item.decodedText}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {item.statusBadge || item.message}
                    </p>
                  </div>
                </div>

                <span className="font-mono text-[10px] text-slate-500 shrink-0">
                  {item.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
