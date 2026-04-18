import React from 'react';
import {Text, StyleSheet, Linking, TouchableOpacity} from 'react-native';

export default function TxHashLink({txHash}: {txHash: string}) {
  const url = `https://testnet.xrpl.org/transactions/${txHash}`;
  return (
    <TouchableOpacity onPress={() => Linking.openURL(url)}>
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
    color: '#6B7280',
    marginTop: 8,
  },
  link: {
    fontSize: 14,
    color: '#60A5FA',
    marginTop: 4,
    fontWeight: '600',
  },
});
