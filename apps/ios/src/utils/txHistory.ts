import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'coldtap_tx_history';
const MAX_ENTRIES = 20;

export interface TxRecord {
  txHash: string;
  sessionId: string;
  merchantName: string;
  itemName: string;
  amountDisplay: string;
  amountDrops: string;
  destinationAddress: string;
  fiatDisplay?: string;
  pricedInFiat?: boolean;
  completedAt: string; // ISO timestamp
}

export async function saveTx(record: TxRecord): Promise<void> {
  try {
    const existing = await loadHistory();
    const updated = [record, ...existing].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Never let history writes break the payment flow
  }
}

export async function loadHistory(): Promise<TxRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TxRecord[];
  } catch {
    return [];
  }
}

export function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
