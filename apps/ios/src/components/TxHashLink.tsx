import React from 'react';
import {Text, StyleSheet, Linking, TouchableOpacity} from 'react-native';
import type {NetworkId} from '@coldtap/shared';
import {Colors, Typography} from '../theme';

function explorerUrl(txHash: string, network?: NetworkId): string {
  const host =
    network === 'mainnet' ? 'livenet.xrpl.org'
    : network === 'devnet' ? 'devnet.xrpl.org'
    : 'testnet.xrpl.org';
  return `https://${host}/transactions/${txHash}`;
}

export default function TxHashLink({txHash, network}: {txHash: string; network?: NetworkId}) {
  return (
    <TouchableOpacity onPress={() => Linking.openURL(explorerUrl(txHash, network))} activeOpacity={0.6}>
      <Text style={styles.hash} numberOfLines={1} ellipsizeMode="middle">
        {txHash}
      </Text>
      <Text style={styles.link}>View on XRPL Explorer →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hash: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  link: {
    fontSize: Typography.sm,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: Typography.semibold,
  },
});
