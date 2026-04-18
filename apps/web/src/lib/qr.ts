/**
 * QR payload helpers.
 *
 * The public-facing launch URL is an HTTPS link:
 *
 *   https://<base>/s/<sessionId>
 *
 * On an iPhone with the ColdTap app installed, the associated domain's universal
 * link handler opens the native app with the session id. Without the app the URL
 * falls back to a lightweight web page that explains the flow and shows the raw
 * session id for manual entry.
 *
 * `buildDeepLink` additionally returns a `coldtap://` URI for native code paths
 * that prefer a custom URL scheme (e.g. testing on simulator without associated
 * domains configured). Consumers should prefer `buildLaunchUrl` for public QRs.
 */

export function buildLaunchUrl(sessionId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/s/${sessionId}`;
}

export function buildDeepLink(sessionId: string, baseUrl: string): string {
  return `coldtap://session/${sessionId}?api=${encodeURIComponent(
    baseUrl.replace(/\/+$/, ""),
  )}`;
}

/** Back-compat: old callers used this name for the custom-scheme URI. */
export function buildSessionUri(sessionId: string, baseUrl: string): string {
  return buildDeepLink(sessionId, baseUrl);
}
