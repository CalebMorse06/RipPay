import React from 'react';
import {Text, StyleSheet} from 'react-native';

interface Props {
  amountDisplay: string;
  currency: string;
}

export default function AmountDisplay({amountDisplay, currency}: Props) {
  return (
    <Text style={styles.amount}>
      {amountDisplay}{' '}
      <Text style={styles.currency}>{currency}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  currency: {
    fontSize: 28,
    fontWeight: '500',
    color: '#6B7280',
  },
});
