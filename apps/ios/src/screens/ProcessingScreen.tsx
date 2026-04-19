import React, {useEffect, useRef, useState} from 'react';
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
  waitForFinalStatus,
  extractApiErrorMessage,
  ApiError,
} from '../api/sessions';
import {buildUnsignedTxFromSession} from '../ledger/TransactionBuilder';
import {fetchNetworkParams} from '../ledger/xrplNetwork';
import type {XrplUnsignedTransaction, PrepareSessionResponse} from '@coldtap/shared';
import {Colors, Typography, Radius} from '../theme';
import {saveTx} from '../utils/txHistory';
import {getActiveSigner} from '../signing/getSigner';
import type {Signer} from '../signing/Signer';
import {getSigningMethod, type SigningMethod} from '../utils/signingPrefs';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;

const STEP_LABELS: Record<BuyerStep, string> = {
  idle: 'Starting…',
  preparing_payment: 'Preparing payment…',
  scanning_ledger: 'Looking for Ledger…',
  connecting_ledger: 'Connecting to Ledger…',
  fetching_account: 'Reading your XRPL account…',
  building_tx: 'Building transaction…',
  awaiting_confirmation: 'Confirm on your Ledger',
  unlocking_wallet: 'Approve with Face ID…',
  signing: 'Signing…',
  submitting: 'Submitting to XRPL…',
  validating: 'Confirming on XRPL…',
  done: 'Complete',
  error: 'Something went wrong',
};

const STEP_SUBTEXT: Partial<Record<BuyerStep, string>> = {
  scanning_ledger: 'Make sure Bluetooth is on and the XRP app is open on your Ledger',
  connecting_ledger: 'Opening secure channel to Ledger Nano X…',
  awaiting_confirmation: 'Review the amount and destination on your Ledger,\nthen press both buttons to approve',
  unlocking_wallet: 'iOS will ask you to approve this payment with Face ID',
  submitting: 'Your signed transaction is being broadcast to the network',
  validating: 'Waiting for the XRPL ledger to include your payment — this usually takes a few seconds',
};

const STEP_ORDER: BuyerStep[] = [
  'idle',
  'preparing_payment',
  'scanning_ledger',
  'connecting_ledger',
  'fetching_account',
  'building_tx',
  'awaiting_confirmation',
  'unlocking_wallet',
  'signing',
  'submitting',
  'validating',
  'done',
];

export default function ProcessingScreen({navigation, route}: Props) {
  const {sessionId} = route.params;
  const {buyerStep, buyerError, setBuyerStep, setBuyerError, reset} =
    useSessionStore();
  const ran = useRef(false);
  const signerRef = useRef<Signer | null>(null);
  const [progressSteps, setProgressSteps] = useState<BuyerStep[]>([
    'scanning_ledger',
    'fetching_account',
    'building_tx',
    'awaiting_confirmation',
    'submitting',
    'validating',
  ]);
  const [validatingSlow, setValidatingSlow] = useState(false);

  useEffect(() => {
    if (buyerStep !== 'validating') {
      setValidatingSlow(false);
      return;
    }
    const t = setTimeout(() => setValidatingSlow(true), 30_000);
    return () => clearTimeout(t);
  }, [buyerStep]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    runPaymentFlow();

    return () => {
      signerRef.current?.cleanup().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPaymentFlow() {
    let unsignedTx: XrplUnsignedTransaction | null = null;
    let signingMethod: SigningMethod = 'ledger';

    try {
      // ── Step 1: Pick a signer and advertise its progress steps ─────────────
      const signer = await getActiveSigner();
      signerRef.current = signer;
      signingMethod = await getSigningMethod();
      setProgressSteps(signer.progressSteps());

      // ── Step 2: Mark session awaiting signature ────────────────────────────
      setBuyerStep('preparing_payment');
      await updateSessionStatus(sessionId, 'AWAITING_SIGNATURE');

      // ── Step 3: Get unsigned transaction from backend ──────────────────────
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

      // ── Step 4: Acquire signing identity (BLE scan or Face ID) ─────────────
      const {address, publicKey} = await signer.prepare(setBuyerStep);

      // ── Step 5: Build / autofill unsigned transaction ──────────────────────
      setBuyerStep('building_tx');
      if (unsignedTx === null) {
        const session = await getSession(sessionId);
        const networkParams = await fetchNetworkParams(address);
        unsignedTx = buildUnsignedTxFromSession({
          destinationAddress: session.destinationAddress,
          amountDrops: session.amountDrops,
          memo: session.memo,
          ...networkParams,
        });
      } else if (
        typeof unsignedTx.Sequence !== 'number' ||
        typeof unsignedTx.LastLedgerSequence !== 'number'
      ) {
        const params = await fetchNetworkParams(address);
        unsignedTx = {
          ...unsignedTx,
          Sequence: params.sequence,
          LastLedgerSequence: params.lastLedgerSequence,
          Fee: unsignedTx.Fee ?? params.fee,
        };
      }

      // ── Step 6: Sign ───────────────────────────────────────────────────────
      const signedBlob = await signer.sign(unsignedTx, address, publicKey, setBuyerStep);

      // ── Step 7: Submit to backend ──────────────────────────────────────────
      setBuyerStep('submitting');
      const result = await submitSignedBlob(sessionId, signedBlob);

      // ── Step 8: Wait for XRPL to validate ─────────────────────────────────
      // The backend returns SUBMITTED immediately; validation runs async in an
      // after() task. Poll until the network says PAID or FAILED — otherwise
      // we'd show "Complete" on a tx that later fails (e.g. tecUNFUNDED).
      setBuyerStep('validating');
      const finalSession = await waitForFinalStatus(sessionId);

      if (finalSession.status === 'FAILED') {
        throw new ApiError(
          'XRPL_REJECTED',
          finalSession.failureReason
            ? `Payment rejected by XRPL: ${finalSession.failureReason}`
            : 'Payment was rejected by the XRPL network.',
        );
      }
      if (finalSession.status === 'EXPIRED') {
        throw new ApiError('EXPIRED', 'This session expired before the payment was confirmed.');
      }

      // ── Done ───────────────────────────────────────────────────────────────
      await signer.cleanup();
      signerRef.current = null;
      setBuyerStep('done');

      const sessionData = finalSession;
      await saveTx({
        txHash: result.txHash,
        sessionId,
        merchantName: sessionData.merchantName,
        itemName: sessionData.itemName,
        amountDisplay: sessionData.amountDisplay,
        amountDrops: sessionData.amountDrops,
        destinationAddress: sessionData.destinationAddress,
        fiatDisplay: sessionData.fiatDisplay,
        pricedInFiat: Boolean(sessionData.fiatAmount),
        signedVia: signingMethod,
        completedAt: new Date().toISOString(),
      }).catch(() => {});

      navigation.replace('Success', {
        sessionId,
        txHash: result.txHash,
        merchantName: sessionData.merchantName,
        itemName: sessionData.itemName,
        amountDisplay: sessionData.amountDisplay,
        fiatDisplay: sessionData.fiatDisplay,
        pricedInFiat: Boolean(sessionData.fiatAmount),
        signedVia: signingMethod,
        network: sessionData.network,
      });
    } catch (e: unknown) {
      await signerRef.current?.cleanup().catch(() => {});
      signerRef.current = null;
      setBuyerStep('error');
      setBuyerError(extractApiErrorMessage(e));
    }
  }

  function handleRetry() {
    reset();
    navigation.goBack();
  }

  const label = STEP_LABELS[buyerStep];
  const subtext =
    buyerStep === 'validating' && validatingSlow
      ? 'Still confirming — XRPL is busy right now. Your transaction is broadcast; we\'re just waiting for a validator to include it.'
      : STEP_SUBTEXT[buyerStep];

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
            <ActivityIndicator size="large" color={Colors.primary} />
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
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.progressDots}>
          {progressSteps.map(step => (
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
