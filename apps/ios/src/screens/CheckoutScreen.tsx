import React, {useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useSession} from '../hooks/useSession';
import {updateSessionStatus} from '../api/sessions';
import {useLedgerPrewarm, PrewarmStatus} from '../hooks/useLedgerPrewarm';
import AmountDisplay from '../components/AmountDisplay';
import SessionStatusBadge from '../components/SessionStatusBadge';
import {Colors, Typography, Radius, Shadow} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

export default function CheckoutScreen({navigation, route}: Props) {
  const {sessionId} = route.params;
  const {session, loading, error} = useSession(sessionId);

  const canApprove =
    session !== null &&
    !['PAID', 'FAILED', 'EXPIRED', 'SUBMITTED', 'VALIDATING'].includes(
      session.status,
    );

  const {status: prewarmStatus, failReason: prewarmFailReason} =
    useLedgerPrewarm(canApprove);

  useEffect(() => {
    if (session?.status === 'CREATED' || session?.status === 'AWAITING_BUYER') {
      updateSessionStatus(sessionId, 'AWAITING_BUYER').catch(() => {});
    }
  }, [session?.status, sessionId]);

  function handleApprove() {
    navigation.navigate('Processing', {sessionId});
  }

  if (loading && !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading checkout…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.errorIconWrap}>
            <Text style={styles.errorIconEmoji}>⚠</Text>
          </View>
          <Text style={styles.errorTitle}>Checkout not found</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (session?.status === 'EXPIRED') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.errorIconWrap}>
            <Text style={styles.errorIconEmoji}>⏱</Text>
          </View>
          <Text style={styles.errorTitle}>Session Expired</Text>
          <Text style={styles.errorBody}>Ask the merchant to create a new checkout.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (session?.status === 'FAILED') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={[styles.errorIconWrap, styles.errorIconWrapRed]}>
            <Text style={styles.errorIconEmoji}>✕</Text>
          </View>
          <Text style={styles.errorTitle}>Payment Failed</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (session?.status === 'PAID' && session.txHash) {
    navigation.replace('Success', {sessionId, txHash: session.txHash});
    return null;
  }

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        {/* Merchant header */}
        <View style={styles.merchantRow}>
          <View style={styles.merchantAvatar}>
            <Text style={styles.merchantInitial}>
              {session.merchantName[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.merchantInfo}>
            <Text style={styles.merchantName}>{session.merchantName}</Text>
            <Text style={styles.merchantLabel}>Merchant</Text>
          </View>
          <SessionStatusBadge status={session.status} />
        </View>

        {/* Amount card */}
        <View style={styles.amountCard}>
          <Text style={styles.itemName}>{session.itemName}</Text>
          <AmountDisplay
            amountDisplay={session.amountDisplay}
            currency={session.currency}
            fiatDisplay={session.fiatDisplay}
            pricedInFiat={Boolean(session.fiatAmount)}
          />
        </View>

        {/* Detail rows */}
        <View style={styles.detailsCard}>
          <DetailRow
            label="To"
            value={`${session.destinationAddress.slice(0, 8)}…${session.destinationAddress.slice(-6)}`}
            mono
          />
          {session.memo ? (
            <DetailRow label="Memo" value={session.memo} />
          ) : null}
          <DetailRow label="Session" value={session.id} mono last />
        </View>

        {/* Ledger readiness */}
        <SignerReadinessBanner status={prewarmStatus} failReason={prewarmFailReason} />
      </ScrollView>

      {/* Approve CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.approveButton, !canApprove && styles.approveButtonDisabled]}
          onPress={handleApprove}
          disabled={!canApprove}>
          <Text style={styles.approveButtonText}>Approve with Ledger</Text>
          {prewarmStatus === 'ready' && (
            <Text style={styles.approveButtonSub}>Signer ready</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({label, value, mono, last}: {
  label: string; value: string; mono?: boolean; last?: boolean;
}) {
  return (
    <View style={[detailStyles.row, last && detailStyles.lastRow]}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text
        style={[detailStyles.value, mono && detailStyles.mono]}
        numberOfLines={1}
        ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

function SignerReadinessBanner({status, failReason}: {
  status: PrewarmStatus; failReason: string | null;
}) {
  if (status === 'idle') return null;

  if (status === 'ready') {
    return (
      <View style={[bannerStyles.banner, bannerStyles.ready]}>
        <View style={bannerStyles.dot} />
        <Text style={[bannerStyles.text, bannerStyles.readyText]}>Ledger ready to sign</Text>
      </View>
    );
  }

  if (status === 'scanning' || status === 'connecting') {
    return (
      <View style={[bannerStyles.banner, bannerStyles.scanning]}>
        <ActivityIndicator size="small" color={Colors.primary} style={{marginRight: 8}} />
        <Text style={[bannerStyles.text, bannerStyles.scanningText]}>
          {status === 'scanning' ? 'Looking for Ledger…' : 'Connecting to Ledger…'}
        </Text>
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={[bannerStyles.banner, bannerStyles.failed]}>
        <View style={bannerStyles.failedContent}>
          <Text style={bannerStyles.failedText}>
            Ledger unavailable — {failReason ?? 'not found'}
          </Text>
          <Text style={bannerStyles.failedSub}>
            Unlock Ledger and open the XRP app before approving
          </Text>
        </View>
      </View>
    );
  }

  return null;
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lastRow: {borderBottomWidth: 0},
  label: {fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium},
  value: {
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  mono: {fontFamily: 'Courier', fontSize: 12},
});

const bannerStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginRight: 10,
  },
  text: {fontSize: Typography.sm, fontWeight: Typography.medium, flex: 1},
  ready: {backgroundColor: Colors.successLight, borderColor: '#A7F3D0'},
  readyText: {color: Colors.success},
  scanning: {backgroundColor: Colors.primaryLight, borderColor: '#BFDBFE'},
  scanningText: {color: Colors.primary},
  failed: {backgroundColor: Colors.errorLight, borderColor: '#FECACA'},
  failedContent: {flex: 1},
  failedText: {color: Colors.error, fontSize: Typography.sm, fontWeight: Typography.medium},
  failedSub: {fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 3},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {color: Colors.textSecondary, fontSize: Typography.base, marginTop: 12},
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconWrapRed: {backgroundColor: Colors.errorLight},
  errorIconEmoji: {fontSize: 32},
  errorTitle: {fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary},
  errorBody: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
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
  content: {padding: 20, gap: 14, paddingBottom: 8},
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  merchantAvatar: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantInitial: {fontSize: 20, fontWeight: Typography.heavy, color: '#FFFFFF'},
  merchantInfo: {flex: 1},
  merchantName: {fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary},
  merchantLabel: {fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 1},
  amountCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    ...Shadow.card,
  },
  itemName: {fontSize: Typography.sm, color: Colors.textSecondary},
  detailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  approveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
    gap: 3,
    ...Shadow.button,
  },
  approveButtonDisabled: {
    backgroundColor: Colors.surfaceAlt,
    shadowOpacity: 0,
  },
  approveButtonText: {fontSize: Typography.md, fontWeight: Typography.bold, color: '#FFFFFF'},
  approveButtonSub: {fontSize: Typography.xs, color: '#BFDBFE', fontWeight: Typography.medium},
});
