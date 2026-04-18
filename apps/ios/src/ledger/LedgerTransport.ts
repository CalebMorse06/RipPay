/**
 * BLE transport lifecycle for Ledger Nano X.
 *
 * Uses @ledgerhq/react-native-hw-transport-ble which wraps react-native-ble-plx.
 *
 * iOS requirements:
 *   - NSBluetoothAlwaysUsageDescription in Info.plist
 *   - bluetooth-central in UIBackgroundModes
 *   - Physical device only (BLE does not work in Simulator)
 *
 * Ledger requirements:
 *   - Ledger Nano X must be unlocked
 *   - XRP app must be open on the device
 */

import BleTransport from '@ledgerhq/react-native-hw-transport-ble';

export interface LedgerDevice {
  id: string;
  name: string;
}

/** Scan timeout for demo use — 15 seconds should be plenty */
const SCAN_TIMEOUT_MS = 15_000;

/**
 * Find the first nearby Ledger device via BLE scan.
 * Returns a promise that resolves on first device found, or rejects on timeout/error.
 *
 * Automatically cleans up the scan subscription.
 */
export function findFirstLedgerDevice(): Promise<LedgerDevice> {
  return new Promise<LedgerDevice>((resolve, reject) => {
    let finished = false;
    let subscription: {unsubscribe: () => void} | null = null;

    const finish = (device: LedgerDevice | null, err: Error | null) => {
      if (finished) return;
      finished = true;
      try {
        subscription?.unsubscribe();
      } catch {}
      clearTimeout(timer);
      if (device) resolve(device);
      else reject(err!);
    };

    const timer = setTimeout(() => {
      finish(null, new Error(
        'No Ledger found within 15 seconds.\n\nMake sure:\n• Bluetooth is on\n• Ledger is unlocked\n• XRP app is open on Ledger',
      ));
    }, SCAN_TIMEOUT_MS);

    console.log('[Ledger] BLE scan started');
    try {
      subscription = BleTransport.listen({
        next: (event: any) => {
          if (event.type === 'add' && event.descriptor) {
            const d = event.descriptor;
            console.log(`[Ledger] Device found: ${d.name} (${d.id})`);
            finish({id: d.id, name: d.name ?? 'Ledger Nano X'}, null);
          }
        },
        error: (err: Error) => {
          console.log('[Ledger] BLE scan error:', err?.message);
          finish(null, new Error(humanizeBleError(err)));
        },
        complete: () => {},
      });
    } catch (err: any) {
      console.log('[Ledger] BLE listen threw:', err?.message);
      finish(null, new Error(humanizeBleError(err)));
    }
  });
}

/**
 * Open a BLE transport connection to a Ledger device.
 * Returns the transport instance used by XrplSigner.
 */
export async function openTransport(device: LedgerDevice): Promise<BleTransport> {
  console.log(`[Ledger] Opening transport to ${device.name} (${device.id})`);
  try {
    const transport = await BleTransport.open(device.id, 10_000);
    console.log('[Ledger] Transport open success');
    return transport;
  } catch (err: any) {
    console.log('[Ledger] openTransport error:', err?.message);
    throw new Error(humanizeBleError(err));
  }
}

/** Disconnect cleanly. Safe to call multiple times. */
export async function closeTransport(transport: BleTransport | null): Promise<void> {
  if (!transport) return;
  try {
    await transport.close();
  } catch {}
}

function humanizeBleError(err: any): string {
  const msg: string = err?.message ?? String(err);

  if (msg.includes('BluetoothUnauthorized') || msg.includes('unauthorized'))
    return 'Bluetooth permission denied. Please enable Bluetooth access for ColdTap in Settings.';
  if (msg.includes('BluetoothPoweredOff') || msg.includes('powered off'))
    return 'Bluetooth is off. Please turn on Bluetooth and try again.';
  if (msg.includes('DeviceDisconnected') || msg.includes('disconnected'))
    return 'Ledger disconnected. Make sure the XRP app is open and try again.';
  if (msg.includes('CantOpenDevice') || msg.includes('cannot open'))
    return 'Could not connect to Ledger. Try unlocking it and opening the XRP app.';
  if (msg.includes('LockedDevice') || msg.includes('locked'))
    return 'Ledger is locked. Please unlock it and open the XRP app.';
  if (msg.includes('pairing') || msg.includes('Peer removed pairing') || msg.includes('PairingFailed'))
    return 'Ledger pairing is stale. Go to iPhone Settings → Bluetooth, forget the Nano X, then try again.';
  if (msg.includes('already connected') || msg.includes('device already'))
    return 'Another app (Ledger Live?) is holding the Ledger connection. Close Ledger Live and try again.';
  if (msg.includes('MTU'))
    return 'Bluetooth signal too weak. Move closer to your Ledger and retry.';

  return msg || 'Bluetooth connection failed';
}
