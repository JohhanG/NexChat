import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { generarHuellaSeguridad } from '../lib/seguridad';

export default function SeguridadScreen({
  userProfile,
  onLockNow,
  onPanicWipe,
}) {
  const { colors } = useTheme();
  const myFingerprint = generarHuellaSeguridad(userProfile.phone, 'NEXCHAT_GLOBAL_KEY');

  const confirmPanic = () => {
    Alert.alert(
      '🚨 Destrucción de Emergencia (Anti-Robo)',
      '¿Estás seguro? Se borrarán todas las llaves locales, sesiones recordadas y caché del teléfono de forma inmediata.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Destruir Datos Locales', style: 'destructive', onPress: onPanicWipe },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* ESCUDO ACTIVO */}
        <View style={[styles.heroCard, { backgroundColor: colors.headerBg }]}>
          <Text style={{ fontSize: 44, marginBottom: 8 }}>🛡️🔒</Text>
          <Text style={styles.heroTitle}>Centro Criptográfico Anti-Hackeo</Text>
          <Text style={styles.heroSub}>
            Protección activa con SHA-256 + Salt + Bloqueo Anti-Fuerza Bruta
          </Text>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>● BLINDAJE MILITAR ACTIVO 24/7</Text>
          </View>
        </View>

        {/* HUELLA DIGITAL DEL DISPOSITIVO */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>🔑 Tu Huella Criptográfica Personal (40 dígitos)</Text>
          <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
            Esta huella única certifica tu identidad en la red global de NexChat:
          </Text>
          <View style={[styles.fpBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.fpText, { color: colors.primary }]}>{myFingerprint}</Text>
          </View>
        </View>

        {/* CAPAS DE DEFENSA */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>🛡️ Capas de Seguridad Habilitadas</Text>
          <View style={styles.layerRow}>
            <Text style={styles.layerIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.layerTitle, { color: colors.text }]}>PIN Hash SHA-256 Irreversible</Text>
              <Text style={[styles.layerSub, { color: colors.textMuted }]}>
                Tu PIN jamás viaja en texto plano. Solo se verifica su firma matemática.
              </Text>
            </View>
          </View>

          <View style={styles.layerRow}>
            <Text style={styles.layerIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.layerTitle, { color: colors.text }]}>Escudo Anti-Fuerza Bruta (5 intentos)</Text>
              <Text style={[styles.layerSub, { color: colors.textMuted }]}>
                Bloquea automáticamente a cualquier intruso que intente adivinar tu PIN.
              </Text>
            </View>
          </View>

          <View style={styles.layerRow}>
            <Text style={styles.layerIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.layerTitle, { color: colors.text }]}>Sanitización Anti-Inyección XSS/SQL</Text>
              <Text style={[styles.layerSub, { color: colors.textMuted }]}>
                Filtra scripts maliciosos en mensajes entrantes en tiempo real.
              </Text>
            </View>
          </View>
        </View>

        {/* ACCIONES RÁPIDAS */}
        <TouchableOpacity
          onPress={onLockNow}
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.actionBtnText}>🔒 Bloquear Pantalla con mi PIN Ahora</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={confirmPanic}
          style={[styles.actionBtn, { backgroundColor: colors.danger, marginTop: 10 }]}
        >
          <Text style={styles.actionBtnText}>🚨 Botón de Pánico (Destruir Sesión Local)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroCard: {
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', textAlign: 'center' },
  heroSub: { color: '#A7F3D0', fontSize: 12, textAlign: 'center', marginTop: 4 },
  activeBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(16,185,129,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  activeBadgeText: { color: '#6EE7B7', fontSize: 11, fontWeight: '900' },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  cardDesc: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  fpBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  fpText: { fontSize: 15, fontWeight: '900', letterSpacing: 2, textAlign: 'center', lineHeight: 24 },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  layerIcon: { fontSize: 16, marginTop: 2 },
  layerTitle: { fontSize: 13, fontWeight: '800' },
  layerSub: { fontSize: 11, marginTop: 2, lineHeight: 16 },
  actionBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
