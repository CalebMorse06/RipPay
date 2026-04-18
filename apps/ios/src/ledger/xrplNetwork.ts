/**
 * Minimal XRPL network queries over JSON-RPC HTTP.
 * Used as a fallback when backend /prepare endpoint is not yet available.
 * No WebSocket dependency — just axios POST to the JSON-RPC endpoint.
 */

import axios from 'axios';

// XRPL testnet JSON-RPC HTTP endpoint (no WebSocket needed)
const XRPL_RPC_URL = 'https://s.altnet.rippletest.net:51234';

// Safety margin: how many ledgers ahead to set LastLedgerSequence
const LAST_LEDGER_BUFFER = 200;

export interface XrplNetworkParams {
  sequence: number;
  fee: string;           // drops as string, e.g. "12"
  lastLedgerSequence: number;
}

export async function fetchNetworkParams(address: string): Promise<XrplNetworkParams> {
  const [accountRes, serverRes] = await Promise.all([
    axios.post(XRPL_RPC_URL, {
      method: 'account_info',
      params: [{account: address, ledger_index: 'current'}],
    }),
    axios.post(XRPL_RPC_URL, {
      method: 'server_state',
      params: [{}],
    }),
  ]);

  const accountResult = accountRes.data?.result;
  if (accountResult?.error) {
    throw new Error(`XRPL account_info error: ${accountResult.error_message ?? accountResult.error}`);
  }

  const sequence: number = accountResult.account_data.Sequence;
  const currentLedger: number = serverRes.data?.result?.state?.validated_ledger?.seq
    ?? serverRes.data?.result?.state?.ledger?.seq;

  if (!sequence || !currentLedger) {
    throw new Error('Could not fetch XRPL network parameters');
  }

  // Use a fixed fee of 12 drops (minimum relay fee on testnet)
  return {
    sequence,
    fee: '12',
    lastLedgerSequence: currentLedger + LAST_LEDGER_BUFFER,
  };
}
