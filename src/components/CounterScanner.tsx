import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect, useRef } from 'react';
import { supabase, DEMO_MEMBERS } from '../lib/supabase';
import type { MemberProfile, GuestPass } from '../types/gym';

export interface ScanVerificationResult {
  valid: boolean;
  type?: 'member' | 'guest' | 'error';
  statusBadge?: string;
  isExpired?: boolean;
  member?: Partial<MemberProfile> & Record<string, any>;
  guestPass?: Partial<GuestPass> & Record<string, any>;
  message?: string;
  decodedText?: string;
}

interface CounterScannerProps {
  onScanSuccess: (result: ScanVerificationResult) => void;
}

export default function CounterScanner({ onScanSuccess }: CounterScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      async (decodedText: string) => {
        // Prevent rapid repeated triggers while verifying
        if (isVerifyingRef.current) return;
        isVerifyingRef.current = true;

        const cleanText = decodedText.trim();

        try {
          // 1. Primary check: verify against Supabase `profiles` by `id` (as requested)
          let memberData: any = null;
          let isExpired = false;

          const { data: profileById } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', cleanText)
            .maybeSingle();

          if (profileById) {
            memberData = profileById;
          } else {
            // 1b. Fallback check: verify by membership_id or phone if encoded in QR
            const { data: profileByOther } = await supabase
              .from('profiles')
              .select('*')
              .or(`membership_id.eq.${cleanText},phone.eq.${cleanText}`)
              .maybeSingle();

            if (profileByOther) {
              memberData = profileByOther;
            }
          }

          // If found in Supabase profiles
          if (memberData) {
            const renewal = memberData.renewal_date ? new Date(memberData.renewal_date) : null;
            if (renewal && renewal.getTime() < Date.now()) {
              isExpired = true;
              onScanSuccess({
                valid: false,
                type: 'member',
                isExpired: true,
                statusBadge: 'Pass Expired',
                member: memberData,
                message: `Membership expired on ${memberData.renewal_date}`,
                decodedText: cleanText,
              });
            } else {
              const tier = memberData.membership_tier || memberData.tier || 'Standard';
              onScanSuccess({
                valid: true,
                type: 'member',
                statusBadge: `Access Granted - Active Member (${tier})`,
                member: memberData,
                decodedText: cleanText,
              });
            }
            return;
          }

          // 2. Check Supabase `guest_passes` table by pass_code or id
          const { data: guestPassData } = await supabase
            .from('guest_passes')
            .select('*')
            .or(`pass_code.eq.${cleanText},id.eq.${cleanText}`)
            .maybeSingle();

          if (guestPassData) {
            const expires = guestPassData.expires_at ? new Date(guestPassData.expires_at) : null;
            const isGuestExpired = expires ? expires.getTime() < Date.now() : false;

            if (isGuestExpired || guestPassData.status === 'Expired') {
              onScanSuccess({
                valid: false,
                type: 'guest',
                isExpired: true,
                statusBadge: 'Pass Expired',
                guestPass: guestPassData,
                message: `Guest pass expired for ${guestPassData.guest_name}`,
                decodedText: cleanText,
              });
            } else if (guestPassData.status === 'Redeemed') {
              onScanSuccess({
                valid: false,
                type: 'guest',
                statusBadge: 'Pass Already Redeemed',
                guestPass: guestPassData,
                message: `This pass was already used at the turnstile`,
                decodedText: cleanText,
              });
            } else {
              onScanSuccess({
                valid: true,
                type: 'guest',
                statusBadge: `Access Granted - Guest Pass (${guestPassData.guest_name})`,
                guestPass: guestPassData,
                decodedText: cleanText,
              });
            }
            return;
          }

          // 3. Fallback demo verification (in case offline or testing with demo profiles)
          const demoMatch = Object.values(DEMO_MEMBERS).find(
            (m) => m.id === cleanText || m.membership_id === cleanText || m.phone === cleanText
          );

          if (demoMatch) {
            onScanSuccess({
              valid: true,
              type: 'member',
              statusBadge: `Access Granted - Active Member (${demoMatch.tier})`,
              member: demoMatch,
              decodedText: cleanText,
            });
            return;
          }

          // Unrecognized
          onScanSuccess({
            valid: false,
            type: 'error',
            statusBadge: 'Access Denied',
            message: 'Unrecognized QR code',
            decodedText: cleanText,
          });
        } catch (err) {
          onScanSuccess({
            valid: false,
            type: 'error',
            statusBadge: 'Verification Error',
            message: err instanceof Error ? err.message : 'Database error',
            decodedText: cleanText,
          });
        } finally {
          setTimeout(() => {
            isVerifyingRef.current = false;
          }, 1500);
        }
      },
      (_error) => {
        // Handle scan errors silently as per user specification
      }
    );

    return () => {
      scanner.clear().catch((error) => console.error("Failed to clear scanner. ", error));
    };
  }, [onScanSuccess]);

  return (
    <div className="w-full flex flex-col items-center">
      <div 
        id="reader" 
        className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100"
        style={{ width: '100%', maxWidth: '500px' }} 
      />
    </div>
  );
}
