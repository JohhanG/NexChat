import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Image, KeyboardAvoidingView, Platform, Modal, Alert, StatusBar
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';
import { generarHuellaSeguridad } from '../lib/seguridad';

const LISTA_EMOJIS = [
  '😀', '😂', '🤣', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😇',
  '🤔', '🤫', '🤭', '🙄', '😴', '🤯', '🥺', '😢', '😭', '😡',
  '❤️', '🔥', '✨', '💯', '👍', '👏', '🙏', '🤝', '💪', '🙌',
  '🎉', '🚀', '💎', '👑', '⚡', '🌟', '⚽', '🏆', '🎵', '🍕',
];

const LISTA_STICKERS = [
  { id: 'stk_1', icon: '🐱💖', label: 'Gatito Amor', bg: 'rgba(236,72,153,0.18)' },
  { id: 'stk_2', icon: '🐶🎉', label: 'Perrito Fiesta', bg: 'rgba(16,185,129,0.18)' },
  { id: 'stk_3', icon: '😎🔥', label: 'Modo Épico', bg: 'rgba(245,158,11,0.18)' },
  { id: 'stk_4', icon: '🤣💀', label: 'Muerto de Risa', bg: 'rgba(59,130,246,0.18)' },
  { id: 'stk_5', icon: '🙏✨', label: 'Bendiciones', bg: 'rgba(139,92,246,0.18)' },
  { id: 'stk_6', icon: '🚀🌕', label: 'A la Luna', bg: 'rgba(14,165,233,0.18)' },
  { id: 'stk_7', icon: '👑🦁', label: 'Rey Total', bg: 'rgba(234,179,8,0.18)' },
  { id: 'stk_8', icon: '❤️‍🔥🫂', label: 'Abrazo Fuerte', bg: 'rgba(239,68,68,0.18)' },
  { id: 'stk_9', icon: '☕😌', label: 'Cafecito Relax', bg: 'rgba(168,85,247,0.18)' },
  { id: 'stk_10', icon: '🫡🛡️', label: 'A la Orden', bg: 'rgba(20,184,166,0.18)' },
  { id: 'stk_11', icon: '🥳🎂', label: 'Celebración', bg: 'rgba(244,63,94,0.18)' },
  { id: 'stk_12', icon: '💯🏆', label: 'Campeón 100%', bg: 'rgba(34,197,94,0.18)' },
];

export default function ChatDetalleScreen({
  chat,
  userProfile,
  onBack,
  onSendMessage,
  onStartCall,
  onDeleteMessageForMe,
  onDeleteMessageForAll,
  onEditContactName,
  onClearChat,
  onDeleteChat,
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState('emojis'); // 'emojis' | 'stickers'
  const [ephemeralMode, setEphemeralMode] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Modal de Editar Contacto / Info E2EE
  const [infoModal, setInfoModal] = useState(false);
  const [editedName, setEditedName] = useState(chat.name || '');

  // Modal de Eliminar Mensaje (Para mí / Para todos / Cancelar)
  const [selectedMessage, setSelectedMessage] = useState(null);

  const scrollRef = useRef(null);

  useEffect(() => {
    setEditedName(chat.name || '');
  }, [chat.name]);

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
      mediaType: 'text',
      ephemeral: ephemeralMode,
    });
    setText('');
    setShowPicker(false);
  };

  const handleSendSticker = (stk) => {
    onSendMessage({
      text: `${stk.icon} ${stk.label}`,
      mediaUri: stk.icon,
      mediaType: 'sticker',
      ephemeral: ephemeralMode,
    });
    setShowPicker(false);
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

  const handleSaveContactName = () => {
    if (!editedName.trim()) {
      Alert.alert('Nombre vacío', 'Escribe un nombre válido para el contacto.');
      return;
    }
    if (onEditContactName) {
      onEditContactName(chat.id, editedName.trim());
    }
    setInfoModal(false);
  };

  const fingerprint = generarHuellaSeguridad(userProfile.phone, chat.peerPhone || chat.id);
  const esAvatarImagen =
    chat.avatar && (chat.avatar.startsWith('http') || chat.avatar.startsWith('data:image'));

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

        <TouchableOpacity
          style={styles.headerProfile}
          onPress={() => {
            setEditedName(chat.name || '');
            setInfoModal(true);
          }}
        >
          {esAvatarImagen ? (
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
                ? `Grupo • Toca para editar nombre`
                : `${chat.peerPhone || 'En línea'} • Toca para editar`}
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
              <TouchableOpacity
                onPress={() => {
                  setEditedName(chat.name || '');
                  setInfoModal(true);
                }}
                style={styles.actionBtn}
              >
                <Text style={styles.actionIcon}>✏️</Text>
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

      {/* BANNER CIFRADO E INSTRUCCIÓN DE ELIMINAR MENSAJE */}
      <TouchableOpacity
        onPress={() => setInfoModal(true)}
        style={[styles.e2eeBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.e2eeText, { color: colors.textMuted }]}>
          🔒 Cifrado E2EE (SHA-256) • 💡 Toca cualquier mensaje para eliminarlo (para ti o para todos)
          {ephemeralMode ? ' • ⏱️ Temp (15s) ACTIVO' : ''}
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
          const isDeleted =
            msg.deletedForAll ||
            msg.text === '🚫 Eliminaste este mensaje' ||
            msg.text === '🚫 Este mensaje fue eliminado';

          const isSticker =
            !isDeleted &&
            (msg.mediaType === 'sticker' ||
              (msg.text && LISTA_STICKERS.some((s) => msg.text === `${s.icon} ${s.label}`)));

          if (isSticker) {
            const stickerEmoji = msg.mediaUri || (msg.text || '').split(' ')[0] || '😎🔥';
            const stickerTitle = (msg.text || '').replace(stickerEmoji, '').trim();
            return (
              <TouchableOpacity
                key={msg.id}
                activeOpacity={0.8}
                onPress={() => setSelectedMessage(msg)}
                onLongPress={() => setSelectedMessage(msg)}
                style={[
                  styles.stickerBubble,
                  isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
                ]}
              >
                <View style={[styles.stickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.stickerBigEmoji}>{stickerEmoji}</Text>
                  {stickerTitle ? (
                    <Text style={[styles.stickerLabel, { color: colors.primary }]}>{stickerTitle}</Text>
                  ) : null}
                  <View style={styles.msgFooter}>
                    <Text style={[styles.msgTime, { color: colors.textMuted }]}>{msg.time}</Text>
                    {isMe && <Text style={styles.msgChecks}> ✓✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={msg.id}
              activeOpacity={0.82}
              onPress={() => setSelectedMessage(msg)}
              onLongPress={() => setSelectedMessage(msg)}
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

              {!isDeleted && msg.mediaType === 'image' && msg.mediaUri ? (
                <Image source={{ uri: msg.mediaUri }} style={styles.msgImage} resizeMode="cover" />
              ) : null}

              {!isDeleted && msg.mediaType === 'audio' ? (
                <View style={styles.audioRow}>
                  <Text style={{ fontSize: 20 }}>▶️ 🎵</Text>
                  <View style={styles.audioWave} />
                </View>
              ) : null}

              <Text
                style={[
                  styles.msgText,
                  { color: isMe ? colors.bubbleOutText : colors.bubbleInText },
                  isDeleted && { fontStyle: 'italic', opacity: 0.72 },
                ]}
              >
                {msg.text}
              </Text>

              <View style={styles.msgFooter}>
                {msg.ephemeral && !isDeleted && <Text style={{ fontSize: 10, marginRight: 4 }}>⏱️</Text>}
                <Text style={[styles.msgTime, { color: colors.textMuted }]}>{msg.time}</Text>
                {isMe && !isDeleted && <Text style={styles.msgChecks}> ✓✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* PANEL DE EMOJIS Y STICKERS ESTILO WHATSAPP */}
      {showPicker && (
        <View style={[styles.pickerPanel, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={[styles.pickerTabs, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setPickerTab('emojis')}
              style={[
                styles.pickerTabBtn,
                pickerTab === 'emojis' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
            >
              <Text style={[styles.pickerTabText, { color: pickerTab === 'emojis' ? colors.primary : colors.textMuted }]}>
                😊 Emojis ({LISTA_EMOJIS.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPickerTab('stickers')}
              style={[
                styles.pickerTabBtn,
                pickerTab === 'stickers' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
            >
              <Text style={[styles.pickerTabText, { color: pickerTab === 'stickers' ? colors.primary : colors.textMuted }]}>
                🎭 Stickers ({LISTA_STICKERS.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowPicker(false)} style={{ paddingHorizontal: 12 }}>
              <Text style={{ color: colors.textMuted, fontWeight: '900', fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {pickerTab === 'emojis' ? (
            <ScrollView style={{ maxHeight: 175 }} contentContainerStyle={styles.emojiGrid}>
              {LISTA_EMOJIS.map((em) => (
                <TouchableOpacity
                  key={em}
                  onPress={() => setText((prev) => prev + em)}
                  style={styles.emojiCell}
                >
                  <Text style={{ fontSize: 26 }}>{em}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <ScrollView style={{ maxHeight: 185 }} contentContainerStyle={styles.stickerGrid}>
              {LISTA_STICKERS.map((stk) => (
                <TouchableOpacity
                  key={stk.id}
                  onPress={() => handleSendSticker(stk)}
                  style={[styles.stickerItem, { backgroundColor: stk.bg, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 32 }}>{stk.icon}</Text>
                  <Text style={[styles.stickerItemLabel, { color: colors.text }]} numberOfLines={1}>
                    {stk.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
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
          <TouchableOpacity
            onPress={() => {
              setPickerTab('emojis');
              setShowPicker(!showPicker);
            }}
            style={styles.iconBtn}
          >
            <Text style={{ fontSize: 22 }}>😊</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setPickerTab('stickers');
              setShowPicker(true);
            }}
            style={styles.iconBtn}
          >
            <Text style={{ fontSize: 21 }}>🎭</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handlePickImage} style={styles.iconBtn}>
            <Text style={{ fontSize: 21 }}>📷</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            placeholder={recordingAudio ? `🔴 Grabando (${recordSeconds}s)...` : 'Mensaje o sticker...'}
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

      {/* MODAL ELIMINAR MENSAJE (PARA MÍ / PARA TODOS / CANCELAR) ESTILO WHATSAPP */}
      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.deleteModalTitle, { color: colors.text }]}>
              ¿Deseas eliminar este mensaje?
            </Text>

            {selectedMessage && (
              <View style={[styles.msgPreviewBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={2}>
                  "{selectedMessage.text}"
                </Text>
              </View>
            )}

            {/* Opción 1: Eliminar para todos */}
            <TouchableOpacity
              onPress={() => {
                if (onDeleteMessageForAll && selectedMessage) {
                  onDeleteMessageForAll(chat.id, selectedMessage.id);
                }
                setSelectedMessage(null);
              }}
              style={[styles.deleteOptionBtn, { borderBottomWidth: 1, borderColor: colors.border }]}
            >
              <Text style={[styles.deleteOptionText, { color: '#EF4444' }]}>
                🚫 Eliminar para todos
              </Text>
            </TouchableOpacity>

            {/* Opción 2: Eliminar para mí */}
            <TouchableOpacity
              onPress={() => {
                if (onDeleteMessageForMe && selectedMessage) {
                  onDeleteMessageForMe(chat.id, selectedMessage.id);
                }
                setSelectedMessage(null);
              }}
              style={[styles.deleteOptionBtn, { borderBottomWidth: 1, borderColor: colors.border }]}
            >
              <Text style={[styles.deleteOptionText, { color: colors.primary }]}>
                🗑️ Eliminar para mí
              </Text>
            </TouchableOpacity>

            {/* Opción 3: Cancelar */}
            <TouchableOpacity
              onPress={() => setSelectedMessage(null)}
              style={styles.deleteOptionBtn}
            >
              <Text style={[styles.deleteOptionText, { color: colors.textMuted }]}>
                ✕ Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL EDITAR CONTACTO + VERIFICACIÓN E2EE */}
      <Modal visible={infoModal} transparent animationType="fade" onRequestClose={() => setInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {chat.official ? '🛡️ Canal Oficial Verificado' : '✏️ Editar Contacto y Seguridad'}
            </Text>

            {!chat.official && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  NOMBRE DEL CONTACTO / GRUPO
                </Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={editedName}
                  onChangeText={setEditedName}
                  placeholder="Nombre del contacto"
                  placeholderTextColor={colors.textMuted}
                />
                {chat.peerPhone && (
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', marginTop: 6 }}>
                    📱 Número: {chat.peerPhone}
                  </Text>
                )}

                <TouchableOpacity
                  onPress={handleSaveContactName}
                  style={[styles.saveContactBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: '#052E16', fontWeight: '900', fontSize: 14 }}>
                    💾 Guardar Nombre del Contacto
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: colors.textMuted, textAlign: 'center' }]}>
              🔒 HUELLA CRIPTOGRÁFICA E2EE (40 DÍGITOS)
            </Text>
            <View style={[styles.fingerprintBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[styles.fingerprintText, { color: colors.primary }]}>{fingerprint}</Text>
            </View>

            {!chat.official && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (onClearChat) onClearChat(chat.id);
                    setInfoModal(false);
                  }}
                  style={[styles.dangerSmallBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>🧹 Vaciar chat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (onDeleteChat) onDeleteChat(chat.id);
                    setInfoModal(false);
                  }}
                  style={[styles.dangerSmallBtn, { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.12)' }]}
                >
                  <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '800' }}>🗑️ Eliminar contacto</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setInfoModal(false)}
              style={[styles.closeModalBtn, { backgroundColor: colors.inputBg }]}
            >
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>Cerrar</Text>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 10,
    paddingBottom: 12,
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: { padding: 7 },
  actionIcon: { fontSize: 17 },
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
  stickerBubble: {
    marginBottom: 10,
  },
  stickerCard: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
  },
  stickerBigEmoji: { fontSize: 54, marginBottom: 4 },
  stickerLabel: { fontSize: 12, fontWeight: '900', marginBottom: 2 },
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
  pickerPanel: {
    borderTopWidth: 1,
    paddingBottom: 6,
  },
  pickerTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  pickerTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pickerTabText: { fontSize: 13, fontWeight: '800' },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 8,
    gap: 6,
  },
  emojiCell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 10,
    gap: 8,
  },
  stickerItem: {
    width: '31%',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  stickerItemLabel: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 14 : 8,
    borderTopWidth: 1,
    gap: 4,
  },
  iconBtn: { padding: 5 },
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 22,
  },
  deleteModalCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  deleteModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  msgPreviewBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  deleteOptionBtn: {
    paddingVertical: 14,
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  deleteOptionText: {
    fontSize: 15,
    fontWeight: '900',
  },
  modalCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  saveContactBtn: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  fingerprintBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 14,
  },
  fingerprintText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 22,
  },
  dangerSmallBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeModalBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
});
