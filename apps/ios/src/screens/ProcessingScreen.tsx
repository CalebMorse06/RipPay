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
import {useSessionStore, BuyerStep} from '../store/sessionStore';
import {
  getSession,
  updateSessionStatus,
  prepareSession,
  submitSignedBlob,
  extractApiErrorMessage,
  ApiError,
} from '../api/sessions';
import {
  findFirstLedgerDevice,
  openTransport,
  closeTransport,
} from '../ledger/LedgerTransport';
import {getXrplAccount, signXrplTransaction} from '../ledger/XrplSigner';
import {
  encodeForSigning,
  buildSignedBlob,
  buildUnsignedTxFromSession,
} from '../ledger/TransactionBuilder';
import {fetchNetworkParams} from '../ledger/xrplNetwork';
import {consumePrewarm} from '../ledger/LedgerSession';
import type {XrplUnsignedTransaction, PrepareSessionResponse} from '@coldtap/shared';
import {Colors, Typography, Radius} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;

const STEP_LABELS: Record<BuyerStep, string> = {
  idle: 'Starting…',
  preparing_payment: 'Preparing payment…',
  scanning_ledger: 'Looking for Ledger…',
  connecting_ledger: 'Connecting to Ledger…',
  fetching_account: 'Reading your XRPL account…',
  building_tx: 'Building transaction…',
  awaiting_confirmation: 'Confirm on your Ledger',
  signing: 'Signing…',
  submitting: 'Submitting to XRPL…',
  done: 'Complete',
  error: 'Something went wrong',
};

const STEP_SUBTEXT: Partial<Record<BuyerStep, string>> = {
  scanning_ledger: 'Make sure Bluetooth is on and the XRP app is open on your Ledger',
  connecting_ledger: 'Opening secure channel to Ledger Nano X…',
  awaiting_confirmation: 'Review the amount and destination on your Ledger,\nthen press both buttons to approve',
  submitting: 'Your signed transaction is being broadcast to the network',
};

// Steps shown in the progress dots
const PROGRESS_STEPS: BuyerStep[] = [
  'scanning_ledger',
  'fetching_account',
  'building_tx',
  'awaiting_confirmation',
  'submitting',
];

const STEP_ORDER: BuyerStep[] = [
  'idle',
  'preparing_payment',
  'scanning_ledger',
  'connecting_ledger',
  'fetching_account',
  'building_tx',
  'awaiting_confirmation',
  'signing',
  'submitting',
  'done',
];

export default function ProcessingScreen({navigation, route}: Props) {
  const {sessionId} = route.params;
  const {buyerStep, buyerError, setBuyerStep, setBuyerError, reset} =
    useSessionStore();
  const ran = useRef(false);
  const transportRef = useRef<any>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    runPaymentFlow();

    return () => {
      closeTransport(transportRef.current).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPaymentFlow() {
    let unsignedTx: XrplUnsignedTransaction | null = null;

    try {
      // ── Step 1: Mark session awaiting signature ────────────────────────────
      setBuyerStep('preparing_payment');
      await updateSessionStatus(sessionId, 'AWAITING_SIGNATURE');

      // ── Step 2: Get unsigned transaction from backend ──────────────────────
      let preparePayload: PrepareSessionResponse | null = null;
      try {
        preparePayload = await prepareSession(sessionId);
        unsignedTx = preparePayload.unsignedTx as XrplUnsignedTransaction;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'PREPARE_NOT_IMPLEMENTED') {
          unsignedTx = null;
        } else {
          throw e;
        }
      }

      // ── Steps 3–5: Use pre-warmed transport if available ───────────────────
      const prewarm = consumePrewarm();
      let transport: any;
      let address: string;
      let publicKey: string;

      if (prewarm.transport && prewarm.account) {
        // Fast path: CheckoutScreen already scanned, connected, and fetched account
        transport = prewarm.transport;
        address = prewarm.account.address;
        publicKey = prewarm.account.publicKey;
        transportRef.current = transport;
      } else {
        // Slow path: full BLE scan → connect → read account
        setBuyerStep('scanning_ledger');
        const device = await findFirstLedgerDevice();

        setBuyerStep('connecting_ledger');
        transport = await openTransport(device);
        transportRef.current = transport;

        setBuyerStep('fetching_account');
        ({address, publicKey} = await getXrplAccount(transport));
      }

      // ── Step 6: Build unsigned transaction (fallback path) ─────────────────
      setBuyerStep('building_tx');
      if (unsignedTx === null) {
        // Backend /prepare not available — build client-side
        const session = await getSession(sessionId);
        const networkParams = await fetchNetworkParams(address);
        unsignedTx = buildUnsignedTxFromSession({
          destinationAddress: session.destinationAddress,
          amountDrops: session.amountDrops,
          memo: session.memo,
          ...networkParams,
        });
      }

      const txHex = encodeForSigning(unsignedTx, address, publicKey);

      // ── Step 7: User approves on Ledger ────────────────────────────────────
      setBuyerStep('awaiting_confirmation');
      const signatureHex = await signXrplTransaction(transport, txHex);
      setBuyerStep('signing'); // briefly, then submitting

      // ── Step 8: Build final signed blob ───────────────────────────────────
      const signedBlob = buildSignedBlob(unsignedTx, address, publicKey, signatureHex);

      // ── Step 9: Submit to backend ──────────────────────────────────────────
      setBuyerStep('submitting');
      const result = await submitSignedBlob(sessionId, signedBlob);

      // ── Done ───────────────────────────────────────────────────────────────
      await closeTransport(transport);
      transportRef.current = null;
      setBuyerStep('done');
      navigation.replace('Success', {sessionId, txHash: result.txHash});
    } catch (e: unknown) {
      await closeTransport(transportRef.current);
      transportRef.current = null;
      setBuyerStep('error');
      setBuyerError(extractApiErrorMessage(e));
    }
  }

  function handleRetry() {
    reset();
    navigation.goBack();
  }

  const label = STEP_LABELS[buyerStep];
  const subtext = STEP_SUBTEXT[buyerStep];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconArea}>
          {buyerStep === 'error' ? (
            <Text style={styles.errorIcon}>✕</Text>
          ) : buyerStep === 'awaiting_confirmation' ? (
            <View style={styles.ledgerIconBox}>
              <Text style={styles.ledgerIcon}>▣</Text>
              <Text style={styles.ledgerIconLabel}>LEDGER NANO X</Text>
            </View>
          ) : buyerStep === 'done' ? (
            <Text style={styles.doneIcon}>✓</Text>
          ) : (
            <ActivityIndicator size="large" color="#2563EB" />
          )}
        </View>

        <Text style={styles.stepLabel}>{label}</Text>

        {subtext ? (
          <Text style={styles.stepSubtext}>{subtext}</Text>
        ) : null}

        {buyerStep === 'error' && (
          <View style={styles.errorSection}>
            {buyerError ? (
              <Text style={styles.errorDetail}>{buyerError}</Text>
            ) : null}
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Go Back & Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.progressDots}>
          {PROGRESS_STEPS.map(step => (
            <ProgressDot key={step} step={step} current={buyerStep} />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function ProgressDot({step, current}: {step: BuyerStep; current: BuyerStep}) {
  const currentIdx = STEP_ORDER.indexOf(current);
  const stepIdx = STEP_ORDER.indexOf(step);
  const isCompleted = currentIdx > stepIdx && current !== 'error';
  const isActive = current === step || (step === 'awaiting_confirmation' && current === 'signing');

  return (
    <View
      style={[
        dotStyles.dot,
        isCompleted && dotStyles.completed,
        isActive && dotStyles.active,
      ]}
    />
  );
}

const dotStyles = StyleSheet.create({
  dot: {width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border},
  completed: {backgroundColor: Colors.success},
  active: {backgroundColor: Colors.primary, width: 28, borderRadius: 4},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 18,
  },
  iconArea: {marginBottom: 4, alignItems: 'center'},
  errorIcon: {fontSize: 52, color: Colors.error},
  doneIcon: {fontSize: 52, color: Colors.success},
  ledgerIconBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ledgerIcon: {fontSize: 44, color: Colors.textPrimary},
  ledgerIconLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textTertiary,
    letterSpacing: 2,
  },
  stepLabel: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  stepSubtext: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  errorSection: {gap: 14, alignItems: 'center', marginTop: 4},
  errorDetail: {
    fontSize: Typography.sm,
    color: Colors.error,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  retryButton: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryButtonText: {color: Colors.textSecondary, fontSize: Typography.base, fontWeight: Typography.semibold},
  progressDots: {flexDirection: 'row', gap: 8, marginTop: 36},
});
