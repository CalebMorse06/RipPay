/**
 * Transient screen that resolves a merchant ID to the current active session.
 *
 * This is the NFC tap entry point:
 *   NFC sticker → coldtap://merchant/:id → MerchantLanding → Checkout
 *
 * Shows briefly while resolving, then replaces itself with CheckoutScreen.
 * Never stays on screen more than a few seconds on success.
 */

import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {resolveActiveSession, NoActiveSessionError} from '../api/merchants';
import {Colors, Typography, Radius} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantLanding'>;

export default function MerchantLanding({navigation, route}: Props) {
  const {merchantId} = route.params;
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    resolveActiveSession(merchantId)
      .then(session => {
        // Replace this screen — buyer should never be able to back to it
        navigation.replace('Checkout', {sessionId: session.id});
      })
      .catch((e: Error) => {
        // Stay on screen to show the error
        setError(e);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [error, setError] = React.useState<Error | null>(null);

  if (error) {
    const isNoSession = error instanceof NoActiveSessionError;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorIcon}>{isNoSession ? '⏸' : '⚠'}</Text>
          <Text style={styles.errorTitle}>
            {isNoSession ? 'No active checkout' : 'Could not load checkout'}
          </Text>
          <Text style={styles.errorBody}>
            {isNoSession
              ? 'This merchant does not have an active payment session right now.\n\nAsk the merchant to open a checkout.'
              : error.message}
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.label}>Opening checkout…</Text>
        <Text style={styles.sub}>{merchantId}</Text>
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
    gap: 14,
  },
  label: {fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary, marginTop: 16},
  sub: {fontSize: Typography.sm, color: Colors.textTertiary, fontFamily: 'Courier'},
  errorIcon: {fontSize: 48},
  errorTitle: {fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary},
  errorBody: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  backButton: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonText: {color: Colors.textSecondary, fontSize: Typography.base, fontWeight: Typography.semibold},
});
