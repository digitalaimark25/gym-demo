import React, { useState } from 'react';
import {
  Activity,
  Clock,
  Users,
  RefreshCw,
  QrCode,
  Ticket,
  Flame,
  Sliders,
  MapPin,
  Wifi,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Fingerprint,
} from 'lucide-react';
import type { GymStatus, MemberProfile } from '../types/gym';
import { getOccupancyInfo, TIER_ALLOWANCE } from '../types/gym';
import { updateGymStatusLive } from '../lib/supabase';

interface HomeDashboardProps {
  member: MemberProfile;
  gymStatus: GymStatus;
  fromSupabase: boolean;
  usedPassesCount: number;
  onRefreshStatus: () => Promise<void>;
  onStatusUpdated: (next: GymStatus) => void;
  onNavigateTab: (tab: 'home' | 'pass' | 'guests') => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  member,
  gymStatus,
  fromSupabase,
  usedPassesCount,
  onRefreshStatus,
  onStatusUpdated,
  onNavigateTab,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [updatingSim, setUpdatingSim] = useState(false);

  const occupancy = getOccupancyInfo(
    gymStatus.current_capacity,
    gymStatus.max_capacity
  );

  const totalAllowance = TIER_ALLOWANCE[member.tier];
  const remainingPasses = Math.max(0, totalAllowance - usedPassesCount);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await onRefreshStatus();
    setTimeout(() => setRefreshing(false), 350);
  };

  const handlePresetCapacity = async (targetCapacity: number) => {
    setUpdatingSim(true);
    const clamped = Math.max(0, Math.min(gymStatus.max_capacity, targetCapacity));
    const { status } = await updateGymStatusLive(gymStatus, {
      current_capacity: clamped,
    });
    onStatusUpdated(status);
    setUpdatingSim(false);
  };

  const handleToggleOpenStatus = async () => {
    setUpdatingSim(true);
    const { status } = await updateGymStatusLive(gymStatus, {
      is_open: !gymStatus.is_open,
    });
    onStatusUpdated(status);
    setUpdatingSim(false);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Member Greeting & Quick Tier Pill */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xs text-slate-400">Ahlan, Cairo Member</p>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {member.full_name}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('pass')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-lime-400/40 transition-colors cursor-pointer"
        >
          <Fingerprint className="w-4 h-4 text-lime-400" />
          <span className="text-xs font-bold text-slate-200">{member.tier}</span>
        </button>
      </div>

      {/* PROMINENT STATUS BANNER (Open / Closed + 24/7 Operating Hours) */}
      <div
        className={`relative overflow-hidden rounded-3xl border p-5 shadow-xl transition-all ${
          gymStatus.is_open
            ? 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/40 shadow-emerald-500/10'
            : 'bg-gradient-to-br from-rose-950/80 via-slate-900 to-slate-950 border-rose-500/40 shadow-rose-500/10'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border bg-slate-950/70 border-white/10">
              {gymStatus.is_open ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 relative" />
                  <span className="text-emerald-300">GYM IS OPEN</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="text-rose-300">TEMPORARILY CLOSED</span>
                </>
              )}
            </div>

            <h3 className="text-lg font-extrabold text-white pt-1 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-lime-400 shrink-0" />
              <span>{gymStatus.branch_name}</span>
            </h3>
          </div>

          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-bold text-lime-300">
              <Clock className="w-3.5 h-3.5 text-lime-400" />
              <span>24/7 HOURS</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">
              {gymStatus.operating_hours || 'Open 24/7 • All Week'}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            {gymStatus.is_open ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
            {gymStatus.is_open
              ? 'All gates, free weights & cardio zones active 24/7'
              : 'Maintenance window in progress — reopens shortly'}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">Cairo EET</span>
        </div>
      </div>

      {/* REAL-TIME OCCUPANCY METER (Pulling from gym_status table) */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800/90 p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-lime-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">
                  Live Occupancy Meter
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                  <Wifi className="w-2.5 h-2.5 text-lime-400" />
                  {fromSupabase ? 'gym_status live' : 'gym_status'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Real-time floor capacity from turnstile & biometric sensors
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            title="Refresh from gym_status table"
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-lime-400' : ''}`} />
          </button>
        </div>

        {/* Big Occupancy Readout */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Current vs Max Capacity
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-4xl font-black text-white tracking-tight">
                  {gymStatus.current_capacity}
                </span>
                <span className="text-lg font-bold text-slate-500">
                  / {gymStatus.max_capacity}
                </span>
                <span className="text-xs font-semibold text-slate-400 ml-1">
                  members ({occupancy.percentage}%)
                </span>
              </div>
            </div>

            {/* Quiet / Moderate / Busy Status Badge */}
            <div
              className={`px-3.5 py-1.5 rounded-2xl border text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${occupancy.badgeClass}`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{occupancy.label}</span>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-3.5 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${occupancy.barClass} transition-all duration-500`}
                style={{ width: `${Math.max(4, occupancy.percentage)}%` }}
              />
            </div>

            {/* 3 Zone Labels: Quiet / Moderate / Busy */}
            <div className="grid grid-cols-3 text-[10px] font-bold pt-1">
              <div
                className={`flex items-center gap-1 ${
                  occupancy.level === 'Quiet' ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Quiet (0–44%)
              </div>
              <div
                className={`flex items-center justify-center gap-1 ${
                  occupancy.level === 'Moderate' ? 'text-amber-400' : 'text-slate-500'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Moderate (45–75%)
              </div>
              <div
                className={`flex items-center justify-end gap-1 ${
                  occupancy.level === 'Busy' ? 'text-rose-400' : 'text-slate-500'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Busy (76%+)
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300 pt-1 border-t border-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{occupancy.sublabel}</span>
          </p>
        </div>

        {/* Live Supabase Table Tester / Simulator Drawer */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowSimulator((s) => !s)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <Sliders className="w-3.5 h-3.5 text-lime-400" />
              Test Live `gym_status` Updates (Quiet / Moderate / Busy)
            </span>
            <span className="text-[10px] text-lime-400 font-bold">
              {showSimulator ? 'Hide' : 'Configure'}
            </span>
          </button>

          {showSimulator && (
            <div className="mt-2.5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Simulate `gym_status` table row update:</span>
                {updatingSim && (
                  <span className="text-lime-400 font-semibold">Syncing to Supabase...</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handlePresetCapacity(Math.round(gymStatus.max_capacity * 0.28))}
                  className="py-2 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold cursor-pointer"
                >
                  Quiet (34)
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetCapacity(Math.round(gymStatus.max_capacity * 0.58))}
                  className="py-2 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold cursor-pointer"
                >
                  Moderate (70)
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetCapacity(Math.round(gymStatus.max_capacity * 0.88))}
                  className="py-2 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold cursor-pointer"
                >
                  Busy (106)
                </button>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                <span className="text-xs text-slate-400">Gym Gate Status:</span>
                <button
                  type="button"
                  onClick={handleToggleOpenStatus}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-white cursor-pointer"
                >
                  Toggle {gymStatus.is_open ? 'Closed' : 'Open'} Banner
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Cards -> Digital Pass & Guest Passes */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNavigateTab('pass')}
          className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-lime-400/50 text-left transition-all group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-lime-400/15 border border-lime-400/30 flex items-center justify-center mb-3">
            <QrCode className="w-5 h-5 text-lime-400" />
          </div>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-white">Digital QR Pass</h4>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-lime-400 transition-colors" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            ID: {member.membership_id.slice(0, 12)}...
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('guests')}
          className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-cyan-400/50 text-left transition-all group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center mb-3">
            <Ticket className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-white">Guest Pass Hub</h4>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {remainingPasses} of {totalAllowance} passes left
          </p>
        </button>
      </div>
    </div>
  );
};
