/**
 * Build the QR payload for a ColdTap session.
 *
 * Encodes a custom-scheme URL that the iPhone app handles via its registered
 * `coldtap://` URL scheme. The `api` query parameter carries the backend base
 * URL so the iOS app can poll / submit without hard-coding an environment.
 *
 * Example: coldtap://session/s_abc123?api=https%3A%2F%2Fcoldtap.local
 */
export function buildSessionUri(sessionId: string, apiBaseUrl: string): string {
  return `coldtap://session/${sessionId}?api=${encodeURIComponent(apiBaseUrl)}`;
}
