import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Wallet} from 'xrpl';
import {RootStackParamList} from '../navigation/types';
import {saveSeed} from '../signing/LocalSigner';
import {setSigningMethod, setLocalWalletAddress} from '../utils/signingPrefs';
import {Colors, Typography, Radius, Shadow} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'WalletSetup'>;

type Stage = 'input' | 'confirm' | 'saving';

export default function WalletSetupScreen({navigation}: Props) {
  const [seed, setSeed] = useState('');
  const [seedVisible, setSeedVisible] = useState(false);
  const [stage, setStage] = useState<Stage>('input');
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleValidate() {
    setError(null);
    const trimmed = seed.trim();
    if (!trimmed) {
      setError('Paste your XRPL seed.');
      return;
    }
    try {
      const wallet = Wallet.fromSeed(trimmed);
      setDerivedAddress(wallet.classicAddress);
      setStage('confirm');
    } catch {
      setError('That doesn\'t look like a valid XRPL family seed.');
    }
  }

  async function handleConfirm() {
    if (!derivedAddress) return;
    setStage('saving');
    setError(null);
    try {
      const addr = await saveSeed(seed.trim());
      await setSigningMethod('local');
      await setLocalWalletAddress(addr);
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save seed to the keychain.');
      setStage('confirm');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Wallet</Text>
        <View style={styles.backSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">

          <View style={styles.warningBanner}>
            <Text style={styles.warningTitle}>Your seed stays on this device</Text>
            <Text style={styles.warningBody}>
              RipPay never sees or uploads your seed. It's stored in the iOS keychain and every
              payment requires Face ID. For larger amounts, we still recommend a Ledger Nano X.
            </Text>
          </View>

          {stage === 'input' && (
            <>
              <View style={styles.labelRow}>
                <Text style={styles.label}>XRPL FAMILY SEED</Text>
                <TouchableOpacity onPress={() => setSeedVisible(v => !v)}>
                  <Text style={styles.toggle}>{seedVisible ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={seed}
                onChangeText={setSeed}
                placeholder={seedVisible ? 'sEd… or s…' : '••••••••••••'}
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                multiline={seedVisible}
                numberOfLines={seedVisible ? 3 : 1}
                secureTextEntry={!seedVisible}
              />
              <Text style={styles.hint}>
                Starts with <Text style={styles.mono}>sEd</Text> (ed25519) or{' '}
                <Text style={styles.mono}>s</Text> (secp256k1). We don't accept mnemonics yet.
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryButton, !seed.trim() && styles.primaryButtonDisabled]}
                onPress={handleValidate}
                disabled={!seed.trim()}>
                <Text style={styles.primaryButtonText}>Validate</Text>
              </TouchableOpacity>
            </>
          )}

          {(stage === 'confirm' || stage === 'saving') && derivedAddress && (
            <>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmLabel}>IS THIS YOUR WALLET?</Text>
                <Text style={styles.confirmAddress} selectable>
                  {derivedAddress}
                </Text>
                <Text style={styles.confirmHint}>
                  If this isn't the address you expected, stop — the wrong seed will send funds to
                  someone else.
                </Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryButton, stage === 'saving' && styles.primaryButtonDisabled]}
                onPress={handleConfirm}
                disabled={stage === 'saving'}>
                {stage === 'saving' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Confirm & Save</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setStage('input');
                  setDerivedAddress(null);
                }}
                disabled={stage === 'saving'}>
                <Text style={styles.secondaryButtonText}>Use a different seed</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back: {fontSize: Typography.base, color: Colors.primary, fontWeight: Typography.medium, minWidth: 70},
  backSpacer: {minWidth: 70},
  title: {fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary},
  content: {padding: 20, gap: 14},
  warningBanner: {
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 4,
  },
  warningTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.warning,
  },
  warningBody: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  label: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
  toggle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.primary,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: 'Courier',
  },
  hint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  mono: {fontFamily: 'Courier', color: Colors.textSecondary},
  errorText: {
    fontSize: Typography.sm,
    color: Colors.error,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...Shadow.button,
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.surfaceAlt,
    shadowOpacity: 0,
  },
  primaryButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  confirmCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    ...Shadow.card,
  },
  confirmLabel: {
    fontSize: 10,
    fontWeight: Typography.bold,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
  },
  confirmAddress: {
    fontFamily: 'Courier',
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  confirmHint: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
