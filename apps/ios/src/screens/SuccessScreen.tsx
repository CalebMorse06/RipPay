import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CommonActions} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/types';
import TxHashLink from '../components/TxHashLink';
import {useSessionStore} from '../store/sessionStore';
import {Colors, Typography, Radius, Shadow} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

export default function SuccessScreen({navigation, route}: Props) {
  const {txHash, merchantName, itemName, amountDisplay} = route.params;
  const reset = useSessionStore(s => s.reset);

  function handleHome() {
    reset();
    navigation.dispatch(
      CommonActions.reset({index: 0, routes: [{name: 'Home'}]}),
    );
  }

  const initial = merchantName?.[0]?.toUpperCase() ?? '?';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        {/* Success icon */}
        <View style={styles.iconWrap}>
          <View style={styles.checkRing}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        </View>

        <Text style={styles.title}>Payment Complete</Text>

        {/* Amount — hero element */}
        {amountDisplay ? (
          <View style={styles.amountWrap}>
            <Text style={styles.amountValue}>{amountDisplay}</Text>
            <Text style={styles.amountCurrency}>XRP</Text>
          </View>
        ) : null}

        {/* Merchant + item summary */}
        {merchantName ? (
          <View style={styles.merchantCard}>
            <View style={styles.merchantAvatar}>
              <Text style={styles.merchantInitial}>{initial}</Text>
            </View>
            <View style={styles.merchantInfo}>
              <Text style={styles.merchantName}>{merchantName}</Text>
              {itemName ? (
                <Text style={styles.itemName}>{itemName}</Text>
              ) : null}
            </View>
            <View style={styles.paidBadge}>
              <Text style={styles.paidBadgeText}>Paid</Text>
            </View>
          </View>
        ) : null}

        {/* Security badge */}
        <View style={styles.securityRow}>
          <View style={styles.securityBadge}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={styles.securityText}>Signed by Ledger Nano X</Text>
          </View>
          <View style={styles.xrplBadge}>
            <Text style={styles.xrplText}>Settled on XRPL</Text>
          </View>
        </View>

        {/* Transaction hash */}
        <View style={styles.txCard}>
          <Text style={styles.txLabel}>TRANSACTION</Text>
          <TxHashLink txHash={txHash} />
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneButton} onPress={handleHome}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 20,
  },
  iconWrap: {marginBottom: 4},
  checkRing: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: Colors.successLight,
    borderWidth: 3,
    borderColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {fontSize: 38, color: Colors.success},
  title: {
    fontSize: Typography.xl,
    fontWeight: Typography.heavy,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginVertical: 4,
  },
  amountValue: {
    fontSize: 52,
    fontWeight: Typography.heavy,
    color: Colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 58,
  },
  amountCurrency: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    gap: 12,
    ...Shadow.card,
  },
  merchantAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantInitial: {fontSize: 20, fontWeight: Typography.heavy, color: '#FFFFFF'},
  merchantInfo: {flex: 1},
  merchantName: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  itemName: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  paidBadge: {
    backgroundColor: Colors.successLight,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  paidBadgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.success,
    letterSpacing: 0.5,
  },
  securityRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  securityBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  securityIcon: {fontSize: 14},
  securityText: {
    fontSize: Typography.xs,
    color: Colors.primaryDark,
    fontWeight: Typography.medium,
    flex: 1,
  },
  xrplBadge: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  xrplText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  txCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    width: '100%',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  txLabel: {
    fontSize: 10,
    fontWeight: Typography.bold,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
    ...Shadow.button,
  },
  doneButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textOnPrimary,
  },
});
