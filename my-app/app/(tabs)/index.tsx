import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';

const QUOTES = [
  {
    text: 'The art of teaching is the art of assisting discovery.',
    author: '— Mark Van Doren',
  },
  {
    text: 'A good teacher can inspire hope, ignite the imagination, and instill a love of learning.',
    author: '— Brad Henry',
  },
  {
    text: 'Education is not the filling of a pail, but the lighting of a fire.',
    author: '— W.B. Yeats',
  },
  {
    text: 'The best teachers are those who show you where to look but don\'t tell you what to see.',
    author: '— Alexandra K. Trenfor',
  },
];

const SLIDE_INTERVAL = 4000;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

function QuoteCarousel() {
  const [active, setActive] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      // Fade out → swap → fade in
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        setActive((prev) => (prev + 1) % QUOTES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, SLIDE_INTERVAL);

    return () => clearInterval(timer);
  }, [fadeAnim]);

  const quote = QUOTES[active];

  return (
    <View style={styles.quoteCard}>
      <Text style={styles.quoteIcon}>"</Text>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.quoteText}>{quote.text}</Text>
        <Text style={styles.quoteAuthor}>{quote.author}</Text>
      </Animated.View>

      {/* Dot indicators */}
      <View style={styles.dots}>
        {QUOTES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === active && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // Derive first name for a friendly greeting
  const firstName = user?.name?.split(' ')[0] ?? 'Teacher';

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Hero greeting card ────────────────────────────────────────────── */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {firstName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingLabel}>{greeting},</Text>
            <Text style={styles.greetingName}>{user?.name ?? 'Teacher'} 👋</Text>
          </View>
          <View style={styles.classBadge}>
            <Text style={styles.classBadgeText}>Class 6</Text>
          </View>
        </View>

        {user?.email ? (
          <Text style={styles.emailText}>{user.email}</Text>
        ) : null}

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>📝</Text>
            <Text style={styles.statLabel}>DiagnoMath</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>🎯</Text>
            <Text style={styles.statLabel}>Smart Grading</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>📊</Text>
            <Text style={styles.statLabel}>Insights</Text>
          </View>
        </View>
      </View>

      {/* ── Motivational quote carousel ───────────────────────────────────── */}
      <QuoteCarousel />

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#DBEAFE' }]}
          onPress={() => router.push('/scan' as any)}
        >
          <Text style={styles.actionIcon}>⬛</Text>
          <Text style={styles.actionText}>Scan OMR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#ECFCCB' }]}
          onPress={() => router.push('/handwritten-scan' as any)}
        >
          <Text style={styles.actionIcon}>✏️</Text>
          <Text style={styles.actionText}>Handwritten</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#EDE9FE' }]}
          onPress={() => router.push('/questions-import' as any)}
        >
          <Text style={styles.actionIcon}>📥</Text>
          <Text style={styles.actionText}>Import Q's</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#FEF3C7' }]}
          onPress={() => router.push('/results' as any)}
        >
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>Results</Text>
        </TouchableOpacity>
      </View>

      {/* ── Log out ───────────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F0FDF4',
    gap: 16,
    paddingBottom: 32,
  },

  /* Hero card */
  heroCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#A3E635',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#1E3A8A' },
  greetingLabel: { fontSize: 13, color: '#93C5FD', fontWeight: '500' },
  greetingName: { fontSize: 17, color: '#ffffff', fontWeight: '700' },
  classBadge: {
    backgroundColor: '#A3E635',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  classBadgeText: { fontSize: 12, fontWeight: '800', color: '#1E3A8A' },
  emailText: { fontSize: 12, color: '#93C5FD' },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  stat: { alignItems: 'center', gap: 4 },
  statNum: { fontSize: 20 },
  statLabel: { fontSize: 11, color: '#CBD5E1', fontWeight: '600' },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

  /* Quote carousel */
  quoteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#A3E635',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    gap: 8,
    minHeight: 140,
  },
  quoteIcon: {
    fontSize: 40,
    color: '#BEF264',
    lineHeight: 36,
    marginBottom: -8,
    fontWeight: '900',
  },
  quoteText: {
    fontSize: 14,
    color: '#1E3A8A',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  quoteAuthor: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 4,
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: 4 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: { backgroundColor: '#A3E635', width: 18 },

  /* Quick actions grid */
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: -4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: { fontSize: 26 },
  actionText: { fontSize: 13, fontWeight: '700', color: '#1E3A8A' },

  /* Logout */
  logoutButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  logoutText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
});
