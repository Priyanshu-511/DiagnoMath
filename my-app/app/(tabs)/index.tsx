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
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - 12) / 2;

function QuoteCarousel() {
  const [active, setActive] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
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
      <View style={styles.dots}>
        {QUOTES.map((_, i) => (
          <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

// ── Action card data ──────────────────────────────────────────────────────────
const GRID_ACTIONS = [
  { icon: '📷', label: 'Scan OMR',    route: '/scan',            bg: '#DBEAFE', border: '#93C5FD' },
  { icon: '✏️', label: 'Handwritten', route: '/handwritten-scan', bg: '#ECFCCB', border: '#BEF264' },
  { icon: '📥', label: 'Import Q\'s', route: '/questions-import', bg: '#EDE9FE', border: '#C4B5FD' },
  { icon: '📊', label: 'Results',     route: '/results',          bg: '#FEF3C7', border: '#FCD34D' },
];

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const firstName = user?.name?.split(' ')[0] ?? 'Teacher';
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top + 16, 48),
            paddingBottom: Math.max(insets.bottom + 24, 36),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero card ───────────────────────────────────────────────────────── */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingLabel}>{greeting},</Text>
            <Text style={styles.greetingName}>{user?.name ?? 'Teacher'} 👋</Text>
            {user?.email ? <Text style={styles.emailText}>{user.email}</Text> : null}
          </View>
        </View>

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

      {/* ── Quote carousel ──────────────────────────────────────────────────── */}
      <QuoteCarousel />

      {/* ── Quick Actions (2×2 grid) ─────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {GRID_ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.route}
            style={[styles.actionCard, { backgroundColor: a.bg, borderColor: a.border }]}
            onPress={() => router.push(a.route as any)}
          >
            <Text style={styles.actionIcon}>{a.icon}</Text>
            <Text style={styles.actionText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Auto Quiz — featured full-width card ────────────────────────────── */}
      <TouchableOpacity
        style={styles.featureCard}
        onPress={() => router.push('/auto-quiz' as any)}
      >
        <View style={styles.featureLeft}>
          <Text style={styles.featureIcon}>🎲</Text>
        </View>
        <View style={styles.featureBody}>
          <Text style={styles.featureTitle}>Auto Quiz Generator</Text>
          <Text style={styles.featureDesc}>
            Instantly create Class 6–7 math quizzes — print &amp; scan to analyse student skills
          </Text>
        </View>
        <Text style={styles.featureChevron}>›</Text>
      </TouchableOpacity>

      {/* ── Log out ─────────────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F0FDF4',
    gap: 14,
    paddingBottom: 32,
  },

  /* ── Hero ── */
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
  greetingLabel: { fontSize: 12, color: '#93C5FD', fontWeight: '500' },
  greetingName: { fontSize: 17, color: '#ffffff', fontWeight: '700' },
  emailText: { fontSize: 11, color: '#93C5FD', marginTop: 2 },
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

  /* ── Quote carousel ── */
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
    minHeight: 130,
  },
  quoteIcon: { fontSize: 36, color: '#BEF264', lineHeight: 32, marginBottom: -6, fontWeight: '900' },
  quoteText: { fontSize: 13, color: '#1E3A8A', lineHeight: 20, fontStyle: 'italic' },
  quoteAuthor: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginTop: 4 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: '#A3E635', width: 18 },

  /* ── 2×2 actions grid ── */
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: -6 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
  },
  actionIcon: { fontSize: 28 },
  actionText: { fontSize: 13, fontWeight: '700', color: '#1E3A8A' },

  /* ── Featured Auto Quiz card ── */
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#F9A8D4',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  featureLeft: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: { fontSize: 26 },
  featureBody: { flex: 1, gap: 3 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A8A' },
  featureDesc: { fontSize: 11, color: '#6B7280', lineHeight: 16 },
  featureChevron: { fontSize: 24, color: '#9CA3AF', fontWeight: '300' },

  /* ── Logout ── */
  logoutButton: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 28,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  logoutText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
});
