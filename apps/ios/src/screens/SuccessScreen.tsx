import React from 'react';
import {View, Text, StyleSheet, SafeAreaView, TouchableOpacity} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CommonActions} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/types';
import TxHashLink from '../components/TxHashLink';
import {useSessionStore} from '../store/sessionStore';
import {Colors, Typography, Radius, Shadow} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

export default function SuccessScreen({navigation, route}: Props) {
  const {txHash} = route.params;
  const reset = useSessionStore(s => s.reset);

  function handleHome() {
    reset();
    navigation.dispatch(
      CommonActions.reset({index: 0, routes: [{name: 'Home'}]}),
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkmark}>✓</Text>
        </View>

        <Text style={styles.title}>Payment Sent</Text>
        <Text style={styles.subtitle}>
          Your transaction has been submitted to the XRP Ledger.
        </Text>

        <View style={styles.txCard}>
          <Text style={styles.txLabel}>Transaction</Text>
          <TxHashLink txHash={txHash} />
        </View>

        <View style={styles.ledgerBadge}>
          <Text style={styles.ledgerBadgeText}>🔒 Signed by Ledger Nano X</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.homeButton} onPress={handleHome}>
          <Text style={styles.homeButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 18,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  checkmark: {fontSize: 48, color: Colors.success},
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  txCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    width: '100%',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  txLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  ledgerBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  ledgerBadgeText: {
    fontSize: Typography.sm,
    color: Colors.primaryDark,
    fontWeight: Typography.medium,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  homeButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
    ...Shadow.button,
  },
  homeButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textOnPrimary,
  },
});
