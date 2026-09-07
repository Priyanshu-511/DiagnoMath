import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

export default function ExploreScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Scan & Grade</Text>
      <Text style={styles.subtitle}>
        Choose how students submitted their answers.
      </Text>

      {/* ── OMR Bubble Scanner ─────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.card} onPress={() => router.push('/scan' as any)}>
        <View style={styles.cardIcon}>
          <Text style={styles.cardIconText}>⬛</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>OMR Bubble Sheet</Text>
          <Text style={styles.cardDesc}>
            Students filled in bubbles on a printed answer sheet. Photograph the
            sheet to detect answers automatically.
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* ── Handwritten Answers ────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.card, styles.cardHandwritten]}
        onPress={() => router.push('/handwritten-scan' as any)}
      >
        <View style={[styles.cardIcon, styles.cardIconHandwritten]}>
          <Text style={styles.cardIconText}>✏️</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>Handwritten Answers</Text>
          <Text style={styles.cardDesc}>
            Students wrote their answers as a numbered list (e.g.{' '}
            <Text style={styles.code}>1. a  2. b  3. c</Text>). Photograph the
            page and the app reads the answers with on-device OCR.
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* ── Sheets ────────────────────────────────────────────────────────── */}
      <Text style={styles.sectionHeading}>Sheets</Text>

      {/* ── Print / Share ─────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.card, styles.cardPrint]}
        onPress={() => router.push('/tests-sheet' as any)}
      >
        <View style={[styles.cardIcon, styles.cardIconPrint]}>
          <Text style={styles.cardIconText}>🖨️</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>Print / Share Sheets</Text>
          <Text style={styles.cardDesc}>
            Generate a printable question paper or bubble answer sheet as a PDF
            and share it directly from the app.
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* ── Question Bank ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionHeading}>Question Bank</Text>

      <TouchableOpacity
        style={[styles.card, styles.cardImport]}
        onPress={() => router.push('/questions-import' as any)}
      >
        <View style={[styles.cardIcon, styles.cardIconImport]}>
          <Text style={styles.cardIconText}>📥</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>Import Questions</Text>
          <Text style={styles.cardDesc}>
            Upload a CSV or Excel file with columns: topic, question, optionA–D,
            answer. Supports A/B/C/D, 1–4, or exact option text as the answer key.
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* ── Manage ────────────────────────────────────────────────────────── */}
      <Text style={styles.sectionHeading}>Manage</Text>
      <TouchableOpacity style={styles.cardSmall} onPress={() => router.push('/tests-create' as any)}>
        <Text style={styles.cardSmallText}>＋ Create Test</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cardSmall} onPress={() => router.push('/results' as any)}>
        <Text style={styles.cardSmallText}>📊 View Results</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F0FDF4', gap: 12 },
  heading: { fontSize: 24, fontWeight: '800', color: '#1E3A8A' },
  subtitle: { fontSize: 13, color: '#4B5563', marginBottom: 4 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#BEF264',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  cardHandwritten: { borderColor: '#93C5FD' },
  cardImport: { borderColor: '#C4B5FD' },
  cardPrint: { borderColor: '#FCD34D' },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ECFCCB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconHandwritten: { backgroundColor: '#DBEAFE' },
  cardIconImport: { backgroundColor: '#EDE9FE' },
  cardIconPrint: { backgroundColor: '#FEF3C7' },
  cardIconText: { fontSize: 22 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E3A8A' },
  cardDesc: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#1E3A8A' },
  chevron: { fontSize: 22, color: '#9CA3AF', fontWeight: '300' },

  sectionHeading: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginTop: 4 },
  cardSmall: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardSmallText: { fontSize: 14, color: '#1E3A8A', fontWeight: '600' },
});
