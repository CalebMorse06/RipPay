import NfcManager, {NfcTech} from 'react-native-nfc-manager';
import type {LinkIntent} from '../utils/linkParser';

// AID: F0434F4C44544150 — F0 prefix + ASCII "COLDTAP" (uppercase, 8 bytes)
// Must match Android HCE registration exactly.
const COLDTAP_AID = [0xf0, 0x43, 0x4f, 0x4c, 0x44, 0x54, 0x41, 0x50];

/**
 * Start an ISO 7816 NFC reader session, SELECT the ColdTap AID on the
 * merchant Android phone (HCE), decode the UTF-8 response payload, and
 * return a routing intent. Throws on APDU error, timeout, or bad payload.
 *
 * iOS shows the system "Hold iPhone near reader" HUD automatically.
 * Always cancels the NFC session in the finally block.
 */
export async function readMerchantPayload(): Promise<LinkIntent> {
  await NfcManager.start();
  try {
    await NfcManager.requestTechnology([NfcTech.IsoDep]);

    const {response, sw1, sw2} = await (NfcManager as any).sendCommandAPDUIOS({
      cla: 0x00,
      ins: 0xa4,
      p1: 0x04,
      p2: 0x00,
      data: COLDTAP_AID,
      le: 0xff,
    });

    if (sw1 !== 0x90 || sw2 !== 0x00) {
      throw new Error(
        `Merchant phone returned unexpected status: ${sw1.toString(16).padStart(2, '0')}${sw2.toString(16).padStart(2, '0')}`,
      );
    }

    const text = new TextDecoder().decode(new Uint8Array(response as number[]));
    return parseNFCPayload(text);
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

/**
 * Parse the UTF-8 response from the Android HCE SELECT AID command.
 *
 * Accepted formats:
 *   sessionId=abc123       → {type: 'session', sessionId: 'abc123'}
 *   merchantSlug=my-booth  → {type: 'merchant', merchantId: 'my-booth'}
 *   abc123                 → {type: 'session', sessionId: 'abc123'}  (bare ID)
 */
export function parseNFCPayload(text: string): LinkIntent {
  const t = text.trim();

  // Primary format from Android HCE: SESSION:<id>
  const sessionColon = t.match(/^SESSION:(.+)$/i);
  if (sessionColon) {
    return {type: 'session', sessionId: sessionColon[1]};
  }

  // Key=value fallbacks
  const kv = t.match(/^(\w+)=(.+)$/);
  if (kv) {
    if (kv[1] === 'sessionId') return {type: 'session', sessionId: kv[2]};
    if (kv[1] === 'merchantSlug') return {type: 'merchant', merchantId: kv[2]};
  }

  // Bare string — treat as session ID
  if (t.length > 2) {
    return {type: 'session', sessionId: t};
  }
  return {type: 'unknown'};
}

export function humanizeNFCError(msg: string | undefined): string {
  if (!msg) return 'NFC read failed';
  const lower = msg.toLowerCase();
  if (lower.includes('user cancel') || lower.includes('cancelled')) {
    return 'Scan cancelled';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'No merchant phone found nearby';
  }
  if (lower.includes('unexpected status') || lower.includes('apdu')) {
    return 'Merchant phone not recognized — check Android app is running';
  }
  if (lower.includes('not supported') || lower.includes('not available')) {
    return 'NFC is not available on this device';
  }
  return msg;
}
