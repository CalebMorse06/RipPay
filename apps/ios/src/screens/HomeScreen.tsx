import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({navigation}: Props) {
  const [sessionId, setSessionId] = useState('');

  function handleManualEntry() {
    const id = sessionId.trim();
    if (!id) {
      Alert.alert('Enter a session ID', 'Paste or type the session ID from the merchant.');
      return;
    }
    navigation.navigate('Checkout', {sessionId: id});
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.logo}>ColdTap</Text>
          <Text style={styles.tagline}>Self-custody XRPL checkout</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Session ID</Text>
          <TextInput
            style={styles.input}
            value={sessionId}
            onChangeText={setSessionId}
            placeholder="Paste session ID"
            placeholderTextColor="#4B5563"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleManualEntry}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleManualEntry}>
            <Text style={styles.primaryButtonText}>Load Session</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.altActions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => Alert.alert('QR Scanner', 'QR scanning coming in Phase 2')}>
            <Text style={styles.secondaryIcon}>⬜</Text>
            <Text style={styles.secondaryButtonText}>Scan QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => Alert.alert('NFC', 'NFC tap coming in Phase 4')}>
            <Text style={styles.secondaryIcon}>📡</Text>
            <Text style={styles.secondaryButtonText}>Tap to Pay (NFC)</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by XRPL · Secured by Ledger</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0A0F'},
  content: {flex: 1, paddingHorizontal: 24, justifyContent: 'center'},
  hero: {alignItems: 'center', marginBottom: 48},
  logo: {fontSize: 42, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1},
  tagline: {fontSize: 15, color: '#6B7280', marginTop: 6},
  section: {gap: 12},
  label: {fontSize: 13, fontWeight: '600', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase'},
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Courier',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {fontSize: 16, fontWeight: '700', color: '#FFFFFF'},
  divider: {flexDirection: 'row', alignItems: 'center', marginVertical: 28, gap: 12},
  dividerLine: {flex: 1, height: 1, backgroundColor: '#1F2937'},
  dividerText: {fontSize: 13, color: '#4B5563'},
  altActions: {gap: 12},
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  secondaryIcon: {fontSize: 20},
  secondaryButtonText: {fontSize: 16, color: '#D1D5DB', fontWeight: '500'},
  footer: {paddingBottom: 24, alignItems: 'center'},
  footerText: {fontSize: 12, color: '#374151'},
});
