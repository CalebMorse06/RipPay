import React from 'react';
import {Text, View, StyleSheet} from 'react-native';
import {Colors, Typography} from '../theme';

interface Props {
  amountDisplay: string;
  currency: string;
  fiatDisplay?: string;
  // When true, the vendor priced in fiat (e.g. USD) and fiat is the primary
  // unit; XRP is shown as the secondary `≈` line. When false/undefined, the
  // vendor priced in XRP — XRP is primary and fiatDisplay (if set) is shown
  // beneath as a best-effort USD hint.
  pricedInFiat?: boolean;
}

export default function AmountDisplay({amountDisplay, currency, fiatDisplay, pricedInFiat}: Props) {
  if (pricedInFiat && fiatDisplay) {
    return (
      <View style={styles.stack}>
        <Text style={styles.fiatPrimary}>{fiatDisplay}</Text>
        <Text style={styles.secondary}>
          ≈ {amountDisplay} <Text style={styles.secondaryUnit}>{currency}</Text>
        </Text>
      </View>
    );
  }
  if (fiatDisplay) {
    return (
      <View style={styles.stack}>
        <Text style={styles.amount}>
          {amountDisplay} <Text style={styles.currency}>{currency}</Text>
        </Text>
        <Text style={styles.secondary}>≈ {fiatDisplay}</Text>
      </View>
    );
  }
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
  stack: {gap: 4},
  fiatPrimary: {
    fontSize: 48,
    fontWeight: Typography.heavy,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  secondary: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  secondaryUnit: {
    color: Colors.textTertiary,
  },
});
