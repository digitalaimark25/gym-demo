import { createClient } from '@supabase/supabase-js';
import type { GuestPass, GymStatus, MemberProfile, MembershipTier } from '../types/gym';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://acdgbhrvnogblgawzhry.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_y-yw51BaPDU2lla9h-MgWA_Ty278RT6';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

const STORAGE_KEYS = {
  MEMBER: 'afg_cairo_active_member_v1',
  GYM_STATUS: 'afg_cairo_gym_status_v1',
  GUEST_PASSES: 'afg_cairo_guest_passes_v1',
};

export function normalizeEgyptianPhone(input: string): string {
  const digitsAndPlus = input.replace(/[\s\-()]/g, '');
  if (!digitsAndPlus) return '';

  // Already has + prefix
  if (digitsAndPlus.startsWith('+')) {
    return digitsAndPlus;
  }

  // Egyptian 0020 prefix
  if (digitsAndPlus.startsWith('0020')) {
    return '+' + digitsAndPlus.slice(2);
  }

  // Egyptian local mobile format e.g. 010..., 011..., 012..., 015...
  if (/^01[0125]\d{8}$/.test(digitsAndPlus)) {
    return '+20' + digitsAndPlus.slice(1);
  }

  // 2010... without +
  if (/^201[0125]\d{8}$/.test(digitsAndPlus)) {
    return '+' + digitsAndPlus;
  }

  // Default: prepend +20 if 10 digits starting with 1
  if (/^1[0125]\d{8}$/.test(digitsAndPlus)) {
    return '+20' + digitsAndPlus;
  }

  return '+' + digitsAndPlus.replace(/^\+/, '');
}

export function phoneToFallbackAuthEmail(normalizedPhone: string): string {
  const digits = normalizedPhone.replace(/\D/g, '');
  return `m${digits}@activegym.cairo.eg`;
}

export function generateMembershipId(phone: string, tier: MembershipTier): string {
  const prefix = tier === 'VIP' ? 'AFG-VIP' : tier === 'Premium' ? 'AFG-PRM' : 'AFG-STD';
  const last4 = phone.replace(/\D/g, '').slice(-4).padStart(4, '0');
  const hash = Math.abs(
    phone.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)
  )
    .toString()
    .slice(0, 3)
    .padStart(3, '0');
  return `${prefix}-CAI-${hash}${last4}`;
}

export function generateUniquePassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `AFG-${suffix}`;
}

export const DEFAULT_GYM_STATUS: GymStatus = {
  id: 1,
  branch_name: 'Active Fitness Gym — New Cairo Flagship',
  is_open: true,
  operating_hours: 'Open 24/7 • All Week',
  current_capacity: 46,
  max_capacity: 120,
  updated_at: new Date().toISOString(),
};

export const DEMO_MEMBERS: Record<MembershipTier, MemberProfile> = {
  Standard: {
    id: 'demo-std-cairo-01',
    full_name: 'Omar El-masry',
    phone: '+201012345601',
    membership_id: 'AFG-STD-CAI-2045601',
    tier: 'Standard',
    renewal_date: '2027-03-15',
    fingerprint_enrolled: true,
  },
  Premium: {
    id: 'demo-prm-cairo-02',
    full_name: 'Youssef Mansour',
    phone: '+201098765432',
    membership_id: 'AFG-PRM-CAI-8195432',
    tier: 'Premium',
    renewal_date: '2027-05-20',
    fingerprint_enrolled: true,
  },
  VIP: {
    id: 'demo-vip-cairo-03',
    full_name: 'Nourhan Abdelrahman',
    phone: '+201223344556',
    membership_id: 'AFG-VIP-CAI-9014556',
    tier: 'VIP',
    renewal_date: '2027-11-01',
    fingerprint_enrolled: true,
  },
};

/**
 * Fetches live gym_status from Supabase.
 * Automatically maps common column names (e.g. current_capacity / current_occupancy, max_capacity, is_open / status).
 */
export async function fetchGymStatus(): Promise<{
  status: GymStatus;
  fromSupabase: boolean;
  errorHint?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('gym_status')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      const cached = localStorage.getItem(STORAGE_KEYS.GYM_STATUS);
      return {
        status: cached ? JSON.parse(cached) : DEFAULT_GYM_STATUS,
        fromSupabase: false,
        errorHint: error.message,
      };
    }

    if (data) {
      const mapped: GymStatus = {
        id: data.id ?? 1,
        branch_name:
          data.branch_name ||
          data.gym_name ||
          data.location ||
          'Active Fitness Gym — Cairo',
        is_open:
          typeof data.is_open === 'boolean'
            ? data.is_open
            : typeof data.status === 'string'
              ? data.status.toLowerCase() !== 'closed'
              : true,
        operating_hours:
          data.operating_hours || data.hours || 'Open 24/7 • All Week',
        current_capacity: Number(
          data.current_capacity ??
            data.current_occupancy ??
            data.occupancy ??
            data.current_count ??
            46
        ),
        max_capacity: Number(
          data.max_capacity ?? data.max_occupancy ?? data.capacity ?? 120
        ),
        updated_at: data.updated_at || new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.GYM_STATUS, JSON.stringify(mapped));
      return { status: mapped, fromSupabase: true };
    }

    // Table exists but is empty — try seeding row 1
    const seedPayload = {
      branch_name: DEFAULT_GYM_STATUS.branch_name,
      is_open: DEFAULT_GYM_STATUS.is_open,
      operating_hours: DEFAULT_GYM_STATUS.operating_hours,
      current_capacity: DEFAULT_GYM_STATUS.current_capacity,
      max_capacity: DEFAULT_GYM_STATUS.max_capacity,
    };
    const { data: inserted } = await supabase
      .from('gym_status')
      .insert([seedPayload])
      .select('*')
      .maybeSingle();

    if (inserted) {
      const mapped: GymStatus = {
        id: inserted.id ?? 1,
        branch_name: inserted.branch_name || DEFAULT_GYM_STATUS.branch_name,
        is_open: inserted.is_open ?? true,
        operating_hours:
          inserted.operating_hours || DEFAULT_GYM_STATUS.operating_hours,
        current_capacity: Number(inserted.current_capacity ?? 46),
        max_capacity: Number(inserted.max_capacity ?? 120),
        updated_at: inserted.updated_at || new Date().toISOString(),
      };
      return { status: mapped, fromSupabase: true };
    }

    return { status: DEFAULT_GYM_STATUS, fromSupabase: true };
  } catch (err) {
    const cached = localStorage.getItem(STORAGE_KEYS.GYM_STATUS);
    return {
      status: cached ? JSON.parse(cached) : DEFAULT_GYM_STATUS,
      fromSupabase: false,
      errorHint: err instanceof Error ? err.message : 'Connection error',
    };
  }
}

/**
 * Updates gym_status capacity or open state in Supabase (and local cache)
 */
export async function updateGymStatusLive(
  currentStatus: GymStatus,
  patch: Partial<Pick<GymStatus, 'current_capacity' | 'is_open'>>
): Promise<{ status: GymStatus; synced: boolean }> {
  const updated: GymStatus = {
    ...currentStatus,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.GYM_STATUS, JSON.stringify(updated));

  try {
    const { error } = await supabase
      .from('gym_status')
      .update({
        current_capacity: updated.current_capacity,
        is_open: updated.is_open,
        updated_at: updated.updated_at,
      })
      .eq('id', currentStatus.id);

    return { status: updated, synced: !error };
  } catch {
    return { status: updated, synced: false };
  }
}

/**
 * Fetches guest passes for the member from Supabase `guest_passes` table
 */
export async function fetchMemberGuestPasses(
  member: MemberProfile
): Promise<{ passes: GuestPass[]; fromSupabase: boolean }> {
  const localRaw = localStorage.getItem(STORAGE_KEYS.GUEST_PASSES);
  const allLocal: GuestPass[] = localRaw ? JSON.parse(localRaw) : [];
  const memberLocal = allLocal.filter(
    (p) => p.member_id === member.id || p.member_id === member.membership_id
  );

  try {
    const { data, error } = await supabase
      .from('guest_passes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return { passes: memberLocal, fromSupabase: false };
    }

    const mapped: GuestPass[] = data
      .filter((row: Record<string, unknown>) => {
        const rowMemberId = String(
          row.member_id ?? row.user_id ?? row.membership_id ?? ''
        );
        if (!rowMemberId) return true;
        return (
          rowMemberId === member.id ||
          rowMemberId === member.membership_id ||
          rowMemberId === member.phone
        );
      })
      .map((row: Record<string, unknown>) => ({
        id: String(row.id ?? crypto.randomUUID()),
        member_id: String(row.member_id ?? member.id),
        member_name: String(row.member_name ?? member.full_name),
        guest_name: String(row.guest_name ?? row.name ?? 'Guest'),
        guest_phone: String(row.guest_phone ?? row.phone ?? ''),
        pass_code: String(row.pass_code ?? row.code ?? 'AFG-PASS'),
        tier_at_issue: (row.tier_at_issue as MembershipTier) || member.tier,
        status:
          (row.status as 'Active' | 'Redeemed' | 'Expired') || 'Active',
        expires_at: String(
          row.expires_at ??
            new Date(Date.now() + 7 * 86400000).toISOString()
        ),
        created_at: String(row.created_at ?? new Date().toISOString()),
      }));

    // Merge any unsynced local passes for this member
    const remoteCodes = new Set(mapped.map((m) => m.pass_code));
    const merged = [
      ...mapped,
      ...memberLocal.filter((l) => !remoteCodes.has(l.pass_code)),
    ];

    return { passes: merged, fromSupabase: true };
  } catch {
    return { passes: memberLocal, fromSupabase: false };
  }
}

/**
 * Inserts a new Guest Pass into Supabase `guest_passes` table
 */
export async function createGuestPassRecord(params: {
  member: MemberProfile;
  guestName: string;
  guestPhone: string;
}): Promise<{ pass: GuestPass; savedToSupabase: boolean; errorNote?: string }> {
  const passCode = generateUniquePassCode();
  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const normalizedPhone = normalizeEgyptianPhone(params.guestPhone);

  const newPass: GuestPass = {
    id: crypto.randomUUID(),
    member_id: params.member.id,
    member_name: params.member.full_name,
    guest_name: params.guestName.trim(),
    guest_phone: normalizedPhone,
    pass_code: passCode,
    tier_at_issue: params.member.tier,
    status: 'Active',
    expires_at: expiresIso,
    created_at: nowIso,
  };

  // Always save to local storage immediately for zero-latency UX
  const localRaw = localStorage.getItem(STORAGE_KEYS.GUEST_PASSES);
  const allLocal: GuestPass[] = localRaw ? JSON.parse(localRaw) : [];
  localStorage.setItem(
    STORAGE_KEYS.GUEST_PASSES,
    JSON.stringify([newPass, ...allLocal])
  );

  try {
    // Attempt full schema insert first
    const { data, error } = await supabase
      .from('guest_passes')
      .insert([
        {
          member_id: params.member.id,
          member_name: params.member.full_name,
          guest_name: newPass.guest_name,
          guest_phone: newPass.guest_phone,
          pass_code: newPass.pass_code,
          tier_at_issue: params.member.tier,
          status: 'Active',
          expires_at: expiresIso,
        },
      ])
      .select('*')
      .maybeSingle();

    if (!error && data) {
      return {
        pass: { ...newPass, id: String(data.id ?? newPass.id) },
        savedToSupabase: true,
      };
    }

    // Fallback minimal insert in case existing guest_passes table only has core columns
    const { data: minData, error: minErr } = await supabase
      .from('guest_passes')
      .insert([
        {
          guest_name: newPass.guest_name,
          guest_phone: newPass.guest_phone,
          pass_code: newPass.pass_code,
        },
      ])
      .select('*')
      .maybeSingle();

    if (!minErr && minData) {
      return {
        pass: { ...newPass, id: String(minData.id ?? newPass.id) },
        savedToSupabase: true,
      };
    }

    return {
      pass: newPass,
      savedToSupabase: false,
      errorNote: error?.message || minErr?.message,
    };
  } catch (err) {
    return {
      pass: newPass,
      savedToSupabase: false,
      errorNote: err instanceof Error ? err.message : 'Offline',
    };
  }
}

export function saveActiveMemberLocal(member: MemberProfile | null): void {
  if (!member) {
    localStorage.removeItem(STORAGE_KEYS.MEMBER);
  } else {
    localStorage.setItem(STORAGE_KEYS.MEMBER, JSON.stringify(member));
  }
}

export function loadActiveMemberLocal(): MemberProfile | null {
  const raw = localStorage.getItem(STORAGE_KEYS.MEMBER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MemberProfile;
  } catch {
    return null;
  }
}
