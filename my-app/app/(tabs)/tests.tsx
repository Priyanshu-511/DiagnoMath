import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

const items: { label: string; route: string }[] = [
  { label: '📥 Import Questions (CSV/Excel)', route: '/questions-import' },
  { label: '📝 Create Test', route: '/tests-create' },
  { label: '🖨️ Print / Share Sheets', route: '/tests-sheet' },
  { label: '📷 Scan Answer Sheet', route: '/scan' },
  { label: '📊 View Results', route: '/results' },
];

export default function TestsMenuScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Tests & Diagnosis</Text>
      {items.map((item) => (
        <TouchableOpacity key={item.route} style={styles.item} onPress={() => router.push(item.route as any)}>
          <Text style={styles.itemText}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F0FDF4', gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1E3A8A', marginBottom: 8 },
  item: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#BEF264',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  itemText: { fontSize: 15, fontWeight: '600', color: '#1E3A8A' },
});
