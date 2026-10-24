import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';

const AVATARES = ['😎', '🦁', '🚀', '⚡', '👑', '🌸', '🔥', '💎'];

export default function PerfilScreen({
  userProfile,
  onUpdateProfile,
  onCheckUpdates,
  onLogout,
}) {
  const { colors, isDark, toggleTheme } = useTheme();
  const [name, setName] = useState(userProfile.name || '');
  const [bio, setBio] = useState(userProfile.bio || '');
  const [avatar, setAvatar] = useState(userProfile.avatar || '😎');
  const [saving, setSaving] = useState(false);

  const pickGalleryAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a tus fotos para cambiar tu foto de perfil.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        setAvatar(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo cargar la imagen.');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Nombre requerido', 'Tu nombre visible no puede estar vacío.');
      return;
    }
    setSaving(true);
    await onUpdateProfile({
      ...userProfile,
      name: name.trim(),
      bio: bio.trim(),
      avatar,
    });
    setSaving(false);
    Alert.alert('✅ Perfil Sincronizado', 'Tus cambios se guardaron en la nube global 24/7.');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        {/* TARJETA DE PERFIL */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center' }]}>
          <TouchableOpacity onPress={pickGalleryAvatar} style={[styles.avatarWrap, { borderColor: colors.primary }]}>
            {avatar && avatar.startsWith('data:image') ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <Text style={{ fontSize: 44 }}>{avatar}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={pickGalleryAvatar}>
            <Text style={[styles.changePhotoText, { color: colors.primary }]}>📷 Subir foto desde mi Galería</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
            {AVATARES.map((em) => (
              <TouchableOpacity
                key={em}
                onPress={() => setAvatar(em)}
                style={[
                  styles.emojiOption,
                  avatar === em && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <Text style={{ fontSize: 22 }}>{em}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.phoneBadge}>
            <Text style={styles.phoneBadgeText}>📱 Línea Verificada: {userProfile.phone}</Text>
          </View>
        </View>

        {/* DATOS EDITABLES */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>TU NOMBRE VISIBLE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 14 }]}>INFO / ESTADO DE PERFIL</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Disponible en NexChat 🔒"
            placeholderTextColor={colors.textMuted}
          />

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Guardando en Supabase...' : '💾 Guardar Cambios de Perfil'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* AJUSTES Y OTA */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={toggleTheme} style={styles.settingRow}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              {isDark ? '🌙 Modo Oscuro Activo' : '☀️ Modo Claro Activo'}
            </Text>
            <Text style={{ color: colors.primary, fontWeight: '800' }}>Cambiar</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={onCheckUpdates} style={styles.settingRow}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              🔄 Buscar Actualización OTA en la Nube
            </Text>
            <Text style={{ color: colors.primary, fontWeight: '800' }}>Verificar</Text>
          </TouchableOpacity>
        </View>

        {/* CERRAR SESIÓN */}
        <TouchableOpacity
          onPress={onLogout}
          style={[styles.logoutBtn, { borderColor: colors.danger }]}
        >
          <Text style={[styles.logoutText, { color: colors.danger }]}>🚪 Cerrar Sesión en este Celular</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  avatarImg: { width: 92, height: 92, borderRadius: 46 },
  changePhotoText: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  emojiOption: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  phoneBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  phoneBadgeText: { color: '#10B981', fontSize: 12, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 6, letterSpacing: 0.6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  saveBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingTitle: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, marginVertical: 6 },
  logoutBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  logoutText: { fontSize: 15, fontWeight: '900' },
});
