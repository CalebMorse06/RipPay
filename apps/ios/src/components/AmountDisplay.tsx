import React from 'react';
import {Text, StyleSheet} from 'react-native';
import {Colors, Typography} from '../theme';

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
    fontWeight: Typography.heavy,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  currency: {
    fontSize: 26,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
  },
});
