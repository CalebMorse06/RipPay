import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useSessionStore} from '../store/sessionStore';
import {parseLinkIntent} from '../utils/linkParser';
import {readMerchantPayload, humanizeNFCError} from '../nfc/MerchantNFCReader';
import {Colors, Typography, Radius, Shadow} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({navigation}: Props) {
  const [devInput, setDevInput] = useState('');
  const [devVisible, setDevVisible] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const reset = useSessionStore(s => s.reset);

  useEffect(() => {
    reset();
  }, [reset]);

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
      <View style={styles.content}>

        {/* Wordmark */}
        <View style={styles.hero}>
          <Text style={styles.logo}>ColdTap</Text>
          <Text style={styles.tagline}>Secure XRPL payments</Text>
        </View>

        {/* NFC tap card */}
        <TouchableOpacity
          style={[styles.tapCard, nfcScanning && styles.tapCardActive]}
          onPress={handleTapMerchant}
          disabled={nfcScanning}
          activeOpacity={0.85}>
          <View style={styles.tapIconWrap}>
            {nfcScanning
              ? <ActivityIndicator size="small" color={Colors.primary} />
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
                : 'Hold your iPhone near the merchant phone'}
            </Text>
          </View>
          {!nfcScanning && (
            <Text style={styles.tapChevron}>›</Text>
          )}
        </TouchableOpacity>

        {nfcError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{nfcError}</Text>
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Paste */}
        <TouchableOpacity style={styles.secondaryButton} onPress={handlePaste}>
          <Text style={styles.secondaryButtonText}>Paste payment link</Text>
        </TouchableOpacity>

        {/* Manual entry toggle */}
        <TouchableOpacity
          style={styles.devToggle}
          onPress={() => setDevVisible(v => !v)}>
          <Text style={styles.devToggleText}>
            {devVisible ? 'Hide manual entry' : 'Enter session ID'}
          </Text>
        </TouchableOpacity>

        {devVisible && (
          <View style={styles.devSection}>
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
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Secured by Ledger · Settled on XRPL</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 14,
  },
  hero: {alignItems: 'center', marginBottom: 8},
  logo: {
    fontSize: Typography.xxl,
    fontWeight: Typography.heavy,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  tapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
    ...Shadow.card,
  },
  tapCardActive: {
    borderColor: Colors.primaryDark,
    backgroundColor: '#DAF0FF',
  },
  tapIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapIcon: {fontSize: 20, color: '#FFFFFF'},
  tapTextWrap: {flex: 1},
  tapHeading: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.primaryDark,
  },
  tapBody: {
    fontSize: Typography.xs,
    color: Colors.primary,
    marginTop: 2,
  },
  tapChevron: {
    fontSize: 22,
    color: Colors.primary,
    fontWeight: Typography.regular,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {flex: 1, height: 1, backgroundColor: Colors.border},
  dividerText: {fontSize: Typography.sm, color: Colors.textTertiary},
  secondaryButton: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
  devToggle: {alignItems: 'center', paddingVertical: 2},
  devToggleText: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
  },
  devSection: {gap: 10},
  inputRow: {flexDirection: 'row', gap: 8},
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
  footer: {paddingBottom: 24, alignItems: 'center'},
  footerText: {fontSize: Typography.xs, color: Colors.textTertiary},
});
