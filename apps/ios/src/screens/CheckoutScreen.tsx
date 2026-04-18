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
import AmountDisplay from '../components/AmountDisplay';
import SessionStatusBadge from '../components/SessionStatusBadge';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

export default function CheckoutScreen({navigation, route}: Props) {
  const {sessionId} = route.params;
  const {session, loading, error} = useSession(sessionId);

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
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Session not found</Text>
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
          <Text style={styles.errorEmoji}>⏱</Text>
          <Text style={styles.errorTitle}>Session Expired</Text>
          <Text style={styles.errorBody}>Ask the merchant to create a new session.</Text>
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
          <Text style={styles.errorEmoji}>✗</Text>
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

  const canApprove = !['PAID', 'FAILED', 'EXPIRED', 'SUBMITTED', 'VALIDATING'].includes(session.status);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.merchantRow}>
          <View style={styles.merchantAvatar}>
            <Text style={styles.merchantInitial}>{session.merchantName[0]}</Text>
          </View>
          <View>
            <Text style={styles.merchantName}>{session.merchantName}</Text>
            <Text style={styles.merchantLabel}>Merchant</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.itemName}>{session.itemName}</Text>
          <AmountDisplay amountDisplay={session.amountDisplay} currency={session.currency} />
          <View style={styles.statusRow}>
            <SessionStatusBadge status={session.status} />
          </View>
        </View>

        <View style={styles.detailsCard}>
          <DetailRow label="Destination" value={`${session.destinationAddress.slice(0, 8)}...${session.destinationAddress.slice(-6)}`} mono />
          <DetailRow label="Session ID" value={session.id} mono />
          {session.memo && <DetailRow label="Memo" value={session.memo} />}
        </View>

        <View style={styles.ledgerNote}>
          <Text style={styles.ledgerNoteText}>
            Your Ledger Nano X will sign this transaction. Your private key never leaves the device.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.approveButton, !canApprove && styles.approveButtonDisabled]}
          onPress={handleApprove}
          disabled={!canApprove}>
          <Text style={styles.approveButtonText}>Approve with Ledger →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({label, value, mono}: {label: string; value: string; mono?: boolean}) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={[detailStyles.value, mono && detailStyles.mono]} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1F2937'},
  label: {fontSize: 13, color: '#6B7280', fontWeight: '500'},
  value: {fontSize: 13, color: '#D1D5DB', flex: 1, textAlign: 'right', marginLeft: 16},
  mono: {fontFamily: 'Courier', fontSize: 12},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0A0F'},
  centered: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24},
  loadingText: {color: '#6B7280', fontSize: 15, marginTop: 12},
  errorEmoji: {fontSize: 48},
  errorTitle: {fontSize: 22, fontWeight: '700', color: '#FFFFFF'},
  errorBody: {fontSize: 14, color: '#6B7280', textAlign: 'center'},
  backButton: {marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#111827', borderRadius: 10},
  backButtonText: {color: '#9CA3AF', fontSize: 15, fontWeight: '600'},
  content: {padding: 24, gap: 20},
  merchantRow: {flexDirection: 'row', alignItems: 'center', gap: 14},
  merchantAvatar: {width: 48, height: 48, borderRadius: 24, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center'},
  merchantInitial: {fontSize: 22, fontWeight: '800', color: '#FFFFFF'},
  merchantName: {fontSize: 18, fontWeight: '700', color: '#FFFFFF'},
  merchantLabel: {fontSize: 12, color: '#6B7280', marginTop: 2},
  card: {backgroundColor: '#111827', borderRadius: 16, padding: 20, gap: 8},
  itemName: {fontSize: 16, color: '#9CA3AF', marginBottom: 4},
  statusRow: {marginTop: 8},
  detailsCard: {backgroundColor: '#111827', borderRadius: 16, paddingHorizontal: 16, paddingBottom: 4},
  ledgerNote: {backgroundColor: '#0F172A', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1E3A5F'},
  ledgerNoteText: {fontSize: 13, color: '#60A5FA', lineHeight: 20},
  footer: {paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8},
  approveButton: {backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 18, alignItems: 'center'},
  approveButtonDisabled: {backgroundColor: '#1F2937'},
  approveButtonText: {fontSize: 17, fontWeight: '700', color: '#FFFFFF'},
});
