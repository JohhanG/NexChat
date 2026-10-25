import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Alert, BackHandler, Switch
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
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
  appLockConfig = { enabled: false, method: 'huella', autoLockTime: 'immediate' },
  onUpdateAppLockConfig,
  lockedChatIds = new Set(),
}) {
  const { colors, isDark, toggleTheme } = useTheme();
  const [subMenu, setSubMenu] = useState(null); // null | 'editar' | 'blindaje' | 'privacidad_bloqueo'
  const [name, setName] = useState(userProfile.name || '');
  const [bio, setBio] = useState(userProfile.bio || '');
  const [avatar, setAvatar] = useState(userProfile.avatar || '😎');
  const [saving, setSaving] = useState(false);

  const isLockEnabled = Boolean(appLockConfig?.enabled);
  const lockMethod = appLockConfig?.method || 'huella';
  const autoLockTime = appLockConfig?.autoLockTime || 'immediate';

  const updateLock = (updates) => {
    const updated = {
      enabled: isLockEnabled,
      method: lockMethod,
      autoLockTime: autoLockTime,
      ...updates,
    };
    if (onUpdateAppLockConfig) {
      onUpdateAppLockConfig(updated);
    }
  };

  // Interceptar gesto de deslizar atrás en Android cuando estamos en un submenú del Perfil
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (subMenu !== null) {
        setSubMenu(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [subMenu]);

  const myFingerprint = generarHuellaSeguridad(userProfile.phone, 'NEXCHAT_GLOBAL_KEY');
  const bloquesHuella = myFingerprint.split(/\s+/).filter(Boolean);
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

  // SUB-MENÚ 1: EDITAR PERFIL Y FOTO (ESTILO WHATSAPP & TELEGRAM)
  if (subMenu === 'editar') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
          <TouchableOpacity onPress={() => setSubMenu(null)} style={styles.backMenuBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={[styles.backMenuText, { color: colors.primary }]}>Volver a Ajustes</Text>
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center' }]}>
            <TouchableOpacity onPress={pickGalleryAvatar} style={[styles.avatarWrapBig, { borderColor: colors.primary }]}>
              {esAvatarImg ? (
                <Image source={{ uri: avatar }} style={styles.avatarImgBig} />
              ) : (
                <Text style={{ fontSize: 46 }}>{avatar}</Text>
              )}
              <View style={[styles.camBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={pickGalleryAvatar} style={styles.uploadPhotoBtn}>
              <Ionicons name="images-outline" size={16} color={colors.primary} />
              <Text style={[styles.changePhotoText, { color: colors.primary }]}>
                Elegir nueva foto desde mi Galería
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
                      backgroundColor: 'rgba(0,168,132,0.14)',
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
              placeholder="Disponible en NexChat"
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="checkmark-circle" size={19} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {saving ? 'Guardando en Supabase...' : 'Guardar Cambios'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // SUB-MENÚ 2: BLINDAJE Y SEGURIDAD CRIPTOGRÁFICA
  if (subMenu === 'blindaje') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
          <TouchableOpacity onPress={() => setSubMenu(null)} style={styles.backMenuBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={[styles.backMenuText, { color: colors.primary }]}>Volver a Ajustes</Text>
          </TouchableOpacity>

          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.shieldHeroCircle}>
              <Ionicons name="shield-checkmark" size={36} color="#00A884" />
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Blindaje y Privacidad E2EE</Text>
            <Text style={[styles.heroSub, { color: colors.textMuted }]}>
              Protección militar activa con SHA-256 + PIN 2FA + Escudo Anti-Fuerza Bruta
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="key-outline" size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>
                Tu Huella Criptográfica (40 dígitos)
              </Text>
            </View>
            <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
              Código único que verifica tu identidad en la red global de NexChat:
            </Text>
            <View style={[styles.fpGridWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              {bloquesHuella.map((b, i) => (
                <View key={i} style={styles.fpGridCell}>
                  <Text style={[styles.fpText, { color: colors.primary }]}>{b}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Capas de Seguridad Activas</Text>
            <View style={styles.layerRow}>
              <Ionicons name="checkmark-circle" size={20} color="#00A884" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.layerTitle, { color: colors.text }]}>PIN Hash SHA-256 Irreversible</Text>
                <Text style={[styles.layerSub, { color: colors.textMuted }]}>
                  Tu PIN jamás viaja en texto plano.
                </Text>
              </View>
            </View>
            <View style={styles.layerRow}>
              <Ionicons name="checkmark-circle" size={20} color="#00A884" />
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
            <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Bloquear Pantalla con mi PIN Ahora</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={confirmPanic}
            style={[styles.saveBtn, { backgroundColor: 'rgba(239,68,68,0.14)', borderWidth: 1, borderColor: colors.danger, marginTop: 10 }]}
          >
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={[styles.saveBtnText, { color: colors.danger }]}>
              Botón de Pánico (Destruir Sesión Local)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // SUB-MENÚ 3: PRIVACIDAD Y BLOQUEO DE APP (HUELLA / PIN)
  if (subMenu === 'privacidad_bloqueo') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
          <TouchableOpacity onPress={() => setSubMenu(null)} style={styles.backMenuBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={[styles.backMenuText, { color: colors.primary }]}>Volver a Ajustes</Text>
          </TouchableOpacity>

          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.shieldHeroCircle, { backgroundColor: 'rgba(0,168,132,0.15)' }]}>
              <Ionicons name="finger-print" size={38} color="#00A884" />
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Bloqueo de NexChat</Text>
            <Text style={[styles.heroSub, { color: colors.textMuted }]}>
              Protege tus chats con huella dactilar o código PIN cada vez que salgas de la aplicación.
            </Text>
          </View>

          {/* Switch Activar Bloqueo */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 2 }]}>
                  Bloquear con Huella / PIN
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textMuted, marginBottom: 0 }]}>
                  {isLockEnabled
                    ? 'La app solicitará verificación antes de abrirse o al regresar'
                    : 'Activa esta opción para exigir autenticación al entrar'}
                </Text>
              </View>
              <Switch
                value={isLockEnabled}
                onValueChange={(val) => updateLock({ enabled: val })}
                thumbColor={isLockEnabled ? '#00A884' : '#94A3B8'}
                trackColor={{ false: '#334155', true: 'rgba(0,168,132,0.4)' }}
              />
            </View>
          </View>

          {isLockEnabled && (
            <>
              {/* Selector de Método de Desbloqueo */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Método de Desbloqueo</Text>
                <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                  Elige cómo deseas desbloquear tu WhatsApp / NexChat:
                </Text>

                <View style={{ gap: 8, marginTop: 4 }}>
                  {[
                    { id: 'huella', label: 'Huella Dactilar', icon: 'finger-print', desc: 'Sensor de huella digital táctil' },
                    { id: 'pin', label: 'Código PIN (2FA)', icon: 'keypad', desc: 'Ingreso numérico de seguridad' },
                    { id: 'ambos', label: 'Huella o PIN', icon: 'shield-checkmark', desc: 'Huella táctil con alternativa de PIN' },
                  ].map((m) => {
                    const isSelected = lockMethod === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => updateLock({ method: m.id })}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: isSelected ? '#00A884' : colors.border,
                          backgroundColor: isSelected ? 'rgba(0,168,132,0.1)' : colors.inputBg,
                          gap: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: isSelected ? 'rgba(0,168,132,0.2)' : 'rgba(148,163,184,0.1)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name={m.icon} size={20} color={isSelected ? '#00A884' : colors.textMuted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: isSelected ? '#00A884' : colors.text }}>
                            {m.label}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>{m.desc}</Text>
                        </View>
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? '#00A884' : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Selector de Tiempo de Bloqueo Automático */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Bloqueo Automático</Text>
                <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                  Tiempo de espera tras salir o minimizar la app:
                </Text>

                <View style={{ gap: 8, marginTop: 4 }}>
                  {[
                    { id: 'immediate', label: 'Inmediatamente', desc: 'Al salir o cambiar de app se bloqueará' },
                    { id: '1m', label: 'Después de 1 minuto', desc: 'Permite salir y volver rápidamente sin pedir huella' },
                    { id: '5m', label: 'Después de 5 minutos', desc: 'Bloqueo tras 5 minutos en segundo plano' },
                  ].map((t) => {
                    const isSelected = autoLockTime === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => updateLock({ autoLockTime: t.id })}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: isSelected ? '#00A884' : colors.border,
                          backgroundColor: isSelected ? 'rgba(0,168,132,0.1)' : colors.inputBg,
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: isSelected ? '#00A884' : colors.text }}>
                            {t.label}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>{t.desc}</Text>
                        </View>
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? '#00A884' : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* Tarjeta de Chats Protegidos Individualmente */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="lock-closed" size={18} color="#F59E0B" />
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>
                Bloqueo Individual por Chat
              </Text>
            </View>
            <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
              {lockedChatIds.size > 0
                ? `Tienes ${lockedChatIds.size} conversación(es) protegida(s) con huella/PIN.`
                : 'No tienes chats bloqueados individualmente.'}
            </Text>
            <View style={{ backgroundColor: colors.inputBg, padding: 12, borderRadius: 12, marginTop: 4 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                💡 <Text style={{ fontWeight: '800', color: colors.text }}>Cómo bloquear un chat:</Text> En la lista de chats, mantén presionado cualquier contacto y elige <Text style={{ fontWeight: '800', color: '#F59E0B' }}>"Bloquear chat con huella/PIN"</Text>.
              </Text>
            </View>
          </View>

          {/* Botón Probar Bloqueo Ahora */}
          <TouchableOpacity
            onPress={onLockNow}
            style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 6 }]}
          >
            <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Bloquear NexChat Ahora</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // MENÚ PRINCIPAL DE PERFIL Y AJUSTES (ESTILO WHATSAPP & TELEGRAM)
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Ajustes y Perfil</Text>

        {/* CABECERA CON FOTO DE PERFIL ESTILO WHATSAPP / TELEGRAM */}
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
              <Ionicons name="camera" size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {userProfile.name}
            </Text>
            <Text style={[styles.profileBio, { color: colors.textMuted }]} numberOfLines={1}>
              {userProfile.bio || 'Protegido con cifrado E2EE'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="call-outline" size={13} color={colors.primary} />
              <Text style={[styles.profilePhone, { color: colors.primary }]}>
                {userProfile.phone}
              </Text>
            </View>
          </View>

          <View style={[styles.editPill, { backgroundColor: colors.inputBg }]}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>Editar ›</Text>
          </View>
        </TouchableOpacity>

        {/* LISTA DE MENÚS CON ICONOS VECTORIALES NÍTIDOS */}
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => setSubMenu('editar')} style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(0,168,132,0.15)' }]}>
              <Ionicons name="person" size={20} color="#00A884" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Cuenta y Foto de Perfil</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Cambiar foto de galería, nombre visible e info
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={() => setSubMenu('privacidad_bloqueo')} style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Ionicons name="finger-print" size={20} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Privacidad y Bloqueo de App</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                {isLockEnabled
                  ? `Bloqueo activo (${lockMethod === 'huella' ? 'Huella' : lockMethod === 'pin' ? 'PIN' : 'Huella o PIN'})`
                  : 'Desactivado (configurar huella o PIN)'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={() => setSubMenu('blindaje')} style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(56,189,248,0.15)' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#38BDF8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Blindaje y Privacidad E2EE</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Huella SHA-256, bloqueo con PIN y botón anti-robo
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={onLockNow} style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Ionicons name="lock-closed" size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Bloquear Pantalla Ahora</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Proteger tus chats inmediatamente con tu PIN 2FA
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={toggleTheme} style={styles.menuRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color="#A855F7" />
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
              <Ionicons name="cloud-download" size={20} color="#22C55E" />
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
          style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: 'rgba(239,68,68,0.4)' }]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>Cerrar Sesión en este Celular</Text>
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
    borderColor: '#17212B',
  },
  profileName: { fontSize: 18, fontWeight: '900' },
  profileBio: { fontSize: 12, marginTop: 2 },
  profilePhone: { fontSize: 12, fontWeight: '800' },
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
  divider: { height: 1 },
  backMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    paddingVertical: 4,
  },
  backMenuText: { fontSize: 15, fontWeight: '900' },
  card: {
    borderRadius: 18,
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
    marginBottom: 12,
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
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  changePhotoText: { fontSize: 13, fontWeight: '800' },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  heroCard: {
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 14,
  },
  shieldHeroCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,168,132,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  heroSub: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  cardDesc: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  fpGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  fpGridCell: {
    width: '25%',
    paddingVertical: 5,
    alignItems: 'center',
  },
  fpText: { fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  layerTitle: { fontSize: 13, fontWeight: '800' },
  layerSub: { fontSize: 11, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 2,
  },
  logoutText: { fontSize: 15, fontWeight: '900' },
});
