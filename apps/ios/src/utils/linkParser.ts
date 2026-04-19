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

export function parseLinkIntent(input: string): LinkIntent {
  const t = input.trim();
  if (!t) return {type: 'unknown'};

  // coldtap:// deep links (NFC path)
  const ctSession = t.match(/^coldtap:\/\/(?:session|s)\/([^/?#\s]+)/i);
  if (ctSession?.[1]) return {type: 'session', sessionId: ctSession[1]};

  const ctMerchant = t.match(/^coldtap:\/\/(?:merchant|tap|m)\/([^/?#\s]+)/i);
  if (ctMerchant?.[1]) return {type: 'merchant', merchantId: ctMerchant[1]};

  // https:// URLs (QR code / paste)
  const httpSession = t.match(/https?:\/\/[^/]+\/(?:session|sessions|s|pay)\/([^/?#\s]+)/i);
  if (httpSession?.[1]) return {type: 'session', sessionId: httpSession[1]};

  const httpMerchant = t.match(/https?:\/\/[^/]+\/(?:merchant|tap|m)\/([^/?#\s]+)/i);
  if (httpMerchant?.[1]) return {type: 'merchant', merchantId: httpMerchant[1]};

  // Query params
  const sessionParam = t.match(/[?&](?:id|session|sessionId)=([^&\s]+)/);
  if (sessionParam?.[1]) return {type: 'session', sessionId: sessionParam[1]};

  const merchantParam = t.match(/[?&](?:merchant|merchantId)=([^&\s]+)/);
  if (merchantParam?.[1]) return {type: 'merchant', merchantId: merchantParam[1]};

  // Bare string — treat as session ID (manual entry)
  if (t.length > 2 && !t.includes('://')) return {type: 'session', sessionId: t};

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
