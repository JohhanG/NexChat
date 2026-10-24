import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, Image, Platform, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';
import {
  parsearColorYVistasEstado,
  calcularTiempoRestanteEstado,
} from '../lib/seguridad';

const COLORES_FONDO = ['#065F46', '#1E3A8A', '#7C2D12', '#581C87', '#831843', '#0F172A'];
const EMOJIS_ESTADO = ['😀', '😂', '😍', '🔥', '❤️', '🙏', '🎉', '🚀', '👑', '💯', '🐱💖', '😎🔥'];

export default function EstadosScreen({
  statuses = [],
  userProfile,
  onPublishStatus,
  onDeleteStatus,
  onViewStatus,
}) {
  const { colors } = useTheme();
  const [modalNew, setModalNew] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusImage, setStatusImage] = useState(null);
  const [bgIndex, setBgIndex] = useState(0);
  const [viewingStatus, setViewingStatus] = useState(null);
  const [viewersModalStatus, setViewersModalStatus] = useState(null);

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

  const handleOpenStatus = (st) => {
    setViewingStatus(st);
    if (onViewStatus && st.user_phone !== userProfile?.phone) {
      onViewStatus(st);
    }
  };

  const confirmarEliminarEstado = (st) => {
    Alert.alert(
      'Eliminar estado',
      '¿Quieres eliminar este estado para todos tus contactos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            if (onDeleteStatus) onDeleteStatus(st.id);
            if (viewingStatus?.id === st.id) setViewingStatus(null);
            if (viewersModalStatus?.id === st.id) setViewersModalStatus(null);
          },
        },
      ]
    );
  };

  // Filtrar estados activos (< 24 horas)
  const estadosVigentes = (Array.isArray(statuses) ? statuses : []).filter(
    (st) => !calcularTiempoRestanteEstado(st).expirado
  );

  const misEstados = estadosVigentes.filter((st) => st.user_phone === userProfile?.phone);
  const otrosEstados = estadosVigentes.filter((st) => st.user_phone !== userProfile?.phone);

  const initials =
    String(userProfile?.name || 'NC')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || 'NC';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Novedades y Estados</Text>
          <View style={[styles.autoExpireBadge, { backgroundColor: colors.primary + '1A' }]}>
            <Ionicons name="timer-outline" size={13} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>
              Auto-borrado 24h
            </Text>
          </View>
        </View>

        {/* TARJETA MI ESTADO ESTILO WHATSAPP */}
        <View style={[styles.myStatusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              setStatusImage(null);
              setModalNew(true);
            }}
            style={styles.myStatusLeft}
          >
            <View style={[styles.avatarRing, { borderColor: colors.primary, backgroundColor: '#0284C7' }]}>
              {esMiAvatarImagen ? (
                <Image source={{ uri: userProfile.avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900' }}>{initials}</Text>
              )}
              <View style={[styles.plusCorner, { backgroundColor: colors.primary }]}>
                <Ionicons name="add" size={14} color="#FFF" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Añadir a mi estado</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}>
                Desaparece automáticamente después de 24 horas
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

        {/* MIS ESTADOS PUBLICADOS (CON VISTAS Y BOTÓN ELIMINAR) */}
        {misEstados.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
              MIS ESTADOS ACTIVOS ({misEstados.length})
            </Text>
            {misEstados.map((st) => {
              const { imageUri, caption } = parseStatusContent(st.content);
              const { color: bgColor, views } = parsearColorYVistasEstado(st.bg_color);
              const restante = calcularTiempoRestanteEstado(st);

              return (
                <View
                  key={st.id}
                  style={[styles.statusItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <TouchableOpacity
                    onPress={() => handleOpenStatus(st)}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
                  >
                    <View style={[styles.statusRing, { borderColor: colors.primary }]}>
                      {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.statusThumbImg} />
                      ) : (
                        <View style={[styles.statusPreviewCircle, { backgroundColor: bgColor }]}>
                          <Text style={styles.statusPreviewText} numberOfLines={2}>
                            {caption}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {caption || 'Foto en mi estado'}
                      </Text>
                      <Text style={[styles.sub, { color: colors.textMuted }]}>
                        Publicado {st.time || 'Hoy'} • {restante.texto}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Botones de Quién vio mi estado y Eliminar */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setViewersModalStatus(st)}
                      style={[styles.viewsPillBtn, { backgroundColor: colors.inputBg }]}
                    >
                      <Ionicons name="eye-outline" size={16} color={colors.primary} />
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>
                        {views.length}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => confirmarEliminarEstado(st)}
                      style={[styles.deleteStatusIconBtn, { backgroundColor: 'rgba(239,68,68,0.14)' }]}
                    >
                      <Ionicons name="trash-outline" size={17} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
          ESTADOS RECIENTES DE CONTACTOS (24 HORAS)
        </Text>

        {otrosEstados.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="aperture-outline" size={38} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={[styles.title, { color: colors.text, textAlign: 'center' }]}>
              No hay estados recientes de tus contactos
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
              Los estados compartidos por tus amigos aparecerán aquí y se borrarán automáticamente a las 24 horas.
            </Text>
          </View>
        ) : (
          otrosEstados.map((st) => {
            const { imageUri, caption } = parseStatusContent(st.content);
            const { color: bgColor, views } = parsearColorYVistasEstado(st.bg_color);
            const restante = calcularTiempoRestanteEstado(st);
            const yaLoVi = views.some((v) => v.phone === userProfile?.phone);

            return (
              <TouchableOpacity
                key={st.id}
                onPress={() => handleOpenStatus(st)}
                style={[styles.statusItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View
                  style={[
                    styles.statusRing,
                    { borderColor: yaLoVi ? colors.textMuted : colors.primary },
                  ]}
                >
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.statusThumbImg} />
                  ) : (
                    <View style={[styles.statusPreviewCircle, { backgroundColor: bgColor }]}>
                      <Text style={styles.statusPreviewText} numberOfLines={2}>
                        {caption}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.text }]}>{st.user_name}</Text>
                  <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                    {imageUri ? `Foto ${caption ? '• ' + caption : ''}` : caption}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.timeTag, { color: colors.primary }]}>{st.time || 'Hoy'}</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                    {restante.texto}
                  </Text>
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
              <Text style={styles.publishBtnText}>Publicar Estado (Auto-borrado en 24h)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL VER ESTADO EN PANTALLA COMPLETA (CON VISTAS Y BORRADO SI ES MÍO) */}
      <Modal visible={!!viewingStatus} animationType="fade" transparent onRequestClose={() => setViewingStatus(null)}>
        {viewingStatus && (() => {
          const liveSt = statuses.find((s) => s.id === viewingStatus.id) || viewingStatus;
          const { imageUri, caption } = parseStatusContent(liveSt.content);
          const { color: bgColor, views } = parsearColorYVistasEstado(liveSt.bg_color);
          const restante = calcularTiempoRestanteEstado(liveSt);
          const esMio = liveSt.user_phone === userProfile?.phone;

          return (
            <View style={[styles.fullModal, { backgroundColor: bgColor }]}>
              <View>
                <View style={styles.progressBarWrap}>
                  <View style={styles.progressBarFill} />
                </View>

                <View style={styles.viewerHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewerAuthor}>
                      {liveSt.user_name} {esMio ? '(Tú)' : ''}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                      {liveSt.time || 'Hoy'} • {restante.texto}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {esMio && (
                      <TouchableOpacity
                        onPress={() => confirmarEliminarEstado(liveSt)}
                        style={styles.topPillBtn}
                      >
                        <Ionicons name="trash-outline" size={17} color="#FCA5A5" />
                        <Text style={[styles.topBtn, { color: '#FCA5A5' }]}>Eliminar</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setViewingStatus(null)} style={{ padding: 4 }}>
                      <Ionicons name="close" size={28} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => setViewingStatus(null)}
                style={styles.centerInputWrap}
              >
                {imageUri && (
                  <Image source={{ uri: imageUri }} style={styles.viewerPhoto} resizeMode="contain" />
                )}
                {caption ? (
                  <Text style={[styles.viewerContent, imageUri && { fontSize: 20, marginTop: 16 }]}>
                    {caption}
                  </Text>
                ) : null}
              </TouchableOpacity>

              {/* BARRA INFERIOR ESTILO WHATSAPP PARA VER QUIÉNES VIERON MI ESTADO */}
              {esMio ? (
                <TouchableOpacity
                  onPress={() => setViewersModalStatus(liveSt)}
                  style={styles.viewerBottomBar}
                >
                  <Ionicons name="eye-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.viewerBottomText}>
                    Visto por {views.length} {views.length === 1 ? 'persona' : 'personas'} • Toca para ver lista
                  </Text>
                  <Ionicons name="chevron-up" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <Text style={styles.viewerHint}>Toca en el centro para cerrar</Text>
              )}
            </View>
          );
        })()}
      </Modal>

      {/* MODAL HOJA INFERIOR: LISTA DE PERSONAS QUE VIERON MI ESTADO (ESTILO WHATSAPP) */}
      <Modal
        visible={!!viewersModalStatus}
        transparent
        animationType="slide"
        onRequestClose={() => setViewersModalStatus(null)}
      >
        {viewersModalStatus && (() => {
          const liveSt = statuses.find((s) => s.id === viewersModalStatus.id) || viewersModalStatus;
          const { views } = parsearColorYVistasEstado(liveSt.bg_color);

          return (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setViewersModalStatus(null)}
              style={styles.sheetBackdrop}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => {}}
                style={[styles.viewersSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.sheetHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="eye" size={20} color={colors.primary} />
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>
                      Visto por {views.length}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => confirmarEliminarEstado(liveSt)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setViewersModalStatus(null)} style={{ padding: 4 }}>
                      <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {views.length === 0 ? (
                  <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                    <Ionicons name="eye-off-outline" size={34} color={colors.textMuted} />
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 8 }}>
                      Aún sin visualizaciones
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                      Aquí aparecerán el nombre y la hora exacta cuando tus contactos abran tu estado.
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={{ maxHeight: 300 }}>
                    {views.map((v, idx) => {
                      const vInit =
                        String(v.name || v.phone || 'NC')
                          .replace(/[^a-zA-Z0-9]/g, '')
                          .slice(0, 2)
                          .toUpperCase() || 'NC';
                      return (
                        <View
                          key={`${v.phone}_${idx}`}
                          style={[styles.viewerRow, { borderColor: colors.border }]}
                        >
                          <View style={[styles.viewerAvatar, { backgroundColor: colors.primary }]}>
                            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13 }}>
                              {vInit}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                              {v.name || v.phone}
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                              {v.phone}
                            </Text>
                          </View>
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>
                            {v.time || 'Hoy'}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })()}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageTitle: { fontSize: 20, fontWeight: '900' },
  autoExpireBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
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
  viewsPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  deleteStatusIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  publishBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
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
  viewerBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 24,
  },
  viewerBottomText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  viewersSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 30,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  viewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
