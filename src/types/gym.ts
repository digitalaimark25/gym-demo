export type MembershipTier = 'Standard' | 'Premium' | 'VIP';

export type OccupancyLevel = 'Quiet' | 'Moderate' | 'Busy';

export interface GymStatus {
  id: number | string;
  branch_name: string;
  is_open: boolean;
  operating_hours: string;
  current_capacity: number;
  max_capacity: number;
  updated_at: string;
}

export interface MemberProfile {
  id: string;
  full_name: string;
  phone: string;
  membership_id: string;
  tier: MembershipTier;
  renewal_date: string;
  fingerprint_enrolled: boolean;
}

export interface GuestPass {
  id: string;
  member_id: string;
  member_name?: string;
  guest_name: string;
  guest_phone: string;
  pass_code: string;
  tier_at_issue?: MembershipTier;
  status: 'Active' | 'Redeemed' | 'Expired';
  expires_at: string;
  created_at: string;
}

export const TIER_ALLOWANCE: Record<MembershipTier, number> = {
  Standard: 2,
  Premium: 4,
  VIP: 6,
};

export const TIER_DETAILS: Record<
  MembershipTier,
  {
    allowance: number;
    badgeBg: string;
    badgeText: string;
    cardGradient: string;
    borderAccent: string;
    glowColor: string;
    perks: string[];
  }
> = {
  Standard: {
    allowance: 2,
    badgeBg: 'bg-lime-400/15 border-lime-400/40',
    badgeText: 'text-lime-300',
    cardGradient: 'from-slate-900 via-slate-900 to-lime-950/50',
    borderAccent: 'border-lime-400/30',
    glowColor: 'shadow-lime-500/10',
    perks: ['24/7 Gym Floor Access', '2 Monthly Guest Passes', 'Fingerprint + QR Gate Entry'],
  },
  Premium: {
    allowance: 4,
    badgeBg: 'bg-cyan-400/15 border-cyan-400/40',
    badgeText: 'text-cyan-300',
    cardGradient: 'from-slate-900 via-cyan-950/40 to-indigo-950/60',
    borderAccent: 'border-cyan-400/40',
    glowColor: 'shadow-cyan-500/15',
    perks: ['24/7 All-Zone & Group Classes', '4 Monthly Guest Passes', 'Sauna & Recovery Lounge'],
  },
  VIP: {
    allowance: 6,
    badgeBg: 'bg-amber-400/20 border-amber-400/50',
    badgeText: 'text-amber-300',
    cardGradient: 'from-amber-950/60 via-slate-900 to-yellow-900/30',
    borderAccent: 'border-amber-400/50',
    glowColor: 'shadow-amber-500/20',
    perks: ['All Cairo Branches 24/7 VIP Access', '6 Monthly Guest Passes', 'Private Locker, PT & Valet'],
  },
};

export function getOccupancyInfo(current: number, max: number): {
  level: OccupancyLevel;
  percentage: number;
  label: string;
  sublabel: string;
  colorClass: string;
  barClass: string;
  badgeClass: string;
} {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.min(100, Math.max(0, Math.round((current / safeMax) * 100)));

  if (pct < 45) {
    return {
      level: 'Quiet',
      percentage: pct,
      label: 'Quiet',
      sublabel: 'Plenty of racks & cardio machines available right now.',
      colorClass: 'text-emerald-400',
      barClass: 'from-emerald-500 to-lime-400',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    };
  }
  if (pct <= 75) {
    return {
      level: 'Moderate',
      percentage: pct,
      label: 'Moderate',
      sublabel: 'Good energy on the floor — minimal wait times.',
      colorClass: 'text-amber-400',
      barClass: 'from-amber-500 to-yellow-400',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    };
  }
  return {
    level: 'Busy',
    percentage: pct,
    label: 'Busy',
    sublabel: 'Peak training hour in Cairo — free weights & cables are active.',
    colorClass: 'text-rose-400',
    barClass: 'from-orange-500 to-rose-500',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  };
}
