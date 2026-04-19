import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/types';
import {
  getSigningMethod,
  setSigningMethod,
  getLocalWalletAddress,
  setLocalWalletAddress,
  type SigningMethod,
} from '../utils/signingPrefs';
import {hasStoredSeed, removeSeed} from '../signing/LocalSigner';
import {Colors, Typography, Radius, Shadow} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({navigation}: Props) {
  const [method, setMethodState] = useState<SigningMethod>('ledger');
  const [localAddress, setLocalAddressState] = useState<string | null>(null);
  const [hasSeed, setHasSeed] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [m, addr, stored] = await Promise.all([
        getSigningMethod(),
        getLocalWalletAddress(),
        hasStoredSeed(),
      ]);
      setMethodState(m);
      setLocalAddressState(addr);
      setHasSeed(stored);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  async function pickLedger() {
    await setSigningMethod('ledger');
    setMethodState('ledger');
  }

  async function pickLocal() {
    if (!hasSeed) {
      navigation.navigate('WalletSetup');
      return;
    }
    await setSigningMethod('local');
    setMethodState('local');
  }

  function confirmRemove() {
    Alert.alert(
      'Remove wallet from this device?',
      'RipPay will delete the seed from your Keychain. If you don\'t have your seed backed up somewhere else, you will lose access to this wallet and the funds in it.\n\nThis cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove wallet',
          style: 'destructive',
          onPress: async () => {
            await removeSeed();
            await setLocalWalletAddress(null);
            await setSigningMethod('ledger');
            await reload();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>SIGNING METHOD</Text>

        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{marginTop: 20}} />
        ) : (
          <>
            <MethodCard
              title="Ledger Nano X"
              subtitle="Hardware wallet · key never exposed"
              selected={method === 'ledger'}
              recommended
              onPress={pickLedger}
            />

            <MethodCard
              title="Sign on this phone"
              subtitle={
                hasSeed
                  ? 'Face ID required for every payment'
                  : 'Paste your XRPL seed · Face ID required'
              }
              selected={method === 'local'}
              onPress={pickLocal}
            />

            {hasSeed && (
              <View style={styles.walletCard}>
                <Text style={styles.walletLabel}>WALLET ON THIS DEVICE</Text>
                <Text style={styles.walletAddress} numberOfLines={1} ellipsizeMode="middle">
                  {localAddress ?? '—'}
                </Text>
                <TouchableOpacity style={styles.removeButton} onPress={confirmRemove}>
                  <Text style={styles.removeButtonText}>Remove wallet</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.footnote}>
              For larger amounts, we recommend using a Ledger Nano X. The seed stored on this
              device never leaves it — RipPay never sees it.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MethodCard({
  title,
  subtitle,
  selected,
  recommended,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  recommended?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[cardStyles.card, selected && cardStyles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={cardStyles.row}>
        <View style={cardStyles.textWrap}>
          <View style={cardStyles.titleRow}>
            <Text style={cardStyles.title}>{title}</Text>
            {recommended && (
              <View style={cardStyles.recommendedBadge}>
                <Text style={cardStyles.recommendedText}>RECOMMENDED</Text>
              </View>
            )}
          </View>
          <Text style={cardStyles.subtitle}>{subtitle}</Text>
        </View>
        <View style={[cardStyles.radio, selected && cardStyles.radioSelected]}>
          {selected && <View style={cardStyles.radioInner} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  textWrap: {flex: 1},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  title: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  recommendedBadge: {
    backgroundColor: Colors.successLight,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recommendedText: {
    fontSize: 9,
    fontWeight: Typography.bold,
    color: Colors.success,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {borderColor: Colors.primary},
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
});

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
  back: {fontSize: Typography.base, color: Colors.primary, fontWeight: Typography.medium, minWidth: 60},
  backSpacer: {minWidth: 60},
  title: {fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary},
  content: {padding: 20, gap: 12},
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  walletCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    marginTop: 4,
    ...Shadow.card,
  },
  walletLabel: {
    fontSize: 10,
    fontWeight: Typography.bold,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
  },
  walletAddress: {
    fontFamily: 'Courier',
    fontSize: Typography.sm,
    color: Colors.textPrimary,
  },
  removeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: Colors.errorLight,
  },
  removeButtonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.error,
  },
  footnote: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    lineHeight: 17,
    marginTop: 8,
  },
});
