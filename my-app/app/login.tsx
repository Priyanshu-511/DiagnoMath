import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';
import { AuthError } from '@/lib/auth/types';

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const clearError = () => error && setError('');

  const handleSubmit = async () => {
    setError('');

    if (mode === 'signup') {
      if (!name.trim() || !email.trim() || !password) {
        setError('Please fill in all fields');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    } else if (!name.trim() || !password) {
      setError('Enter your username/email and password');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await register({ name, email, password });
      } else {
        await login({ emailOrUsername: name, password });
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{mode === 'login' ? 'Teacher Login' : 'Teacher Sign Up'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'login'
            ? 'Enter your username or email and password'
            : 'Create an account to get started'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={mode === 'login' ? 'Username or Email' : 'Username'}
          autoCapitalize="none"
          autoCorrect={false}
          value={name}
          onChangeText={(t) => {
            setName(t);
            clearError();
          }}
          returnKeyType="next"
        />

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clearError();
            }}
            returnKeyType="next"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            clearError();
          }}
          returnKeyType={mode === 'signup' ? 'next' : 'go'}
          onSubmitEditing={mode === 'login' ? handleSubmit : undefined}
        />

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={confirmPassword}
            onChangeText={(t) => {
              setConfirmPassword(t);
              clearError();
            }}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchLink} onPress={switchMode}>
          <Text style={styles.switchText}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.switchTextBold}>{mode === 'login' ? 'Sign Up' : 'Log In'}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF4' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#BEF264',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    color: '#DC2626',
    marginBottom: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  switchLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: '#4B5563',
    fontSize: 14,
  },
  switchTextBold: {
    color: '#3B82F6',
    fontWeight: '700',
  },
});
