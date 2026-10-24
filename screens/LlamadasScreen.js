import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function LlamadasScreen({ callHistory, onStartCall }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={[styles.e2eeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 22 }}>📞🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Llamadas de Voz y Video Cifradas</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              Tus llamadas utilizan canales seguros P2P de baja latencia sin registro en servidores externos.
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>HISTORIAL DE LLAMADAS</Text>

        {(!callHistory || callHistory.length === 0) ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📲</Text>
            <Text style={[styles.title, { color: colors.text }]}>Sin llamadas recientes</Text>
            <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
              Abre cualquier conversación con tus amigos y toca 📞 o 📹 en la esquina superior.
            </Text>
          </View>
        ) : (
          callHistory.map((item) => (
            <View
              key={item.id}
              style={[styles.callRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                <Text style={{ fontSize: 20 }}>{item.avatar || '👤'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.sub, { color: colors.textMuted }]}>
                  {item.type === 'video' ? '📹 Videollamada saliente' : '📞 Llamada de voz'} • {item.time}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => onStartCall({ name: item.name, avatar: item.avatar, peerPhone: item.peerPhone }, item.type)}
                style={[styles.callAgainBtn, { backgroundColor: colors.inputBg }]}
              >
                <Text style={{ fontSize: 18 }}>{item.type === 'video' ? '📹' : '📞'}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  e2eeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 20,
  },
  title: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  emptyBox: {
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callAgainBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
