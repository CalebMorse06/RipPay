/**
 * Phase 3: Replace stub with real BLE transport.
 *
 * Real implementation will:
 *   import BleTransport from '@ledgerhq/react-native-hw-transport-ble';
 *   const transport = await BleTransport.create(deviceId);
 *
 * Requirements:
 *   - react-native-ble-plx linked
 *   - NSBluetoothAlwaysUsageDescription in Info.plist
 *   - bluetooth-central in UIBackgroundModes
 */

export interface LedgerDevice {
  id: string;
  name: string;
}

export async function scanForDevices(
  onDevice: (device: LedgerDevice) => void,
  timeoutMs = 10000,
): Promise<void> {
  // TODO Phase 3: BleTransport.listen(observer) to discover nearby Ledger devices
  throw new Error('LedgerTransport: BLE not yet implemented. See Phase 3.');
}

export async function createTransport(deviceId: string): Promise<unknown> {
  // TODO Phase 3: return await BleTransport.create(deviceId);
  throw new Error('LedgerTransport: BLE not yet implemented. See Phase 3.');
}
