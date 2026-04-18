import React from 'react';
import {View, Text, StyleSheet, SafeAreaView, TouchableOpacity} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CommonActions} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/types';
import TxHashLink from '../components/TxHashLink';
import {useSessionStore} from '../store/sessionStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

export default function SuccessScreen({navigation, route}: Props) {
  const {txHash} = route.params;
  const reset = useSessionStore(s => s.reset);

  function handleHome() {
    reset();
    navigation.dispatch(
      CommonActions.reset({index: 0, routes: [{name: 'Home'}]}),
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkmark}>✓</Text>
        </View>

        <Text style={styles.title}>Payment Sent</Text>
        <Text style={styles.subtitle}>
          Your transaction has been submitted to the XRP Ledger.
        </Text>

        <View style={styles.txCard}>
          <Text style={styles.txLabel}>Transaction</Text>
          <TxHashLink txHash={txHash} />
        </View>

        <View style={styles.ledgerConfirm}>
          <Text style={styles.ledgerConfirmText}>
            Signed and approved by your Ledger Nano X
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.homeButton} onPress={handleHome}>
          <Text style={styles.homeButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0A0F'},
  content: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 20},
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#052E16',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  checkmark: {fontSize: 44, color: '#10B981'},
  title: {fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5},
  subtitle: {fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24},
  txCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    gap: 4,
  },
  txLabel: {fontSize: 12, fontWeight: '600', color: '#4B5563', letterSpacing: 1, textTransform: 'uppercase'},
  ledgerConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  ledgerConfirmText: {fontSize: 13, color: '#60A5FA'},
  footer: {paddingHorizontal: 24, paddingBottom: 16},
  homeButton: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  homeButtonText: {fontSize: 17, fontWeight: '600', color: '#D1D5DB'},
});
