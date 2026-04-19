import {getSigningMethod} from '../utils/signingPrefs';
import {LedgerSigner} from './LedgerSigner';
import {LocalSigner} from './LocalSigner';
import type {Signer} from './Signer';

export async function getActiveSigner(): Promise<Signer> {
  const method = await getSigningMethod();
  return method === 'local' ? new LocalSigner() : new LedgerSigner();
}
