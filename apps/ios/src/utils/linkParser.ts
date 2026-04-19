/**
 * Centralized link intent parser.
 *
 * Called from AppNavigator (deep links), HomeScreen (manual input/paste),
 * and anywhere else a user-supplied URL or ID needs to be classified.
 *
 * Supported URL patterns → merchant launch (NFC sticker primary path):
 *   coldtap://merchant/:merchantId
 *   coldtap://tap/:merchantId
 *   https://app.coldtap.xyz/merchant/:merchantId
 *   https://app.coldtap.xyz/tap/:merchantId
 *   https://app.coldtap.xyz/m/:merchantId
 *
 * Supported URL patterns → direct session load:
 *   coldtap://session/:sessionId
 *   coldtap://s/:sessionId
 *   https://app.coldtap.xyz/session/:sessionId
 *   ?session=, ?sessionId=, ?id=
 *
 * Bare strings → treated as session IDs (manual dev/testing entry)
 */

export type LinkIntent =
  | {type: 'merchant'; merchantId: string}
  | {type: 'session'; sessionId: string}
  | {type: 'unknown'};

const MERCHANT_SEGMENTS = new Set(['merchant', 'tap', 'm']);
const SESSION_SEGMENTS = new Set(['session', 'sessions', 's', 'pay']);

export function parseLinkIntent(input: string): LinkIntent {
  const trimmed = input.trim();
  if (!trimmed) return {type: 'unknown'};

  try {
    const normalized = trimmed.startsWith('coldtap://')
      ? trimmed.replace('coldtap://', 'https://coldtap.local/')
      : trimmed;

    const url = new URL(normalized);
    const parts = url.pathname.split('/').filter(Boolean);

    // Walk path segments looking for merchant or session keywords
    for (let i = 0; i < parts.length - 1; i++) {
      if (MERCHANT_SEGMENTS.has(parts[i]) && parts[i + 1]) {
        return {type: 'merchant', merchantId: parts[i + 1]};
      }
      if (SESSION_SEGMENTS.has(parts[i]) && parts[i + 1]) {
        return {type: 'session', sessionId: parts[i + 1]};
      }
    }

    // Query params
    const qp = url.searchParams;
    const merchantId = qp.get('merchant') ?? qp.get('merchantId');
    if (merchantId) return {type: 'merchant', merchantId};
    const sessionId = qp.get('id') ?? qp.get('session') ?? qp.get('sessionId');
    if (sessionId) return {type: 'session', sessionId};
  } catch {}

  // Bare string — treat as raw session ID (manual dev entry)
  if (trimmed.length > 2) {
    return {type: 'session', sessionId: trimmed};
  }

  return {type: 'unknown'};
}

/**
 * Normalize any ColdTap URL to a canonical form that React Navigation
 * linking config can parse (single path pattern per screen).
 */
export function canonicalizeUrl(url: string): string {
  const intent = parseLinkIntent(url);
  if (intent.type === 'merchant') {
    return `coldtap://merchant/${intent.merchantId}`;
  }
  if (intent.type === 'session') {
    return `coldtap://session/${intent.sessionId}`;
  }
  return url;
}
