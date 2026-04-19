import AsyncStorage from '@react-native-async-storage/async-storage';

export type SigningMethod = 'ledger' | 'local';

const METHOD_KEY = 'rippay_signing_method';
const ADDRESS_KEY = 'rippay_local_wallet_address';

export async function getSigningMethod(): Promise<SigningMethod> {
  try {
    const raw = await AsyncStorage.getItem(METHOD_KEY);
    return raw === 'local' ? 'local' : 'ledger';
  } catch {
    return 'ledger';
  }
}

export async function setSigningMethod(method: SigningMethod): Promise<void> {
  try {
    await AsyncStorage.setItem(METHOD_KEY, method);
  } catch {
    // swallow — a failed pref write shouldn't break the payment flow
  }
}

export async function getLocalWalletAddress(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(ADDRESS_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function setLocalWalletAddress(address: string | null): Promise<void> {
  try {
    if (address === null) {
      await AsyncStorage.removeItem(ADDRESS_KEY);
    } else {
      await AsyncStorage.setItem(ADDRESS_KEY, address);
    }
  } catch {
    // swallow
  }
}
