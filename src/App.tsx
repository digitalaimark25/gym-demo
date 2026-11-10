import React, { useEffect, useState, useCallback } from 'react';
import {
  Dumbbell,
  Home,
  QrCode,
  Ticket,
  LogOut,
  Wifi,
  Camera,
  ShieldCheck,
} from 'lucide-react';
import {
  supabase,
  DEFAULT_GYM_STATUS,
  fetchGymStatus,
  fetchMemberGuestPasses,
  generateMembershipId,
  loadActiveMemberLocal,
  saveActiveMemberLocal,
} from './lib/supabase';
import type {
  GuestPass,
  GymStatus,
  MemberProfile,
  MembershipTier,
} from './types/gym';
import { TIER_ALLOWANCE } from './types/gym';
import { AuthScreen } from './components/AuthScreen';
import { HomeDashboard } from './components/HomeDashboard';
import { MembershipPassScreen } from './components/MembershipPassScreen';
import { GuestPassHub } from './components/GuestPassHub';
import { StaffScannerView } from './components/StaffScannerView';

export function App() {
  const [member, setMember] = useState<MemberProfile | null>(() =>
    loadActiveMemberLocal()
  );
  const [activeTab, setActiveTab] = useState<'home' | 'pass' | 'guests' | 'staff'>('home');
  const [gymStatus, setGymStatus] = useState<GymStatus>(DEFAULT_GYM_STATUS);
  const [statusFromSupabase, setStatusFromSupabase] = useState<boolean>(false);
  const [guestPasses, setGuestPasses] = useState<GuestPass[]>([]);
  const [passesFromSupabase, setPassesFromSupabase] = useState<boolean>(false);

  const loadGymStatus = useCallback(async () => {
    const res = await fetchGymStatus();
    setGymStatus(res.status);
    setStatusFromSupabase(res.fromSupabase);
  }, []);

  const loadGuestPasses = useCallback(async (currentMember: MemberProfile) => {
    const res = await fetchMemberGuestPasses(currentMember);
    setGuestPasses(res.passes);
    setPassesFromSupabase(res.fromSupabase);
  }, []);

  // Initial load & Supabase Realtime subscription for gym_status
  useEffect(() => {
    loadGymStatus();

    const channel = supabase
      .channel('gym_status_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gym_status' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row) {
            setGymStatus((prev) => ({
              ...prev,
              branch_name: String(row.branch_name || prev.branch_name),
              is_open:
                typeof row.is_open === 'boolean' ? row.is_open : prev.is_open,
              operating_hours: String(
                row.operating_hours || prev.operating_hours
              ),
              current_capacity: Number(
                row.current_capacity ??
                  row.current_occupancy ??
                  prev.current_capacity
              ),
              max_capacity: Number(row.max_capacity ?? prev.max_capacity),
              updated_at: String(row.updated_at || new Date().toISOString()),
            }));
            setStatusFromSupabase(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadGymStatus]);

  // Load member guest passes whenever member changes
  useEffect(() => {
    if (member) {
      loadGuestPasses(member);
    } else {
      setGuestPasses([]);
    }
  }, [member, loadGuestPasses]);

  const handleAuthenticated = (loggedMember: MemberProfile) => {
    setMember(loggedMember);
    saveActiveMemberLocal(loggedMember);
    setActiveTab('home');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut().catch(() => {});
    setMember(null);
    saveActiveMemberLocal(null);
  };

  const handleTierChange = async (newTier: MembershipTier) => {
    if (!member) return;
    const updatedMember: MemberProfile = {
      ...member,
      tier: newTier,
      membership_id: generateMembershipId(member.phone, newTier),
    };
    setMember(updatedMember);
    saveActiveMemberLocal(updatedMember);

    // Best-effort sync to Supabase profiles table
    await supabase
      .from('profiles')
      .update({
        tier: newTier,
        membership_id: updatedMember.membership_id,
      })
      .eq('id', member.id)
      .then(() => {});
  };

  const handlePassCreated = (newPass: GuestPass, savedToSupabase: boolean) => {
    setGuestPasses((prev) => [newPass, ...prev]);
    if (savedToSupabase) {
      setPassesFromSupabase(true);
    }
  };

  if (!member) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const remainingGuestPasses = Math.max(
    0,
    TIER_ALLOWANCE[member.tier] - guestPasses.length
  );

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col max-w-md mx-auto relative">
      {/* Sticky Top App Bar */}
      <header className="sticky top-0 z-30 bg-[#090d16]/90 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center shadow-md shadow-lime-500/20">
            <Dumbbell className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-white">
                ACTIVE FITNESS
              </span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-lime-400/15 text-lime-300 border border-lime-400/30">
                CAIRO
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Wifi className="w-2.5 h-2.5 text-emerald-400" />
              <span>
                {statusFromSupabase || passesFromSupabase
                  ? 'Supabase Connected'
                  : 'Supabase Ready'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Staff Scanner Button */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'staff' ? 'home' : 'staff')}
            title="Front-Desk Staff Scanner"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-cyan-400 text-slate-950 border-cyan-400 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-cyan-300 hover:border-cyan-400/40'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Staff</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            title="Sign Out"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Content Area */}
      <main className="flex-1 px-4 pt-4 pb-24">
        {activeTab === 'home' && (
          <HomeDashboard
            member={member}
            gymStatus={gymStatus}
            fromSupabase={statusFromSupabase}
            usedPassesCount={guestPasses.length}
            onRefreshStatus={loadGymStatus}
            onStatusUpdated={(next) => setGymStatus(next)}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'pass' && (
          <MembershipPassScreen
            member={member}
            onTierChange={handleTierChange}
          />
        )}

        {activeTab === 'guests' && (
          <GuestPassHub
            member={member}
            passes={guestPasses}
            fromSupabase={passesFromSupabase}
            onPassCreated={handlePassCreated}
            onTierChange={handleTierChange}
          />
        )}

        {activeTab === 'staff' && (
          <StaffScannerView onClose={() => setActiveTab('home')} />
        )}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 px-2 py-2">
        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'home'
                ? 'bg-lime-400/15 text-lime-300 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-1">Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pass')}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'pass'
                ? 'bg-lime-400/15 text-lime-300 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-5 h-5" />
            <span className="text-[10px] mt-1">Digital Pass</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guests')}
            className={`relative flex flex-col items-center justify-center py-2 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'guests'
                ? 'bg-lime-400/15 text-lime-300 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Ticket className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-3 px-1.5 py-0.2 rounded-full bg-lime-400 text-slate-950 text-[9px] font-black">
                {remainingGuestPasses}
              </span>
            </div>
            <span className="text-[10px] mt-1">Guest Passes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-cyan-400/15 text-cyan-300 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span className="text-[10px] mt-1">Staff Scanner</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
export default App;
