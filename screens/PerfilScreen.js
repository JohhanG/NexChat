import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';
import { generarHuellaSeguridad } from '../lib/seguridad';

const AVATARES = ['😎', '🦁', '🚀', '⚡', '👑', '🌸', '🔥', '💎'];

export default function PerfilScreen({
  userProfile,
  onUpdateProfile,
  onCheckUpdates,
  onLogout,
  onLockNow,
  onPanicWipe,
}) {
  const { colors, isDark, toggleTheme } = useTheme();
  const [subMenu, setSubMenu] = useState(null); // null | 'editar' | 'blindaje'
  const [name, setName] = useState(userProfile.name || '');
  const [bio, setBio] = useState(userProfile.bio || '');
  const [avatar, setAvatar] = useState(userProfile.avatar || '😎');
  const [saving, setSaving] = useState(false);

  const myFingerprint = generarHuellaSeguridad(userProfile.phone, 'NEXCHAT_GLOBAL_KEY');
  const esAvatarImg =
    avatar && (avatar.startsWith('http') || avatar.startsWith('data:image'));

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
        const nuevo = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setAvatar(nuevo);
        await onUpdateProfile({
          ...userProfile,
          name: name.trim() || userProfile.name,
          bio: bio.trim() || userProfile.bio,
          avatar: nuevo,
        });
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
    setSubMenu(null);
    Alert.alert('✅ Perfil Actualizado', 'Tus cambios y foto de perfil se guardaron en la nube 24/7.');
  };

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

  // SUB-MENÚ 1: EDITAR PERFIL Y FOTO (ESTILO WHATSAPP)
  if (subMenu === 'editar') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
          <TouchableOpacity onPress={() => setSubMenu(null)} style={styles.backMenuBtn}>
            <Text style={[styles.backMenuText, { color: colors.primary }]}>← Volver a Ajustes de Perfil</Text>
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center' }]}>
            <TouchableOpacity onPress={pickGalleryAvatar} style={[styles.avatarWrapBig, { borderColor: colors.primary }]}>
              {esAvatarImg ? (
                <Image source={{ uri: avatar }} style={styles.avatarImgBig} />
              ) : (
                <Text style={{ fontSize: 46 }}>{avatar}</Text>
              )}
              <View style={[styles.camBadge, { backgroundColor: colors.primary }]}>
                <Text style={{ fontSize: 14 }}>📷</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={pickGalleryAvatar}>
              <Text style={[styles.changePhotoText, { color: colors.primary }]}>
                📷 Elegir nueva foto desde mi Galería
              </Text>
            </TouchableOpacity>

            <View style={styles.emojiGrid}>
              {AVATARES.map((em) => (
                <TouchableOpacity
                  key={em}
                  onPress={() => setAvatar(em)}
                  style={[
                    styles.emojiOption,
                    avatar === em && {
                      borderColor: colors.primary,
                      borderWidth: 2,
                      backgroundColor: 'rgba(16,185,129,0.12)',
                    },
                  ]}
                >
                  <Text style={{ fontSize: 22 }}>{em}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

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
                {saving ? 'Guardando en Supabase...' : '💾 Guardar Cambios'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // SUB-MENÚ 2: BLINDAJE Y SEGURIDAD CRIPTOGRÁFICA (INTEGRADO EN PERFIL)
  if (subMenu === 'blindaje') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
          <TouchableOpacity onPress={() => setSubMenu(null)} style={styles.backMenuBtn}>
            <Text style={[styles.backMenuText, { color: colors.primary }]}>← Volver a Ajustes de Perfil</Text>
          </TouchableOpacity>

          <View style={[styles.heroCard, { backgroundColor: colors.headerBg }]}>
            <Text style={{ fontSize: 40, marginBottom: 6 }}>🛡️🔒</Text>
            <Text style={styles.heroTitle}>Blindaje y Privacidad E2EE</Text>
            <Text style={styles.heroSub}>
              Protección militar activa con SHA-256 + PIN 2FA + Escudo Anti-Fuerza Bruta
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>🔑 Tu Huella Criptográfica (40 dígitos)</Text>
            <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
              Código único que verifica tu identidad en la red global de NexChat:
            </Text>
            <View style={[styles.fpBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[styles.fpText, { color: colors.primary }]}>{myFingerprint}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>🛡️ Capas de Seguridad en tu Cuenta</Text>
            <View style={styles.layerRow}>
              <Text style={{ fontSize: 16 }}>✅</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.layerTitle, { color: colors.text }]}>PIN Hash SHA-256 Irreversible</Text>
                <Text style={[styles.layerSub, { color: colors.textMuted }]}>
                  Tu PIN jamás viaja en texto plano.
                </Text>
              </View>
            </View>
            <View style={styles.layerRow}>
              <Text style={{ fontSize: 16 }}>✅</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.layerTitle, { color: colors.text }]}>Bloqueo Anti-Fuerza Bruta</Text>
                <Text style={[styles.layerSub, { color: colors.textMuted }]}>
                  Congela el acceso si alguien falla tu PIN 3 veces seguidas.
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={onLockNow}
            style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 4 }]}
          >
            <Text style={styles.saveBtnText}>🔒 Bloquear Pantalla con mi PIN Ahora</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={confirmPanic}
            style={[styles.saveBtn, { backgroundColor: colors.danger, marginTop: 10 }]}
          >
            <Text style={[styles.saveBtnText, { color: '#FFF' }]}>
              🚨 Botón de Pánico (Destruir Sesión Local)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // MENÚ PRINCIPAL DE PERFIL Y AJUSTES (ESTILO WHATSAPP)
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Ajustes y Perfil</Text>

        {/* CABECERA CON FOTO DE PERFIL ESTILO WHATSAPP */}
        <TouchableOpacity
          onPress={() => setSubMenu('editar')}
          style={[styles.profileHeaderCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <TouchableOpacity onPress={pickGalleryAvatar} style={[styles.headerAvatarWrap, { borderColor: colors.primary }]}>
            {esAvatarImg ? (
              <Image source={{ uri: avatar }} style={styles.headerAvatarImg} />
            ) : (
              <Text style={{ fontSize: 32 }}>{avatar}</Text>
            )}
            <View style={[styles.camBadgeSmall, { backgroundColor: colors.primary }]}>
              <Text style={{ fontSize: 10 }}>📷</Text>
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {userProfile.name}
            </Text>
            <Text style={[styles.profileBio, { color: colors.textMuted }]} numberOfLines={1}>
              {userProfile.bio || '🔒 Protegido con cifrado E2EE'}
            </Text>
            <Text style={[styles.profilePhone, { color: colors.primary }]}>
              📱 {userProfile.phone}
            </Text>
          </View>

          <View style={[styles.editPill, { backgroundColor: colors.inputBg }]}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>Editar ›</Text>
          </View>
        </TouchableOpacity>

        {/* LISTA DE MENÚS ESTILO WHATSAPP */}
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => setSubMenu('editar')} style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Text style={{ fontSize: 20 }}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Cuenta y Foto de Perfil</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Cambiar foto de galería, nombre visible e info
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={() => setSubMenu('blindaje')} style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(14,165,233,0.15)' }]}>
              <Text style={{ fontSize: 20 }}>🛡️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Blindaje y Privacidad E2EE</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Huella SHA-256, bloqueo con PIN y botón anti-robo
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={onLockNow} style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Text style={{ fontSize: 20 }}>🔒</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Bloquear Pantalla Ahora</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Proteger tus chats inmediatamente con tu PIN 2FA
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={toggleTheme} style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
              <Text style={{ fontSize: 20 }}>{isDark ? '🌙' : '☀️'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Apariencia y Tema</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                {isDark ? 'Modo Oscuro activo (toca para cambiar)' : 'Modo Claro activo (toca para cambiar)'}
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>Cambiar</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={onCheckUpdates} style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
              <Text style={{ fontSize: 20 }}>🔄</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Actualizaciones en la Nube (OTA)</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Descargar mejoras sin reinstalar el APK
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>Verificar</Text>
          </TouchableOpacity>
        </View>

        {/* CERRAR SESIÓN */}
        <TouchableOpacity
          onPress={onLogout}
          style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: colors.danger }]}
        >
          <Text style={[styles.logoutText, { color: colors.danger }]}>🚪 Cerrar Sesión en este Celular</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 20, fontWeight: '900', marginBottom: 12 },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    marginBottom: 16,
  },
  headerAvatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerAvatarImg: { width: 62, height: 62, borderRadius: 31 },
  camBadgeSmall: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111b21',
  },
  profileName: { fontSize: 18, fontWeight: '900' },
  profileBio: { fontSize: 12, marginTop: 2 },
  profilePhone: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  editPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { fontSize: 15, fontWeight: '800' },
  menuSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '700' },
  divider: { height: 1 },
  backMenuBtn: { marginBottom: 12, paddingVertical: 4 },
  backMenuText: { fontSize: 15, fontWeight: '900' },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  avatarWrapBig: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  avatarImgBig: { width: 90, height: 90, borderRadius: 45 },
  camBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 10,
  },
  emojiOption: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  saveBtnText: { color: '#052E16', fontSize: 15, fontWeight: '900' },
  heroCard: {
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  heroSub: { color: '#A7F3D0', fontSize: 12, textAlign: 'center', marginTop: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  cardDesc: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
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
  layerTitle: { fontSize: 13, fontWeight: '800' },
  layerSub: { fontSize: 11, marginTop: 2 },
  logoutBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  logoutText: { fontSize: 15, fontWeight: '900' },
});
