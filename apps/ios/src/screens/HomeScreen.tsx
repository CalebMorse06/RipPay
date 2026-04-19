import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Clipboard,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import QRScannerModal from '../components/QRScannerModal';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/types';
import {useSessionStore} from '../store/sessionStore';
import {parseLinkIntent} from '../utils/linkParser';
import {readMerchantPayload, humanizeNFCError} from '../nfc/MerchantNFCReader';
import {loadHistory, timeAgo, type TxRecord} from '../utils/txHistory';
import {Colors, Typography, Radius, Shadow} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({navigation}: Props) {
  const [devInput, setDevInput] = useState('');
  const [devVisible, setDevVisible] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [history, setHistory] = useState<TxRecord[]>([]);
  const reset = useSessionStore(s => s.reset);

  useEffect(() => {
    reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload history every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setHistory);
    }, []),
  );

  async function handleTapMerchant() {
    setNfcError(null);
    setNfcScanning(true);
    try {
      const intent = await readMerchantPayload();
      if (intent.type === 'unknown') {
        throw new Error('Unrecognized payload — check Android app');
      }
      navigateFromInput(
        intent.type === 'session'
          ? `coldtap://session/${intent.sessionId}`
          : `coldtap://merchant/${intent.merchantId}`,
      );
    } catch (e: any) {
      setNfcError(humanizeNFCError(e?.message));
    } finally {
      setNfcScanning(false);
    }
  }

  function navigateFromInput(raw: string) {
    const intent = parseLinkIntent(raw.trim());
    if (intent.type === 'merchant') {
      navigation.navigate('MerchantLanding', {merchantId: intent.merchantId});
    } else if (intent.type === 'session') {
      navigation.navigate('Checkout', {sessionId: intent.sessionId});
    } else {
      Alert.alert('Not recognized', 'Paste a session ID or ColdTap link.');
    }
  }

  function handleDevLoad() {
    if (!devInput.trim()) return;
    navigateFromInput(devInput);
  }

  async function handlePaste() {
    try {
      const text = await Clipboard.getString();
      if (text?.trim()) {
        navigateFromInput(text.trim());
        return;
      }
    } catch {}
    Alert.alert('Nothing to paste', 'Copy a session ID or payment link first.');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>RipPay</Text>
          <Text style={styles.tagline}>Tap. Sign. Settle.</Text>
        </View>

        {/* Primary CTA — Tap to Pay */}
        <TouchableOpacity
          style={[styles.tapCard, nfcScanning && styles.tapCardActive]}
          onPress={handleTapMerchant}
          disabled={nfcScanning}
          activeOpacity={0.85}>
          <View style={[styles.tapIconWrap, nfcScanning && styles.tapIconWrapActive]}>
            {nfcScanning
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.tapIcon}>⬡</Text>
            }
          </View>
          <View style={styles.tapTextWrap}>
            <Text style={styles.tapHeading}>
              {nfcScanning ? 'Hold near merchant phone…' : 'Tap to Pay'}
            </Text>
            <Text style={styles.tapBody}>
              {nfcScanning
                ? 'Keep your iPhone close until it connects'
                : 'Hold your iPhone near the merchant device'}
            </Text>
          </View>
          {!nfcScanning && <Text style={styles.tapChevron}>›</Text>}
        </TouchableOpacity>

        {nfcError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{nfcError}</Text>
          </View>
        ) : null}

        {/* Secondary actions */}
        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handlePaste} activeOpacity={0.7}>
            <Text style={styles.secondaryIcon}>⎘</Text>
            <Text style={styles.secondaryButtonText}>Paste link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setQrVisible(true)}
            activeOpacity={0.7}>
            <Text style={styles.secondaryIcon}>▦</Text>
            <Text style={styles.secondaryButtonText}>Scan QR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setDevVisible(v => !v)}
            activeOpacity={0.7}>
            <Text style={styles.secondaryIcon}>#</Text>
            <Text style={styles.secondaryButtonText}>Enter ID</Text>
          </TouchableOpacity>
        </View>

        <QRScannerModal
          visible={qrVisible}
          onScan={raw => { setQrVisible(false); navigateFromInput(raw); }}
          onClose={() => setQrVisible(false)}
        />

        {devVisible && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={devInput}
              onChangeText={setDevInput}
              placeholder="Session ID or link"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleDevLoad}
            />
            <TouchableOpacity style={styles.goButton} onPress={handleDevLoad}>
              <Text style={styles.goButtonText}>Go</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent payments */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            <View style={styles.historyList}>
              {history.slice(0, 5).map((tx, i) => (
                <HistoryRow key={tx.txHash} tx={tx} last={i === Math.min(history.length, 5) - 1} />
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>🔒 Ledger-secured · Settled on XRPL</Text>
      </View>
    </SafeAreaView>
  );
}

function HistoryRow({tx, last}: {tx: TxRecord; last: boolean}) {
  const initial = tx.merchantName[0]?.toUpperCase() ?? '?';
  return (
    <View style={[histStyles.row, last && histStyles.lastRow]}>
      <View style={histStyles.avatar}>
        <Text style={histStyles.initial}>{initial}</Text>
      </View>
      <View style={histStyles.info}>
        <Text style={histStyles.merchant}>{tx.merchantName}</Text>
        <Text style={histStyles.item} numberOfLines={1}>{tx.itemName}</Text>
      </View>
      <View style={histStyles.right}>
        <Text style={histStyles.amount}>
          {tx.pricedInFiat && tx.fiatDisplay ? tx.fiatDisplay : `${tx.amountDisplay} XRP`}
        </Text>
        <Text style={histStyles.time}>{timeAgo(tx.completedAt)}</Text>
      </View>
    </View>
  );
}

const histStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  lastRow: {borderBottomWidth: 0},
  avatar: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textSecondary,
  },
  info: {flex: 1},
  merchant: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  item: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  right: {alignItems: 'flex-end'},
  amount: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  time: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 16,
  },
  header: {alignItems: 'center', paddingVertical: 16},
  logo: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  tapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
    ...Shadow.button,
  },
  tapCardActive: {
    borderColor: Colors.primaryDark,
    backgroundColor: '#EBF0FF',
  },
  tapIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapIconWrapActive: {
    backgroundColor: Colors.primaryDark,
  },
  tapIcon: {fontSize: 22, color: '#FFFFFF'},
  tapTextWrap: {flex: 1},
  tapHeading: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.primaryDark,
  },
  tapBody: {
    fontSize: Typography.xs,
    color: Colors.primary,
    marginTop: 3,
    lineHeight: 17,
  },
  tapChevron: {
    fontSize: 26,
    color: Colors.primary,
  },
  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: Typography.sm,
    color: Colors.error,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 13,
  },
  secondaryIcon: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  secondaryButtonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
  },
  goButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  goButtonText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textOnPrimary,
  },
  historySection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  historyList: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  footer: {
    paddingBottom: 20,
    paddingTop: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
  },
});
