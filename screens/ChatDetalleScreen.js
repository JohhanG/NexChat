import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Image, KeyboardAvoidingView, Platform, Modal, Alert, StatusBar, BackHandler
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { generarHuellaSeguridad, formatearEstadoConexion, esAdminOficialNexChat } from '../lib/seguridad';

const LISTA_EMOJIS = [
  '😀', '😂', '🤣', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😇',
  '🤔', '🤫', '🤭', '🙄', '😴', '🤯', '🥺', '😢', '😭', '😡',
  '❤️', '🔥', '✨', '💯', '👍', '👏', '🙏', '🤝', '💪', '🙌',
  '🎉', '🚀', '💎', '👑', '⚡', '🌟', '⚽', '🏆', '🎵', '🍕',
];

const LISTA_STICKERS = [
  { id: 'stk_1', icon: '🐱💖', label: 'Gatito Amor', bg: 'rgba(236,72,153,0.15)' },
  { id: 'stk_2', icon: '🐶🎉', label: 'Perrito Fiesta', bg: 'rgba(16,185,129,0.15)' },
  { id: 'stk_3', icon: '😎🔥', label: 'Modo Épico', bg: 'rgba(245,158,11,0.15)' },
  { id: 'stk_4', icon: '🤣💀', label: 'Muerto de Risa', bg: 'rgba(59,130,246,0.15)' },
  { id: 'stk_5', icon: '🙏✨', label: 'Bendiciones', bg: 'rgba(139,92,246,0.15)' },
  { id: 'stk_6', icon: '🚀🌕', label: 'A la Luna', bg: 'rgba(14,165,233,0.15)' },
  { id: 'stk_7', icon: '👑🦁', label: 'Rey Total', bg: 'rgba(234,179,8,0.15)' },
  { id: 'stk_8', icon: '❤️‍🔥🫂', label: 'Abrazo Fuerte', bg: 'rgba(239,68,68,0.15)' },
  { id: 'stk_9', icon: '☕😌', label: 'Cafecito Relax', bg: 'rgba(168,85,247,0.15)' },
  { id: 'stk_10', icon: '🫡🛡️', label: 'A la Orden', bg: 'rgba(20,184,166,0.15)' },
  { id: 'stk_11', icon: '🥳🎂', label: 'Celebración', bg: 'rgba(244,63,94,0.15)' },
  { id: 'stk_12', icon: '💯🏆', label: 'Campeón 100%', bg: 'rgba(34,197,94,0.15)' },
];

function obtenerIniciales(nombre = '') {
  const limpio = String(nombre).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ+ ]/g, '').trim();
  if (!limpio) return 'NC';
  if (limpio.startsWith('+')) return limpio.slice(0, 3);
  const partes = limpio.split(' ').filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return limpio.slice(0, 2).toUpperCase();
}

export default function ChatDetalleScreen({
  chat,
  userProfile,
  usersPresence = {},
  allChats = [],
  onBack,
  onSendMessage,
  onStartCall,
  onDeleteMessageForMe,
  onDeleteMessageForAll,
  onEditContactName,
  onUpdateGroupMembers,
  onClearChat,
  onDeleteChat,
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState('emojis');
  const [ephemeralMode, setEphemeralMode] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Reproductor de audio / nota de voz
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioSeconds, setAudioSeconds] = useState(0);

  // Foto y Bio del amigo obtenidas en tiempo real
  const [livePeerAvatar, setLivePeerAvatar] = useState(null);
  const [livePeerBio, setLivePeerBio] = useState(null);

  // Modal Ficha de Contacto (Estilo WhatsApp & Telegram)
  const [infoModal, setInfoModal] = useState(false);
  const [editedName, setEditedName] = useState(chat.name || '');
  const [showAddGroupMembers, setShowAddGroupMembers] = useState(false);

  // Modal Eliminar Mensaje
  const [selectedMessage, setSelectedMessage] = useState(null);

  const scrollRef = useRef(null);

  useEffect(() => {
    setEditedName(chat.name || '');
  }, [chat.name]);

  // Cargar foto real del contacto desde presencia o Supabase para ver su avatar aunque no esté guardado
  useEffect(() => {
    if (chat.isGroup || chat.official) return;
    const phoneToSearch = chat.peerPhone || chat.phone;
    const digits = String(phoneToSearch || '').replace(/[^0-9]/g, '');
    if (!digits) return;

    const fromPres =
      usersPresence[digits] ||
      Object.values(usersPresence || {}).find(
        (u) => String(u?.phone || '').replace(/[^0-9]/g, '') === digits
      );
    if (
      fromPres?.avatar &&
      (fromPres.avatar.startsWith('http') || fromPres.avatar.startsWith('data:image'))
    ) {
      setLivePeerAvatar(fromPres.avatar);
      if (fromPres.bio) setLivePeerBio(fromPres.bio);
      return;
    }

    import('../lib/supabase').then(({ supabase }) => {
      supabase
        .from('nexchat_users')
        .select('avatar,bio,name')
        .or(`phone.ilike.%${digits}%,id.ilike.%${digits}%`)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (
            data?.avatar &&
            (data.avatar.startsWith('http') || data.avatar.startsWith('data:image'))
          ) {
            setLivePeerAvatar(data.avatar);
          }
          if (data?.bio) setLivePeerBio(data.bio);
        })
        .catch(() => {});
    });
  }, [chat.id, chat.peerPhone, chat.phone, usersPresence]);

  // Instancias de grabación y reproducción con expo-av
  const recordingInstanceRef = useRef(null);
  const soundPlayerRef = useRef(null);

  // Temporizador para reproducción de nota de voz
  useEffect(() => {
    let timer;
    if (playingAudioId) {
      timer = setInterval(() => {
        setAudioSeconds((s) => s + 1);
      }, 1000);
    } else {
      setAudioSeconds(0);
    }
    return () => clearInterval(timer);
  }, [playingAudioId]);

  // Limpiar reproductor al desmontar
  useEffect(() => {
    return () => {
      if (soundPlayerRef.current) {
        soundPlayerRef.current.unloadAsync().catch(() => {});
      }
      try {
        Speech.stop();
      } catch {}
    };
  }, []);

  const handleTogglePlayAudio = async (msg) => {
    if (!msg?.id) return;
    if (playingAudioId === msg.id) {
      if (soundPlayerRef.current) {
        try {
          await soundPlayerRef.current.stopAsync();
          await soundPlayerRef.current.unloadAsync();
        } catch {}
        soundPlayerRef.current = null;
      }
      try {
        Speech.stop();
      } catch {}
      setPlayingAudioId(null);
      return;
    }

    // Detener cualquier audio previo
    if (soundPlayerRef.current) {
      try {
        await soundPlayerRef.current.stopAsync();
        await soundPlayerRef.current.unloadAsync();
      } catch {}
      soundPlayerRef.current = null;
    }
    try {
      Speech.stop();
    } catch {}

    setPlayingAudioId(msg.id);
    setAudioSeconds(0);

    // 1. Si es audio grabado real en Base64 o URL (expo-av)
    if (msg.mediaUri && (msg.mediaUri.startsWith('data:audio') || msg.mediaUri.startsWith('data:') || msg.mediaUri.startsWith('http') || msg.mediaUri.startsWith('file:'))) {
      try {
        let playbackUri = msg.mediaUri;
        if (msg.mediaUri.startsWith('data:')) {
          const base64Data = msg.mediaUri.split(',')[1] || msg.mediaUri;
          const tempPath = `${FileSystem.cacheDirectory}audio_${msg.id || Date.now()}.m4a`;
          await FileSystem.writeAsStringAsync(tempPath, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          playbackUri = tempPath;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: playbackUri },
          { shouldPlay: true }
        );
        soundPlayerRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              setPlayingAudioId(null);
              sound.unloadAsync().catch(() => {});
              soundPlayerRef.current = null;
            }
          } else if (status.error) {
            setPlayingAudioId(null);
          }
        });
        return;
      } catch (err) {
        // Fallback a Speech si hubo error de códec
      }
    }

    // 2. Fallback a Speech para notas de texto a voz
    let textoParaHablar = '';
    if (msg.mediaUri && String(msg.mediaUri).startsWith('VOICE::')) {
      textoParaHablar = String(msg.mediaUri).replace('VOICE::', '');
    } else if (msg.text && !msg.text.startsWith('🎤 Nota de voz')) {
      textoParaHablar = msg.text.replace(/^🎤\s*/, '').replace(/\(\d+s\)$/, '').trim();
    } else {
      textoParaHablar = 'Nota de voz de audio.';
    }

    try {
      Speech.speak(textoParaHablar, {
        language: 'es-US',
        pitch: 1.0,
        rate: 0.95,
        onDone: () => {
          setPlayingAudioId(null);
        },
        onError: () => {
          setPlayingAudioId(null);
        },
      });
    } catch {
      setPlayingAudioId(null);
    }
  };

  // Permitir volver atrás deslizando el borde o con el botón Atrás de Android sin cerrar la app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (infoModal) {
        setInfoModal(false);
        return true;
      }
      if (selectedMessage) {
        setSelectedMessage(null);
        return true;
      }
      if (showPicker) {
        setShowPicker(false);
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [infoModal, selectedMessage, showPicker, onBack]);

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
        quality: 0.28,
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

  const handleToggleAudio = async () => {
    if (!recordingAudio) {
      // Iniciar grabación real de micrófono
      try {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permiso de micrófono', 'Permite el acceso al micrófono en los ajustes para grabar notas de voz.');
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.LOW_QUALITY
        );
        recordingInstanceRef.current = recording;
        setRecordingAudio(true);
        setRecordSeconds(0);
      } catch (e) {
        // Fallback
        setRecordingAudio(true);
        setRecordSeconds(0);
      }
    } else {
      // Detener grabación y enviar audio real M4A en base64
      const dur = Math.max(1, recordSeconds);
      setRecordingAudio(false);

      if (recordingInstanceRef.current) {
        try {
          await recordingInstanceRef.current.stopAndUnloadAsync();
          const uri = recordingInstanceRef.current.getURI();
          recordingInstanceRef.current = null;
          if (uri) {
            const b64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const audioDataUri = `data:audio/m4a;base64,${b64}`;
            onSendMessage({
              text: `🎤 Nota de voz (${dur}s)`,
              mediaUri: audioDataUri,
              mediaType: 'audio',
              ephemeral: ephemeralMode,
            });
            setText('');
            return;
          }
        } catch (err) {
          recordingInstanceRef.current = null;
        }
      }

      // Fallback si no hubo stream de micrófono directo
      const audioContent = text.trim() || `Mensaje de voz de ${userProfile.name || userProfile.phone || 'NexChat'}`;
      onSendMessage({
        text: text.trim() ? `🎤 "${text.trim()}" (${dur}s)` : `🎤 Nota de voz (${dur}s)`,
        mediaUri: `VOICE::${audioContent}`,
        mediaType: 'audio',
        ephemeral: ephemeralMode,
      });
      setText('');
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
  const bloquesHuella = fingerprint.split(/\s+/).filter(Boolean);
  const soyAdminOficial = esAdminOficialNexChat(userProfile);
  const estadoConexion = formatearEstadoConexion(
    chat.peerPhone || chat.phone,
    usersPresence,
    chat.official,
    chat.isGroup,
    chat.members?.length
  );

  // Contactos de mi agenda para añadir rápidamente a un grupo
  const contactosDisponiblesGrupo = (Array.isArray(allChats) ? allChats : [])
    .filter((c) => c && !c.official && !c.isGroup && (c.peerPhone || c.phone))
    .map((c) => ({
      phone: c.peerPhone || c.phone,
      name: c.name || c.peerPhone || c.phone,
    }));

  const peerDigits = String(chat.peerPhone || chat.phone || '').replace(/[^0-9]/g, '');
  const peerRecord = (peerDigits && usersPresence[peerDigits]) || null;
  const avatarEfectivo =
    livePeerAvatar ||
    (chat.avatar && (chat.avatar.startsWith('http') || chat.avatar.startsWith('data:image')) && chat.avatar) ||
    (peerRecord?.avatar && (peerRecord.avatar.startsWith('http') || peerRecord.avatar.startsWith('data:image')) && peerRecord.avatar);

  const renderAvatarCircle = (size = 42) => {
    if (avatarEfectivo) {
      return (
        <Image
          source={{ uri: avatarEfectivo }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#202c33' }}
        />
      );
    }
    if (chat.official) {
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#00A884',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="shield-checkmark" size={size * 0.52} color="#FFFFFF" />
        </View>
      );
    }
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: chat.isGroup ? '#0284C7' : '#00A884',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: size * 0.38, fontWeight: '900' }}>
          {obtenerIniciales(chat.name)}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.chatWallpaper }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* BARRA SUPERIOR ESTILO WHATSAPP & TELEGRAM CON ICONOS VECTORIALES NÍTIDOS */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfile}
          onPress={() => {
            setEditedName(chat.name || '');
            setInfoModal(true);
          }}
        >
          {renderAvatarCircle(42)}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.headerName} numberOfLines={1}>{chat.name}</Text>
              {chat.official && <Ionicons name="checkmark-circle" size={16} color="#00A884" />}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: estadoConexion.isOnline ? '#10B981' : '#94A3B8',
                }}
              />
              <Text
                style={[
                  styles.headerStatus,
                  estadoConexion.isOnline && { color: '#34D399', fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {estadoConexion.headerText}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {!chat.official && (
            <>
              <TouchableOpacity onPress={() => onStartCall(chat, 'video')} style={styles.headerIconBtn}>
                <Ionicons name="videocam-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onStartCall(chat, 'audio')} style={styles.headerIconBtn}>
                <Ionicons name="call-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={() => setEphemeralMode(!ephemeralMode)}
            style={[
              styles.headerIconBtn,
              ephemeralMode && { backgroundColor: 'rgba(0,168,132,0.28)' },
            ]}
          >
            <Ionicons
              name="timer-outline"
              size={21}
              color={ephemeralMode ? '#00A884' : '#FFFFFF'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setEditedName(chat.name || '');
              setInfoModal(true);
            }}
            style={styles.headerIconBtn}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* PÍLDORA ELEGANTE DE CIFRADO E2EE ESTILO WHATSAPP */}
      <TouchableOpacity
        onPress={() => setInfoModal(true)}
        style={[styles.e2eeBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Ionicons name="lock-closed" size={13} color={colors.primary} />
        <Text style={[styles.e2eeText, { color: colors.textMuted }]}>
          Mensajes cifrados de extremo a extremo • Deja presionado un mensaje para eliminarlo.
          {ephemeralMode ? ' • ⏱️ 15s Activo' : ''}
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
                activeOpacity={0.88}
                onLongPress={() => setSelectedMessage(msg)}
                delayLongPress={320}
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
                    {isMe && (
                      <Ionicons name="checkmark-done" size={14} color="#53BDEB" style={{ marginLeft: 4 }} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          const isAudio = !isDeleted && msg.mediaType === 'audio';
          const isPlayingThis = playingAudioId === msg.id;

          return (
            <TouchableOpacity
              key={msg.id}
              activeOpacity={0.88}
              onPress={() => {
                if (isAudio) {
                  handleTogglePlayAudio(msg);
                }
              }}
              onLongPress={() => setSelectedMessage(msg)}
              delayLongPress={320}
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

              {isAudio ? (
                <View style={[styles.audioRow, { alignItems: 'center', paddingVertical: 4 }]}>
                  <TouchableOpacity
                    onPress={() => handleTogglePlayAudio(msg)}
                    style={{ padding: 2 }}
                  >
                    <Ionicons
                      name={isPlayingThis ? 'pause-circle' : 'play-circle'}
                      size={36}
                      color="#00A884"
                    />
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', height: 16 }}>
                      {Array.from({ length: 18 }).map((_, i) => (
                        <View
                          key={i}
                          style={{
                            width: 3,
                            height: Math.max(5, ((i * 7) % 18) + 5),
                            borderRadius: 1.5,
                            backgroundColor:
                              isPlayingThis && i <= (audioSeconds % 18)
                                ? '#00A884'
                                : 'rgba(255,255,255,0.45)',
                            marginHorizontal: 1.5,
                          }}
                        />
                      ))}
                    </View>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                      {isPlayingThis
                        ? `Reproduciendo 00:${audioSeconds < 10 ? '0' : ''}${audioSeconds}`
                        : msg.text || 'Nota de voz • Toca para reproducir'}
                    </Text>
                  </View>
                </View>
              ) : null}

              {!isAudio && (
                <Text
                  style={[
                    styles.msgText,
                    { color: isMe ? colors.bubbleOutText : colors.bubbleInText },
                    isDeleted && { fontStyle: 'italic', opacity: 0.72 },
                  ]}
                >
                  {msg.text}
                </Text>
              )}

              <View style={styles.msgFooter}>
                {msg.ephemeral && !isDeleted && (
                  <Ionicons name="timer-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.msgTime, { color: 'rgba(255,255,255,0.65)' }]}>{msg.time}</Text>
                {isMe && !isDeleted && (
                  <Ionicons name="checkmark-done" size={15} color="#53BDEB" style={{ marginLeft: 4 }} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* PANEL DE EMOJIS Y STICKERS ESTILO WHATSAPP / TELEGRAM */}
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

            <TouchableOpacity onPress={() => setShowPicker(false)} style={{ paddingHorizontal: 14 }}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
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

      {/* BARRA INFERIOR DE MENSAJE ESTILO WHATSAPP & TELEGRAM (HABILITADA EN CANAL OFICIAL PARA EL ADMIN) */}
      {chat.official && !soyAdminOficial ? (
        <View style={[styles.officialFooter, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Ionicons name="megaphone-outline" size={16} color={colors.primary} />
          <Text style={[styles.officialFooterText, { color: colors.textMuted }]}>
            Solo los administradores de <Text style={{ fontWeight: '800', color: colors.text }}>NexChat Oficial</Text> pueden enviar comunicados.
          </Text>
        </View>
      ) : (
        <View style={{ backgroundColor: colors.bg }}>
          {chat.official && soyAdminOficial && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 12,
                backgroundColor: 'rgba(0,168,132,0.16)',
                borderTopWidth: 1,
                borderTopColor: 'rgba(0,168,132,0.35)',
              }}
            >
              <Ionicons name="megaphone" size={14} color="#10B981" />
              <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '900' }}>
                MODO ADMIN OFICIAL • Tu mensaje llegará a todos como NexChat Oficial ✅
              </Text>
            </View>
          )}
          <View style={[styles.inputBar, { backgroundColor: colors.bg }]}>
            <View style={[styles.inputPillContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => {
                  setPickerTab('emojis');
                  setShowPicker(!showPicker);
                }}
                style={styles.pillIconBtn}
              >
                <Ionicons
                  name={showPicker && pickerTab === 'emojis' ? 'happy' : 'happy-outline'}
                  size={23}
                  color={showPicker && pickerTab === 'emojis' ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>

              <TextInput
                style={[styles.pillInput, { color: colors.text }]}
                placeholder={
                  recordingAudio
                    ? `Grabando nota de voz (${recordSeconds}s)...`
                    : chat.official
                    ? 'Escribir comunicado oficial para todos...'
                    : 'Mensaje'
                }
                placeholderTextColor={recordingAudio ? '#EF4444' : colors.textMuted}
                value={text}
                onChangeText={setText}
                editable={!recordingAudio}
                multiline={chat.official}
                onSubmitEditing={handleSendText}
              />

              <TouchableOpacity
                onPress={() => {
                  setPickerTab('stickers');
                  setShowPicker(true);
                }}
                style={styles.pillIconBtn}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={21}
                  color={showPicker && pickerTab === 'stickers' ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={handlePickImage} style={styles.pillIconBtn}>
                <Ionicons name="camera-outline" size={23} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {text.trim().length > 0 ? (
              <TouchableOpacity
                onPress={handleSendText}
                style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="send" size={19} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleToggleAudio}
                style={[
                  styles.sendBtn,
                  { backgroundColor: recordingAudio ? '#EF4444' : colors.primary },
                ]}
              >
                <Ionicons name={recordingAudio ? 'stop' : 'mic'} size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* MODAL ELIMINAR MENSAJE (PARA MÍ / PARA TODOS / CANCELAR) */}
      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(239,68,68,0.14)' }]}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.deleteModalTitle, { color: colors.text }]}>
                ¿Eliminar este mensaje?
              </Text>
            </View>

            {selectedMessage && (
              <View style={[styles.msgPreviewBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={2}>
                  "{selectedMessage.text}"
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => {
                if (onDeleteMessageForAll && selectedMessage) {
                  onDeleteMessageForAll(chat.id, selectedMessage.id);
                }
                setSelectedMessage(null);
              }}
              style={[styles.deleteRowBtn, { backgroundColor: 'rgba(239,68,68,0.12)' }]}
            >
              <Ionicons name="ban-outline" size={18} color="#EF4444" />
              <Text style={[styles.deleteOptionText, { color: '#EF4444' }]}>
                Eliminar para todos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (onDeleteMessageForMe && selectedMessage) {
                  onDeleteMessageForMe(chat.id, selectedMessage.id);
                }
                setSelectedMessage(null);
              }}
              style={[styles.deleteRowBtn, { backgroundColor: colors.inputBg, marginTop: 8 }]}
            >
              <Ionicons name="trash-outline" size={18} color={colors.text} />
              <Text style={[styles.deleteOptionText, { color: colors.text }]}>
                Eliminar para mí
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedMessage(null)}
              style={[styles.cancelRowBtn, { marginTop: 10 }]}
            >
              <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '800' }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FICHA DEL CONTACTO Y SEGURIDAD (ESTILO WHATSAPP & TELEGRAM) */}
      <Modal visible={infoModal} transparent animationType="slide" onRequestClose={() => setInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.contactSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Barra superior de cerrar */}
            <View style={styles.sheetTopBar}>
              <Text style={[styles.sheetHeaderLabel, { color: colors.textMuted }]}>
                INFO DEL CONTACTO
              </Text>
              <TouchableOpacity onPress={() => setInfoModal(false)} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Avatar Grande + Nombre + Teléfono + Estado de Conexión */}
              <View style={styles.sheetProfileHero}>
                {renderAvatarCircle(88)}
                <Text style={[styles.sheetContactName, { color: colors.text }]}>
                  {chat.name}
                </Text>
                <Text style={[styles.sheetContactPhone, { color: colors.primary }]}>
                  {chat.peerPhone || (chat.official ? 'Cuenta Oficial Verificada' : 'Grupo Global')}
                </Text>
                {livePeerBio ? (
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center', fontStyle: 'italic', paddingHorizontal: 20 }}>
                    "{livePeerBio}"
                  </Text>
                ) : null}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 14,
                    backgroundColor: estadoConexion.isOnline
                      ? 'rgba(16,185,129,0.14)'
                      : colors.inputBg,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: estadoConexion.isOnline ? '#10B981' : '#94A3B8',
                    }}
                  />
                  <Text
                    style={{
                      color: estadoConexion.isOnline ? '#10B981' : colors.textMuted,
                      fontSize: 12,
                      fontWeight: '800',
                    }}
                  >
                    {estadoConexion.badgeText}
                  </Text>
                </View>
              </View>

              {/* GESTIÓN DE PARTICIPANTES DEL GRUPO (AÑADIR CON 1 TOQUE O QUITAR) */}
              {chat.isGroup && (
                <View style={[styles.sheetSection, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="people" size={17} color={colors.primary} />
                      <Text style={[styles.fieldLabel, { color: colors.textMuted, marginBottom: 0 }]}>
                        PARTICIPANTES ({(chat.members || []).length || 1})
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowAddGroupMembers(!showAddGroupMembers)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: colors.primary,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 10,
                      }}
                    >
                      <Ionicons name={showAddGroupMembers ? 'close' : 'person-add'} size={13} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>
                        {showAddGroupMembers ? 'Cerrar lista' : '+ Añadir persona'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showAddGroupMembers && (
                    <View style={{ marginBottom: 10, padding: 10, borderRadius: 12, backgroundColor: colors.card }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', marginBottom: 6 }}>
                        TOCA UN CONTACTO PARA AÑADIRLO AL GRUPO:
                      </Text>
                      {contactosDisponiblesGrupo.length === 0 ? (
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          Aún no tienes otros contactos en tu agenda de chats.
                        </Text>
                      ) : (
                        contactosDisponiblesGrupo.map((c) => {
                          const yaEsta = (chat.members || []).includes(c.phone);
                          return (
                            <TouchableOpacity
                              key={c.phone}
                              onPress={() => {
                                if (!onUpdateGroupMembers) return;
                                const actuales = Array.isArray(chat.members) ? chat.members : [userProfile.phone];
                                const nuevos = yaEsta
                                  ? actuales.filter((p) => p !== c.phone)
                                  : [...actuales, c.phone];
                                onUpdateGroupMembers(chat.id, nuevos);
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingVertical: 8,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border,
                              }}
                            >
                              <View>
                                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>
                                  {c.name}
                                </Text>
                                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{c.phone}</Text>
                              </View>
                              <Ionicons
                                name={yaEsta ? 'checkmark-circle' : 'add-circle-outline'}
                                size={22}
                                color={yaEsta ? colors.primary : colors.textMuted}
                              />
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  )}

                  {(chat.members || [userProfile.phone]).map((mPhone) => {
                    const esYo = mPhone === userProfile.phone;
                    const cAg = contactosDisponiblesGrupo.find((x) => x.phone === mPhone);
                    const estM = formatearEstadoConexion(mPhone, usersPresence);
                    return (
                      <View
                        key={mPhone}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 7,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>
                            {esYo ? `${userProfile.name} (Tú)` : cAg?.name || mPhone}
                          </Text>
                          <Text
                            style={{
                              color: estM.isOnline ? '#10B981' : colors.textMuted,
                              fontSize: 11,
                            }}
                          >
                            {esYo ? 'en línea • Administrador' : `${estM.shortText} • ${mPhone}`}
                          </Text>
                        </View>
                        {!esYo && onUpdateGroupMembers && (
                          <TouchableOpacity
                            onPress={() => {
                              const actuales = Array.isArray(chat.members) ? chat.members : [];
                              onUpdateGroupMembers(
                                chat.id,
                                actuales.filter((p) => p !== mPhone)
                              );
                            }}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="remove-circle-outline" size={19} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* 3 Botones de Acción Rápida estilo WhatsApp / Telegram */}
              {!chat.official && (
                <View style={styles.quickActionsGrid}>
                  <TouchableOpacity
                    onPress={() => {
                      setInfoModal(false);
                      onStartCall(chat, 'audio');
                    }}
                    style={[styles.quickActionBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  >
                    <Ionicons name="call-outline" size={22} color={colors.primary} />
                    <Text style={[styles.quickActionLabel, { color: colors.text }]}>Llamar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setInfoModal(false);
                      onStartCall(chat, 'video');
                    }}
                    style={[styles.quickActionBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  >
                    <Ionicons name="videocam-outline" size={22} color={colors.primary} />
                    <Text style={[styles.quickActionLabel, { color: colors.text }]}>Video</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setEphemeralMode(!ephemeralMode)}
                    style={[styles.quickActionBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  >
                    <Ionicons
                      name="timer-outline"
                      size={22}
                      color={ephemeralMode ? '#10B981' : colors.primary}
                    />
                    <Text style={[styles.quickActionLabel, { color: colors.text }]}>
                      {ephemeralMode ? 'Temp: ON' : 'Temporal'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Sección Añadir a Contactos / Editar Nombre */}
              {!chat.official && (
                <View style={[styles.sheetSection, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="person-add" size={17} color={colors.primary} />
                    <Text style={[styles.fieldLabel, { color: colors.textMuted, marginBottom: 0 }]}>
                      GUARDAR / AÑADIR A MIS CONTACTOS
                    </Text>
                  </View>

                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
                    Asigna un nombre personalizado para guardarlo en tu agenda de NexChat:
                  </Text>

                  <View style={styles.editRowInline}>
                    <TextInput
                      style={[styles.editInputInline, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                      value={editedName}
                      onChangeText={setEditedName}
                      placeholder="Nombre del contacto..."
                      placeholderTextColor={colors.textMuted}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        handleSaveContactName();
                        Alert.alert('Contacto guardado', `Se guardó "${editedName.trim()}" en tus contactos.`);
                      }}
                      style={[styles.saveInlineBtn, { backgroundColor: colors.primary }]}
                    >
                      <Ionicons name="save-outline" size={17} color="#FFFFFF" />
                      <Text style={styles.saveInlineBtnText}>Guardar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Sección Cifrado y Huella de Seguridad (40 dígitos organizados en cuadrícula 2x4) */}
              <View style={[styles.sheetSection, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name="lock-closed" size={15} color={colors.primary} />
                  <Text style={[styles.fieldLabel, { color: colors.textMuted, marginBottom: 0 }]}>
                    CÓDIGO DE SEGURIDAD E2EE (SHA-256)
                  </Text>
                </View>

                <View style={[styles.fpGridWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {bloquesHuella.map((bloque, idx) => (
                    <View key={idx} style={styles.fpGridCell}>
                      <Text style={[styles.fpCellText, { color: colors.primary }]}>{bloque}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Acciones de Limpieza / Eliminación */}
              {!chat.official && (
                <View style={styles.dangerActionsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      if (onClearChat) onClearChat(chat.id);
                      setInfoModal(false);
                    }}
                    style={[styles.sheetActionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  >
                    <Ionicons name="sparkles-outline" size={17} color={colors.text} />
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Vaciar chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      if (onDeleteChat) onDeleteChat(chat.id);
                      setInfoModal(false);
                    }}
                    style={[styles.sheetActionBtn, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' }]}
                  >
                    <Ionicons name="trash-outline" size={17} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '800' }}>Eliminar contacto</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
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
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    elevation: 4,
  },
  backBtn: { padding: 8, marginRight: 2 },
  headerProfile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  headerStatus: { color: '#8A9AA9', fontSize: 11, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  e2eeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  e2eeText: { fontSize: 11, textAlign: 'center', flex: 1 },
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
  stickerBubble: { marginBottom: 10 },
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
    width: 115,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00A884',
  },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  msgTime: { fontSize: 10 },
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
    paddingTop: 6,
    paddingBottom: Platform.OS === 'android' ? 14 : 8,
    gap: 6,
  },
  inputPillContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 6,
    minHeight: 46,
  },
  pillIconBtn: {
    padding: 7,
  },
  pillInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  officialFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderTopWidth: 1,
  },
  officialFooterText: { fontSize: 12, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 18,
  },
  deleteModalCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  msgPreviewBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  deleteRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  deleteOptionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  cancelRowBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  contactSheet: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    maxHeight: '90%',
  },
  sheetTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetProfileHero: {
    alignItems: 'center',
    marginVertical: 10,
  },
  sheetContactName: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },
  sheetContactPhone: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  quickActionBox: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  sheetSection: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  editRowInline: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  editInputInline: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
  },
  saveInlineBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  fpGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  fpGridCell: {
    width: '25%',
    paddingVertical: 5,
    alignItems: 'center',
  },
  fpCellText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  dangerActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  sheetActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
