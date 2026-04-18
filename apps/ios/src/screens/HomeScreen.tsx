import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Linking,
  Clipboard,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useSessionStore} from '../store/sessionStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * Parse a session ID from raw user input.
 * Accepts:
 *   - bare session ID (e.g. "abc123")
 *   - full URL with /session/<id> path (e.g. https://app.coldtap.xyz/session/abc123)
 *   - deep link (e.g. coldtap://session/abc123)
 *   - URL with ?id= or ?session= query param
 */
export function parseSessionId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try URL parsing
  try {
    // Normalize: if it starts with coldtap:// make it parseable
    const normalized = trimmed.startsWith('coldtap://')
      ? trimmed.replace('coldtap://', 'https://coldtap.local/')
      : trimmed;

    const url = new URL(normalized);

    // Path-based: /session/<id>
    const parts = url.pathname.split('/').filter(Boolean);
    const sessionIdx = parts.findIndex(p => p === 'session' || p === 'sessions');
    if (sessionIdx >= 0 && parts[sessionIdx + 1]) {
      return parts[sessionIdx + 1];
    }

    // Query param: ?id=<id> or ?session=<id> or ?sessionId=<id>
    const qp = url.searchParams;
    const qid = qp.get('id') ?? qp.get('session') ?? qp.get('sessionId');
    if (qid) return qid;

    // Last path segment fallback if no other match
    if (parts.length === 1 && parts[0].length > 4) {
      return parts[0];
    }
  } catch {}

  // Not a URL — treat entire input as session ID
  return trimmed;
}

export default function HomeScreen({navigation}: Props) {
  const [input, setInput] = useState('');
  const reset = useSessionStore(s => s.reset);

  // Reset payment state when returning to Home
  useEffect(() => {
    reset();
  }, [reset]);

  // Handle incoming deep links while app is already open
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({url}) => {
      const id = parseSessionId(url);
      if (id) {
        setInput('');
        navigation.navigate('Checkout', {sessionId: id});
      }
    });
    return () => sub.remove();
  }, [navigation]);

  function handleLoad() {
    const id = parseSessionId(input);
    if (!id) {
      Alert.alert(
        'No session found',
        'Paste a session ID or a ColdTap payment link.',
      );
      return;
    }
    navigation.navigate('Checkout', {sessionId: id});
  }

  async function handlePaste() {
    try {
      const text = await Clipboard.getString();
      if (text?.trim()) {
        setInput(text.trim());
        const id = parseSessionId(text.trim());
        if (id) {
          navigation.navigate('Checkout', {sessionId: id});
          return;
        }
      }
    } catch {}
    Alert.alert('Nothing to paste', 'Copy a session ID or payment link first.');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.logo}>ColdTap</Text>
          <Text style={styles.tagline}>Self-custody XRPL checkout</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Session ID or Payment Link</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Paste session ID or link"
              placeholderTextColor="#4B5563"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleLoad}
            />
            <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste}>
              <Text style={styles.pasteBtnText}>Paste</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleLoad}>
            <Text style={styles.primaryButtonText}>Open Session →</Text>
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
            onPress={() =>
              Alert.alert(
                'QR Scanner',
                'Point at the merchant QR code to load the session.',
                [{text: 'OK'}],
              )
            }>
            <Text style={styles.secondaryIcon}>▦</Text>
            <View style={styles.secondaryTextBox}>
              <Text style={styles.secondaryButtonText}>Scan QR Code</Text>
              <Text style={styles.secondaryButtonSub}>Tap QR on merchant screen</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              Alert.alert(
                'NFC',
                'NFC tap support is coming. Use QR or manual entry for now.',
                [{text: 'OK'}],
              )
            }>
            <Text style={styles.secondaryIcon}>⬡</Text>
            <View style={styles.secondaryTextBox}>
              <Text style={styles.secondaryButtonText}>Tap NFC</Text>
              <Text style={styles.secondaryButtonSub}>Hold phone near merchant terminal</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Secured by Ledger · Settled on XRPL</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0A0F'},
  content: {flex: 1, paddingHorizontal: 24, justifyContent: 'center'},
  hero: {alignItems: 'center', marginBottom: 44},
  logo: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: {fontSize: 15, color: '#6B7280', marginTop: 6},
  section: {gap: 12},
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  inputRow: {flexDirection: 'row', gap: 8},
  input: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Courier',
  },
  pasteBtn: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  pasteBtnText: {fontSize: 14, color: '#9CA3AF', fontWeight: '600'},
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {fontSize: 16, fontWeight: '700', color: '#FFFFFF'},
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {flex: 1, height: 1, backgroundColor: '#1F2937'},
  dividerText: {fontSize: 13, color: '#374151'},
  altActions: {gap: 10},
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  secondaryIcon: {fontSize: 22, color: '#374151'},
  secondaryTextBox: {flex: 1},
  secondaryButtonText: {fontSize: 15, color: '#6B7280', fontWeight: '500'},
  secondaryButtonSub: {fontSize: 12, color: '#374151', marginTop: 2},
  footer: {paddingBottom: 24, alignItems: 'center'},
  footerText: {fontSize: 12, color: '#1F2937'},
});
