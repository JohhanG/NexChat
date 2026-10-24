import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const COLORES_FONDO = ['#065F46', '#1E3A8A', '#7C2D12', '#581C87', '#831843', '#0F172A'];

export default function EstadosScreen({ statuses, userProfile, onPublishStatus }) {
  const { colors } = useTheme();
  const [modalNew, setModalNew] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [viewingStatus, setViewingStatus] = useState(null);

  const handlePublish = () => {
    if (!statusText.trim()) {
      Alert.alert('Estado vacío', 'Escribe algo para compartir en tu estado de 24 horas.');
      return;
    }
    onPublishStatus(statusText.trim(), COLORES_FONDO[bgIndex]);
    setStatusText('');
    setModalNew(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* MI ESTADO */}
        <TouchableOpacity
          onPress={() => setModalNew(true)}
          style={[styles.myStatusCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
            <Text style={{ fontSize: 26 }}>{userProfile.avatar?.startsWith('data:') ? '📸' : (userProfile.avatar || '😎')}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Mi Estado (24h)</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>Toca para publicar una actualización de estado</Text>
          </View>
          <View style={[styles.plusBadge, { backgroundColor: colors.primary }]}>
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 18 }}>+</Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
          ESTADOS RECIENTES DE LA COMUNIDAD GLOBAL
        </Text>

        {statuses.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>⭕</Text>
            <Text style={[styles.title, { color: colors.text, textAlign: 'center' }]}>
              Aún no hay estados publicados hoy
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
              Sé el primero en publicar un estado cifrado de 24 horas.
            </Text>
          </View>
        ) : (
          statuses.map((st) => (
            <TouchableOpacity
              key={st.id}
              onPress={() => setViewingStatus(st)}
              style={[styles.statusItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.statusPreviewCircle, { backgroundColor: st.bg_color || '#065F46' }]}>
                <Text style={styles.statusPreviewText} numberOfLines={1}>{st.content}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {st.user_name} {st.user_phone === userProfile.phone ? '(Tú)' : ''}
                </Text>
                <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                  {st.content}
                </Text>
              </View>
              <Text style={[styles.timeTag, { color: colors.primary }]}>24h</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* MODAL CREAR ESTADO */}
      <Modal visible={modalNew} animationType="slide" transparent onRequestClose={() => setModalNew(false)}>
        <View style={[styles.fullModal, { backgroundColor: COLORES_FONDO[bgIndex] }]}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setModalNew(false)}>
              <Text style={styles.topBtn}>✕ Cerrar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setBgIndex((bgIndex + 1) % COLORES_FONDO.length)}
              style={styles.paletteBtn}
            >
              <Text style={styles.topBtn}>🎨 Cambiar Fondo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.centerInputWrap}>
            <TextInput
              style={styles.bigInput}
              placeholder="Escribe un estado..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={statusText}
              onChangeText={setStatusText}
              multiline
              maxLength={220}
              autoFocus
            />
          </View>

          <TouchableOpacity onPress={handlePublish} style={styles.publishBtn}>
            <Text style={styles.publishBtnText}>🚀 Publicar Estado (24h)</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* MODAL VER ESTADO */}
      <Modal visible={!!viewingStatus} animationType="fade" transparent onRequestClose={() => setViewingStatus(null)}>
        {viewingStatus && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setViewingStatus(null)}
            style={[styles.fullModal, { backgroundColor: viewingStatus.bg_color || '#065F46' }]}
          >
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerAuthor}>{viewingStatus.avatar || '⭕'} {viewingStatus.user_name}</Text>
              <Text style={styles.viewerClose}>✕</Text>
            </View>
            <View style={styles.centerInputWrap}>
              <Text style={styles.viewerContent}>{viewingStatus.content}</Text>
            </View>
            <Text style={styles.viewerHint}>Toca en cualquier lugar para cerrar</Text>
          </TouchableOpacity>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  myStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 20,
  },
  avatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
  plusBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  statusPreviewCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  statusPreviewText: { color: '#FFF', fontSize: 9, fontWeight: '800', textAlign: 'center' },
  timeTag: { fontSize: 11, fontWeight: '800' },
  fullModal: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  topBtn: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  paletteBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  centerInputWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bigInput: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
  },
  publishBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  publishBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  viewerAuthor: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  viewerClose: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  viewerContent: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  viewerHint: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: 12, marginBottom: 12 },
});
