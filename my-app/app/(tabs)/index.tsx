import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';

export default function HomeScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome, {user?.name}</Text>
      {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
      <Link href="/upload" style={styles.link}>
        Go to Upload
      </Link>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  welcome: { fontSize: 18, fontWeight: '600' },
  email: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  link: { color: '#3B82F6', fontSize: 16, marginTop: 8 },
  logoutButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
  },
  logoutText: { color: '#DC2626', fontWeight: '600' },
});
