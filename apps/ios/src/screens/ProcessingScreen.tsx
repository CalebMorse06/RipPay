import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useSessionStore, LedgerStep} from '../store/sessionStore';
import {updateSessionStatus, submitSession} from '../api/sessions';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;

const STEP_LABELS: Record<LedgerStep, string> = {
  idle: 'Preparing…',
  connecting: 'Connecting to Ledger…',
  reading_address: 'Reading your XRPL account…',
  building_tx: 'Building transaction…',
  awaiting_user_confirm: 'Confirm on your Ledger',
  submitting: 'Submitting to XRPL…',
  done: 'Complete',
  error: 'Something went wrong',
};

const STEP_SUBTEXT: Partial<Record<LedgerStep, string>> = {
  connecting: 'Make sure Bluetooth is on and the XRP app is open on your Ledger',
  awaiting_user_confirm: 'Review and press both buttons on your Ledger Nano X to approve',
  submitting: 'Your signed transaction is being broadcast to the network',
};

export default function ProcessingScreen({navigation, route}: Props) {
  const {sessionId} = route.params;
  const {ledgerStep, ledgerError, setLedgerStep, setLedgerError} = useSessionStore();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    runPaymentFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPaymentFlow() {
    try {
      await updateSessionStatus(sessionId, 'AWAITING_SIGNATURE');

      // TODO Phase 3: Replace this mock flow with real Ledger BLE signing
      setLedgerStep('connecting');
      await delay(1500);

      setLedgerStep('reading_address');
      await delay(1200);

      setLedgerStep('building_tx');
      await delay(800);

      setLedgerStep('awaiting_user_confirm');
      await delay(2500); // Simulates user pressing Ledger button

      setLedgerStep('submitting');

      // TODO Phase 3: Pass real signedTxBlob from Ledger
      const mockSignedBlob = 'MOCK_SIGNED_TX_BLOB_REPLACE_IN_PHASE_3';
      const result = await submitSession(sessionId, mockSignedBlob);

      setLedgerStep('done');
      navigation.replace('Success', {sessionId, txHash: result.txHash});
    } catch (e: any) {
      setLedgerStep('error');
      setLedgerError(e?.response?.data?.message ?? e?.message ?? 'Unknown error');
    }
  }

  const label = STEP_LABELS[ledgerStep];
  const subtext = STEP_SUBTEXT[ledgerStep];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconArea}>
          {ledgerStep === 'error' ? (
            <Text style={styles.errorIcon}>✗</Text>
          ) : ledgerStep === 'awaiting_user_confirm' ? (
            <Text style={styles.ledgerIcon}>🔐</Text>
          ) : (
            <ActivityIndicator size="large" color="#2563EB" />
          )}
        </View>

        <Text style={styles.stepLabel}>{label}</Text>
        {subtext && <Text style={styles.stepSubtext}>{subtext}</Text>}

        {ledgerStep === 'error' && (
          <View style={styles.errorSection}>
            {ledgerError && <Text style={styles.errorDetail}>{ledgerError}</Text>}
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => navigation.goBack()}>
              <Text style={styles.retryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.steps}>
          {(['connecting', 'reading_address', 'building_tx', 'awaiting_user_confirm', 'submitting'] as LedgerStep[]).map(
            step => (
              <StepDot key={step} step={step} current={ledgerStep} />
            ),
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function StepDot({step, current}: {step: LedgerStep; current: LedgerStep}) {
  const ORDER: LedgerStep[] = ['connecting', 'reading_address', 'building_tx', 'awaiting_user_confirm', 'submitting', 'done'];
  const stepIdx = ORDER.indexOf(step);
  const currentIdx = ORDER.indexOf(current);
  const done = currentIdx > stepIdx;
  const active = current === step;

  return (
    <View
      style={[
        dotStyles.dot,
        done && dotStyles.done,
        active && dotStyles.active,
      ]}
    />
  );
}

const dotStyles = StyleSheet.create({
  dot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#1F2937'},
  done: {backgroundColor: '#10B981'},
  active: {backgroundColor: '#2563EB', width: 24},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0A0F'},
  content: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16},
  iconArea: {marginBottom: 8},
  errorIcon: {fontSize: 56, color: '#F87171'},
  ledgerIcon: {fontSize: 56},
  stepLabel: {fontSize: 22, fontWeight: '700', color: '#FFFFFF', textAlign: 'center'},
  stepSubtext: {fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, maxWidth: 280},
  errorSection: {gap: 12, alignItems: 'center', marginTop: 8},
  errorDetail: {fontSize: 13, color: '#F87171', textAlign: 'center'},
  retryButton: {paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#111827', borderRadius: 10},
  retryButtonText: {color: '#9CA3AF', fontSize: 15, fontWeight: '600'},
  steps: {flexDirection: 'row', gap: 8, marginTop: 32},
});

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
