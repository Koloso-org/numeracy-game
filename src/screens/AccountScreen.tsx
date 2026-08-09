import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS } from '../theme';
import { PIN_MAX, signIn, signUp } from '../auth';
import { isSupabaseConfigured } from '../supabase';

export default function AccountScreen({
  onAuthed,
  onGuest,
}: {
  onAuthed: () => void;
  onGuest: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = mode === 'login' ? await signIn(username, pin) : await signUp(username, pin);
    setBusy(false);
    if (result.ok) onAuthed();
    else setError(result.error ?? 'Something went wrong.');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <Text style={styles.title}>{mode === 'login' ? 'Log in' : 'Create account'}</Text>
      <Text style={styles.subtitle}>
        Just pick a username and a PIN — no email, no personal details.
      </Text>

      {!isSupabaseConfigured && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            The leaderboard isn't connected yet. You can still play as a guest.
          </Text>
        </View>
      )}

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        placeholder="e.g. jb45"
        placeholderTextColor={COLORS.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        editable={!busy}
      />

      <Text style={styles.label}>PIN</Text>
      <TextInput
        style={styles.input}
        value={pin}
        onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ''))}
        placeholder="6 digits"
        placeholderTextColor={COLORS.inkMuted}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_MAX}
        editable={!busy}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={({ pressed }) => [styles.primaryButton, (pressed || busy) && styles.pressed]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={COLORS.accentText} />
        ) : (
          <Text style={styles.primaryButtonText}>
            {mode === 'login' ? 'Log in' : 'Create account'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setError(null);
          setMode(mode === 'login' ? 'signup' : 'login');
        }}
        style={styles.linkButton}
        disabled={busy}
      >
        <Text style={styles.linkText}>
          {mode === 'login' ? "New here? Create an account" : 'Already have an account? Log in'}
        </Text>
      </Pressable>

      <Pressable onPress={onGuest} style={styles.linkButton} disabled={busy}>
        <Text style={styles.guestText}>Play as guest</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: COLORS.accent, textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  notice: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: { color: COLORS.warn, fontSize: 14 },
  label: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    color: COLORS.ink,
    fontSize: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  error: { color: COLORS.wrong, fontSize: 15, marginTop: 14, textAlign: 'center' },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryButtonText: { color: COLORS.accentText, fontSize: 20, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  linkButton: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  linkText: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
  guestText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
});
