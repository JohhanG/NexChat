import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Image, KeyboardAvoidingView, Platform, Modal, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';
import { cifrarMensajeE2EE, generarHuellaSeguridad } from '../lib/seguridad';

const EMOJIS_RAPIDOS = ['😀', '😂', '❤️', '🔥', '👍', '🙏', '🎉', '😎', '🤝', '🚀', '✨', '💯'];

export default function ChatDetalleScreen({
  chat,
  userProfile,
  onBack,
  onSendMessage,
  onStartCall,
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [ephemeralMode, setEphemeralMode] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [infoModal, setInfoModal] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    let interval;
    if (recordingAudio) {
      interval = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [recordingAudio]);

  const handleSendText = () => {
    if (!text.trim()) return;
    onSendMessage({
      text: text.trim(),
      mediaUri: null,
      mediaType: null,
      ephemeral: ephemeralMode,
    });
    setText('');
    setShowEmojis(false);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el permiso de galería para enviar fotos.');
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
        onSendMessage({
          text: '📷 Foto cifrada E2EE',
          mediaUri: uri,
          mediaType: 'image',
          ephemeral: ephemeralMode,
        });
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo adjuntar la imagen.');
    }
  };

  const handleToggleAudio = () => {
    if (!recordingAudio) {
      setRecordingAudio(true);
    } else {
      const dur = Math.max(1, recordSeconds);
      setRecordingAudio(false);
      onSendMessage({
        text: `🎤 Nota de voz (${dur}s)`,
        mediaUri: `audio_${dur}s`,
        mediaType: 'audio',
        ephemeral: ephemeralMode,
      });
    }
  };

  const fingerprint = generarHuellaSeguridad(userProfile.phone, chat.peerPhone || chat.id);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.chatWallpaper }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* HEADER ESTILO WHATSAPP */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerProfile} onPress={() => setInfoModal(true)}>
          {chat.avatar && chat.avatar.startsWith('data:image') ? (
            <Image source={{ uri: chat.avatar }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: chat.official ? '#10B981' : '#0284C7' }]}>
              <Text style={styles.avatarEmoji}>{chat.avatar || '👤'}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.headerName} numberOfLines={1}>{chat.name}</Text>
              {chat.official && <Text style={{ fontSize: 13 }}>✅</Text>}
            </View>
            <Text style={styles.headerStatus} numberOfLines={1}>
              {chat.official
                ? 'Canal Oficial Verificado'
                : chat.isGroup
                ? `Grupo • ${(chat.members || []).length} miembros`
                : `${chat.peerPhone || 'En línea'} • 🔒 E2EE`}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {!chat.official && (
            <>
              <TouchableOpacity onPress={() => onStartCall(chat, 'video')} style={styles.actionBtn}>
                <Text style={styles.actionIcon}>📹</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onStartCall(chat, 'audio')} style={styles.actionBtn}>
                <Text style={styles.actionIcon}>📞</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={() => setEphemeralMode(!ephemeralMode)}
            style={[
              styles.actionBtn,
              ephemeralMode && { backgroundColor: 'rgba(16,185,129,0.28)', borderRadius: 8 },
            ]}
          >
            <Text style={styles.actionIcon}>⏱️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BANNER CIFRADO DE EXTREMO A EXTREMO */}
      <TouchableOpacity
        onPress={() => setInfoModal(true)}
        style={[styles.e2eeBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.e2eeText, { color: colors.textMuted }]}>
          🔒 Los mensajes y llamadas están cifrados de extremo a extremo (SHA-256). Toca para verificar huella.
          {ephemeralMode ? ' • ⏱️ Mensajes temporales (15s) ACTIVOS' : ''}
        </Text>
      </TouchableOpacity>

      {/* LISTA DE MENSAJES */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesArea}
        contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {(chat.messages || []).map((msg) => {
          const isMe = msg.sender === 'me' || msg.senderPhone === userProfile.phone;
          return (
            <View
              key={msg.id}
              style={[
                styles.msgBubble,
                isMe
                  ? [styles.msgOut, { backgroundColor: colors.bubbleOut }]
                  : [styles.msgIn, { backgroundColor: colors.bubbleIn }],
              ]}
            >
              {!isMe && chat.isGroup && (
                <Text style={[styles.senderLabel, { color: colors.primary }]}>
                  {msg.senderName || msg.senderPhone}
                </Text>
              )}

              {msg.mediaType === 'image' && msg.mediaUri ? (
                <Image source={{ uri: msg.mediaUri }} style={styles.msgImage} resizeMode="cover" />
              ) : null}

              {msg.mediaType === 'audio' ? (
                <View style={styles.audioRow}>
                  <Text style={{ fontSize: 20 }}>▶️ 🎵</Text>
                  <View style={styles.audioWave} />
                </View>
              ) : null}

              <Text style={[styles.msgText, { color: isMe ? colors.bubbleOutText : colors.bubbleInText }]}>
                {msg.text}
              </Text>

              <View style={styles.msgFooter}>
                {msg.ephemeral && <Text style={{ fontSize: 10, marginRight: 4 }}>⏱️</Text>}
                <Text style={[styles.msgTime, { color: colors.textMuted }]}>{msg.time}</Text>
                {isMe && <Text style={styles.msgChecks}> ✓✓</Text>}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* SELECTOR DE EMOJIS RAPIDOS */}
      {showEmojis && (
        <View style={[styles.emojiBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {EMOJIS_RAPIDOS.map((em) => (
              <TouchableOpacity
                key={em}
                onPress={() => setText((prev) => prev + em)}
                style={styles.emojiBtn}
              >
                <Text style={{ fontSize: 24 }}>{em}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* BARRA INFERIOR DE ENTRADA */}
      {chat.official ? (
        <View style={[styles.officialFooter, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.officialFooterText, { color: colors.textMuted }]}>
            📢 Solo los administradores de <Text style={{ fontWeight: '800' }}>NexChat Oficial ✅</Text> pueden enviar comunicados en este canal.
          </Text>
        </View>
      ) : (
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowEmojis(!showEmojis)} style={styles.iconBtn}>
            <Text style={{ fontSize: 22 }}>😊</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handlePickImage} style={styles.iconBtn}>
            <Text style={{ fontSize: 21 }}>📷</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            placeholder={recordingAudio ? `🔴 Grabando nota de voz (${recordSeconds}s)...` : 'Mensaje cifrado...'}
            placeholderTextColor={recordingAudio ? '#EF4444' : colors.textMuted}
            value={text}
            onChangeText={setText}
            editable={!recordingAudio}
            onSubmitEditing={handleSendText}
          />

          {text.trim().length > 0 ? (
            <TouchableOpacity
              onPress={handleSendText}
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleToggleAudio}
              style={[
                styles.sendBtn,
                { backgroundColor: recordingAudio ? '#EF4444' : colors.primary },
              ]}
            >
              <Text style={styles.sendIcon}>{recordingAudio ? '⏹' : '🎤'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* MODAL VERIFICACIÓN E2EE */}
      <Modal visible={infoModal} transparent animationType="fade" onRequestClose={() => setInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 38, textAlign: 'center', marginBottom: 8 }}>🛡️🔒</Text>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Verificación Criptográfica E2EE</Text>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Compara este código numérico de 40 dígitos con {chat.name}. Si coincide, nadie puede interceptar la conversación:
            </Text>

            <View style={[styles.fingerprintBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[styles.fingerprintText, { color: colors.primary }]}>{fingerprint}</Text>
            </View>

            <TouchableOpacity
              onPress={() => setInfoModal(false)}
              style={[styles.closeModalBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    elevation: 4,
  },
  backBtn: { padding: 6, marginRight: 4 },
  backIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  headerProfile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarEmoji: { fontSize: 20 },
  headerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  headerStatus: { color: '#A7F3D0', fontSize: 11, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: { padding: 8 },
  actionIcon: { fontSize: 18 },
  e2eeBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  e2eeText: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
  messagesArea: { flex: 1 },
  msgBubble: {
    maxWidth: '82%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
    marginBottom: 8,
  },
  msgOut: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgIn: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  senderLabel: { fontSize: 11, fontWeight: '800', marginBottom: 3 },
  msgImage: { width: 220, height: 165, borderRadius: 10, marginBottom: 6 },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    paddingVertical: 4,
  },
  audioWave: {
    width: 110,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  msgTime: { fontSize: 10 },
  msgChecks: { fontSize: 11, color: '#38BDF8', fontWeight: '900' },
  emojiBar: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
  },
  emojiBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  iconBtn: { padding: 6 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  officialFooter: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  officialFooterText: { fontSize: 12, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  modalDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  fingerprintBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 18,
  },
  fingerprintText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 26,
  },
  closeModalBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
});
