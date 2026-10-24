import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, Image, Platform, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';

const COLORES_FONDO = ['#065F46', '#1E3A8A', '#7C2D12', '#581C87', '#831843', '#0F172A'];
const EMOJIS_ESTADO = ['😀', '😂', '😍', '🔥', '❤️', '🙏', '🎉', '🚀', '👑', '💯', '🐱💖', '😎🔥'];

export default function EstadosScreen({ statuses = [], userProfile, onPublishStatus }) {
  const { colors } = useTheme();
  const [modalNew, setModalNew] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusImage, setStatusImage] = useState(null);
  const [bgIndex, setBgIndex] = useState(0);
  const [viewingStatus, setViewingStatus] = useState(null);

  const esMiAvatarImagen =
    userProfile?.avatar &&
    (userProfile.avatar.startsWith('http') || userProfile.avatar.startsWith('data:image'));

  const handlePickStatusPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a tus fotos para subir un estado con imagen.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setStatusImage(uri);
        setModalNew(true);
      }
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  };

  const handlePublish = () => {
    if (!statusText.trim() && !statusImage) {
      Alert.alert('Estado vacío', 'Escribe algo o adjunta una foto para tu estado de 24 horas.');
      return;
    }
    const payloadContent = statusImage
      ? `IMG::${statusImage}||${statusText.trim()}`
      : statusText.trim();

    onPublishStatus(payloadContent, COLORES_FONDO[bgIndex]);
    setStatusText('');
    setStatusImage(null);
    setModalNew(false);
  };

  const parseStatusContent = (raw = '') => {
    if (String(raw).startsWith('IMG::')) {
      const parts = String(raw).replace('IMG::', '').split('||');
      return { imageUri: parts[0], caption: parts[1] || '' };
    }
    return { imageUri: null, caption: String(raw) };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Novedades y Estados</Text>

        {/* TARJETA MI ESTADO ESTILO WHATSAPP */}
        <View style={[styles.myStatusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              setStatusImage(null);
              setModalNew(true);
            }}
            style={styles.myStatusLeft}
          >
            <View style={[styles.avatarRing, { borderColor: colors.primary, backgroundColor: colors.inputBg }]}>
              {esMiAvatarImagen ? (
                <Image source={{ uri: userProfile.avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={{ fontSize: 24 }}>{userProfile?.avatar || '😎'}</Text>
              )}
              <View style={[styles.plusCorner, { backgroundColor: colors.primary }]}>
                <Ionicons name="add" size={14} color="#FFF" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Mi estado</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}>
                Toca para añadir texto, emojis o foto (24h)
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.quickActionBtns}>
            <TouchableOpacity
              onPress={handlePickStatusPhoto}
              style={[styles.circleActionBtn, { backgroundColor: colors.inputBg }]}
            >
              <Ionicons name="camera-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setStatusImage(null);
                setModalNew(true);
              }}
              style={[styles.circleActionBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
          RECIENTES (24 HORAS)
        </Text>

        {statuses.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="aperture-outline" size={38} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={[styles.title, { color: colors.text, textAlign: 'center' }]}>
              Aún no hay estados recientes
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
              Usa los botones de cámara o lápiz arriba para compartir una foto, frase o sticker con tus amigos.
            </Text>
          </View>
        ) : (
          statuses.map((st) => {
            const { imageUri, caption } = parseStatusContent(st.content);
            const authorAvatar = st.user_avatar || st.avatar;
            const esAutorImg =
              authorAvatar &&
              (authorAvatar.startsWith('http') || authorAvatar.startsWith('data:image'));

            return (
              <TouchableOpacity
                key={st.id}
                onPress={() => setViewingStatus(st)}
                style={[styles.statusItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.statusRing, { borderColor: colors.primary }]}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.statusThumbImg} />
                  ) : esAutorImg ? (
                    <Image source={{ uri: authorAvatar }} style={styles.statusThumbImg} />
                  ) : (
                    <View
                      style={[
                        styles.statusPreviewCircle,
                        { backgroundColor: st.bg_color || '#065F46' },
                      ]}
                    >
                      <Text style={styles.statusPreviewText} numberOfLines={2}>
                        {caption}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {st.user_name} {st.user_phone === userProfile.phone ? '(Tú)' : ''}
                  </Text>
                  <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                    {imageUri ? `Foto ${caption ? '• ' + caption : ''}` : caption}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.timeTag, { color: colors.primary }]}>{st.time || 'Hoy'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
                    <Text style={{ fontSize: 10, color: colors.textMuted }}>E2EE</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* MODAL CREAR ESTADO (TEXTO, EMOJIS O FOTO) */}
      <Modal visible={modalNew} animationType="slide" transparent onRequestClose={() => setModalNew(false)}>
        <View style={[styles.fullModal, { backgroundColor: COLORES_FONDO[bgIndex] }]}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setModalNew(false)} style={styles.topPillBtn}>
              <Ionicons name="close" size={16} color="#FFF" />
              <Text style={styles.topBtn}>Cerrar</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={handlePickStatusPhoto} style={styles.topPillBtn}>
                <Ionicons name="camera-outline" size={16} color="#FFF" />
                <Text style={styles.topBtn}>Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setBgIndex((bgIndex + 1) % COLORES_FONDO.length)}
                style={styles.topPillBtn}
              >
                <Ionicons name="color-palette-outline" size={16} color="#FFF" />
                <Text style={styles.topBtn}>Fondo</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.centerInputWrap}>
            {statusImage && (
              <Image source={{ uri: statusImage }} style={styles.statusHeroPhoto} resizeMode="cover" />
            )}
            <TextInput
              style={[styles.bigInput, statusImage && { fontSize: 18, marginTop: 14 }]}
              placeholder={statusImage ? 'Añade un comentario o emoji a tu foto...' : 'Escribe un estado o toca un emoji...'}
              placeholderTextColor="rgba(255,255,255,0.65)"
              value={statusText}
              onChangeText={setStatusText}
              multiline
              maxLength={220}
            />
          </View>

          {/* BARRA RÁPIDA DE EMOJIS Y STICKERS PARA EL ESTADO */}
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiBarRow}
            >
              {EMOJIS_ESTADO.map((em) => (
                <TouchableOpacity
                  key={em}
                  onPress={() => setStatusText((prev) => prev + ' ' + em)}
                  style={styles.emojiChip}
                >
                  <Text style={{ fontSize: 22 }}>{em}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity onPress={handlePublish} style={styles.publishBtn}>
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.publishBtnText}>Publicar en Mi Estado (24h)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL VER ESTADO EN PANTALLA COMPLETA */}
      <Modal visible={!!viewingStatus} animationType="fade" transparent onRequestClose={() => setViewingStatus(null)}>
        {viewingStatus && (() => {
          const { imageUri, caption } = parseStatusContent(viewingStatus.content);
          return (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setViewingStatus(null)}
              style={[styles.fullModal, { backgroundColor: viewingStatus.bg_color || '#065F46' }]}
            >
              <View style={styles.progressBarWrap}>
                <View style={styles.progressBarFill} />
              </View>

              <View style={styles.viewerHeader}>
                <View>
                  <Text style={styles.viewerAuthor}>{viewingStatus.user_name}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                    {viewingStatus.time || 'Hace un momento'} • Cifrado E2EE
                  </Text>
                </View>
                <Ionicons name="close" size={26} color="#FFF" />
              </View>

              <View style={styles.centerInputWrap}>
                {imageUri && (
                  <Image source={{ uri: imageUri }} style={styles.viewerPhoto} resizeMode="contain" />
                )}
                {caption ? (
                  <Text style={[styles.viewerContent, imageUri && { fontSize: 20, marginTop: 16 }]}>
                    {caption}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.viewerHint}>Toca en cualquier lugar para cerrar</Text>
            </TouchableOpacity>
          );
        })()}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 20, fontWeight: '900', marginBottom: 12 },
  myStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
    gap: 10,
  },
  myStatusLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  plusCorner: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111b21',
  },
  quickActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
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
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  statusRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusThumbImg: { width: 46, height: 46, borderRadius: 23 },
  statusPreviewCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  statusPreviewText: { color: '#FFF', fontSize: 9, fontWeight: '800', textAlign: 'center' },
  timeTag: { fontSize: 11, fontWeight: '800' },
  fullModal: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 14 : 44,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBtn: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  topPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  centerInputWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  statusHeroPhoto: {
    width: '100%',
    height: 260,
    borderRadius: 18,
  },
  bigInput: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
  },
  emojiBarRow: {
    paddingVertical: 10,
    gap: 8,
  },
  emojiChip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00A884',
    paddingVertical: 16,
    borderRadius: 16,
  },
  publishBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  progressBarWrap: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#10B981',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewerAuthor: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  viewerPhoto: {
    width: '100%',
    height: 340,
    borderRadius: 18,
  },
  viewerContent: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  viewerHint: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: 12 },
});
