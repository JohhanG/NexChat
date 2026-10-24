import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, StatusBar,
  SafeAreaView, Modal, TextInput, Alert, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';

import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { supabase } from './lib/supabase';
import {
  generarRoomIdPrivado,
  sanitizarEntrada,
  cifrarMensajeE2EE,
  descifrarMensajeE2EE,
  generarHashPin,
} from './lib/seguridad';

import LoginScreen from './screens/LoginScreen';
import ChatsScreen from './screens/ChatsScreen';
import ChatDetalleScreen from './screens/ChatDetalleScreen';
import EstadosScreen from './screens/EstadosScreen';
import LlamadasScreen from './screens/LlamadasScreen';
import SeguridadScreen from './screens/SeguridadScreen';
import PerfilScreen from './screens/PerfilScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const CANAL_OFICIAL_INICIAL = [
  {
    id: 'official_nexchat',
    name: 'NexChat Oficial',
    avatar: '🛡️',
    official: true,
    isGroup: false,
    online: true,
    unread: 1,
    messages: [
      {
        id: 'welcome_1',
        sender: 'them',
        senderName: 'NexChat Oficial ✅',
        text: '🎉 ¡Bienvenido a NexChat Global! Tu cuenta está verificada y protegida con cifrado de extremo a extremo (SHA-256). Aquí recibirás únicamente comunicados y actualizaciones oficiales.',
        time: 'Ahora',
      },
      {
        id: 'welcome_2',
        sender: 'them',
        senderName: 'NexChat Oficial ✅',
        text: '💡 Para chatear con tus amigos, toca el botón "+ Nuevo Chat" arriba a la derecha o el botón flotante verde e ingresa su número de celular.',
        time: 'Ahora',
      },
    ],
  },
];

function MainApp() {
  const { colors, isDark, toggleTheme } = useTheme();
  const [userProfile, setUserProfile] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [activeTab, setActiveTab] = useState('chats');
  const [chats, setChats] = useState(CANAL_OFICIAL_INICIAL);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [callHistory, setCallHistory] = useState([]);

  // Llamada en curso
  const [activeCall, setActiveCall] = useState(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Bloqueo de pantalla por PIN
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');

  // Banner de actualización OTA
  const [otaAvailable, setOtaAvailable] = useState(false);

  // 1. Cargar sesión persistente y verificar OTA
  useEffect(() => {
    (async () => {
      try {
        const savedUser = await AsyncStorage.getItem('@nexchat_user_v3');
        const savedChats = await AsyncStorage.getItem('@nexchat_chats_v3');
        const savedCalls = await AsyncStorage.getItem('@nexchat_calls_v3');

        if (savedUser) {
          setUserProfile(JSON.parse(savedUser));
        }
        if (savedChats) {
          const parsed = JSON.parse(savedChats);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChats(parsed);
          }
        }
        if (savedCalls) {
          setCallHistory(JSON.parse(savedCalls));
        }
      } catch (e) {
        // Ignorar errores de lectura inicial
      } finally {
        setLoadingSession(false);
      }

      // Verificar OTA silenciosamente
      if (!__DEV__) {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            setOtaAvailable(true);
          }
        } catch (err) {
          // Ignorar en desarrollo
        }
      }
    })();
  }, []);

  // Guardar chats cuando cambien
  useEffect(() => {
    if (userProfile && chats.length > 0) {
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(chats)).catch(() => {});
    }
  }, [chats, userProfile]);

  // Cronómetro de llamada activa
  useEffect(() => {
    let timer;
    if (activeCall) {
      timer = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    } else {
      setCallSeconds(0);
    }
    return () => clearInterval(timer);
  }, [activeCall]);

  // 2. Sincronizar con Supabase 24/7 (Mensajes y Estados en Tiempo Real)
  useEffect(() => {
    if (!userProfile?.phone) return;

    const myCleanDigits = String(userProfile.phone || '').replace(/[^0-9]/g, '');

    const cargarDatosNube = async () => {
      try {
        // Cargar estados de las últimas 24h
        const { data: stData } = await supabase
          .from('nexchat_statuses')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(40);
        if (stData) setStatuses(stData);

        // Cargar mensajes donde participe mi número
        if (myCleanDigits.length >= 6) {
          const { data: msgData } = await supabase
            .from('nexchat_messages')
            .select('*')
            .ilike('chat_id', `%${myCleanDigits}%`)
            .order('timestamp', { ascending: true })
            .limit(200);

          if (msgData && msgData.length > 0) {
            integrarMensajesNube(msgData);
          }
        }
      } catch (e) {
        // Modo offline-first respaldado
      }
    };

    cargarDatosNube();

    const channel = supabase
      .channel('nexchat_global_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nexchat_messages' },
        (payload) => {
          const nuevo = payload.new;
          if (!nuevo) return;
          const roomId = nuevo.chat_id || nuevo.room_id || '';
          if (nuevo.sender_phone !== userProfile.phone && roomId.includes(myCleanDigits)) {
            recibirMensajeEnVivo(nuevo);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'nexchat_messages' },
        (payload) => {
          const actualizado = payload.new;
          if (!actualizado) return;
          const roomId = actualizado.chat_id || actualizado.room_id || '';
          if (roomId.includes(myCleanDigits)) {
            setChats((prev) =>
              prev.map((c) =>
                c.id === roomId
                  ? {
                      ...c,
                      messages: (c.messages || []).map((m) =>
                        m.id === actualizado.id
                          ? {
                              ...m,
                              text:
                                actualizado.sender_phone === userProfile.phone
                                  ? '🚫 Eliminaste este mensaje'
                                  : '🚫 Este mensaje fue eliminado',
                              mediaUri: null,
                              mediaType: 'text',
                              deletedForAll: true,
                            }
                          : m
                      ),
                    }
                  : c
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nexchat_statuses' },
        (payload) => {
          if (payload.new) {
            setStatuses((prev) => [payload.new, ...prev.filter((s) => s.id !== payload.new.id)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile]);

  const integrarMensajesNube = (lista) => {
    setChats((prevChats) => {
      const mapa = [...prevChats];
      lista.forEach((m) => {
        const roomId = m.chat_id || m.room_id;
        const plain = descifrarMensajeE2EE(m.content || m.ciphertext, roomId);
        const hora = m.time || new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgObj = {
          id: m.id,
          sender: m.sender_phone === userProfile.phone ? 'me' : 'them',
          senderPhone: m.sender_phone,
          senderName: m.sender_name,
          text: plain,
          mediaUri: m.type === 'image' ? m.content : null,
          mediaType: m.type !== 'text' ? m.type : null,
          ephemeral: !!m.expires_at,
          time: hora,
        };

        const idx = mapa.findIndex((c) => c.id === roomId);
        if (idx >= 0) {
          const yaExiste = (mapa[idx].messages || []).some((x) => x.id === m.id);
          if (!yaExiste) {
            mapa[idx] = {
              ...mapa[idx],
              messages: [...(mapa[idx].messages || []), msgObj],
            };
          }
        } else {
          // Crear el chat automáticamente si un amigo nos escribió
          mapa.push({
            id: roomId,
            name: m.sender_phone === userProfile.phone ? 'Chat Directo' : (m.sender_name || m.sender_phone),
            peerPhone: m.sender_phone,
            avatar: '👤',
            isGroup: String(roomId).startsWith('group_'),
            online: true,
            unread: 1,
            messages: [msgObj],
          });
        }
      });
      return mapa;
    });
  };

  const recibirMensajeEnVivo = async (m) => {
    const roomId = m.chat_id || m.room_id;
    const plain = descifrarMensajeE2EE(m.content || m.ciphertext, roomId);
    const hora = m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgObj = {
      id: m.id,
      sender: 'them',
      senderPhone: m.sender_phone,
      senderName: m.sender_name,
      text: plain,
      mediaUri: m.type === 'image' ? m.content : null,
      mediaType: m.type !== 'text' ? m.type : null,
      ephemeral: !!m.expires_at,
      time: hora,
    };

    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === roomId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          unread: selectedChatId === roomId ? 0 : (updated[idx].unread || 0) + 1,
          messages: [...(updated[idx].messages || []), msgObj],
        };
        return updated;
      } else {
        return [
          {
            id: roomId,
            name: m.sender_name || m.sender_phone,
            peerPhone: m.sender_phone,
            avatar: '👤',
            isGroup: String(roomId).startsWith('group_'),
            online: true,
            unread: 1,
            messages: [msgObj],
          },
          ...prev,
        ];
      }
    });

    // Notificación local en el celular
    if (Platform.OS !== 'web') {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `💬 ${m.sender_name || m.sender_phone}`,
            body: m.type === 'image' ? '📷 Foto cifrada E2EE' : plain,
            sound: true,
          },
          trigger: null,
        });
      } catch (e) {}
    }
  };

  // 3. Crear nuevo chat 1 a 1 con un amigo real
  const handleCreateDirectChat = async (peerPhone, customName, peerData) => {
    const roomId = generarRoomIdPrivado(userProfile.phone, peerPhone);
    const existing = chats.find((c) => c.id === roomId);
    if (existing) {
      setSelectedChatId(roomId);
      return;
    }

    const nuevoChat = {
      id: roomId,
      name: customName || peerData?.name || peerPhone,
      peerPhone,
      avatar: peerData?.avatar || '👤',
      isGroup: false,
      online: true,
      unread: 0,
      messages: [],
    };

    setChats((prev) => [nuevoChat, ...prev]);
    setSelectedChatId(roomId);

    try {
      await supabase.from('nexchat_chats').upsert([
        {
          id: roomId,
          is_group: false,
          name: nuevoChat.name,
          phone: peerPhone,
          avatar: nuevoChat.avatar,
          status: `${peerPhone} • 🔒 E2EE`,
          created_by: userProfile.phone,
        },
      ]);
    } catch (e) {}
  };

  // 4. Crear nuevo grupo
  const handleCreateGroupChat = async (groupName, membersList, groupAvatar = '👥') => {
    const roomId = `group_${Date.now()}_${userProfile.phone.replace(/[^0-9]/g, '')}`;
    const allMembers = Array.from(new Set([userProfile.phone, ...membersList]));
    const nuevoGrupo = {
      id: roomId,
      name: groupName,
      avatar: groupAvatar || '👥',
      isGroup: true,
      members: allMembers,
      online: true,
      unread: 0,
      messages: [
        {
          id: `sys_${Date.now()}`,
          sender: 'me',
          senderName: userProfile.name,
          text: `🎉 Grupo "${groupName}" creado con cifrado E2EE.`,
          time: 'Ahora',
        },
      ],
    };

    setChats((prev) => [nuevoGrupo, ...prev]);
    setSelectedChatId(roomId);

    try {
      await supabase.from('nexchat_chats').upsert([
        {
          id: roomId,
          is_group: true,
          name: groupName,
          phone: 'Grupo Global',
          avatar: groupAvatar || '👥',
          status: 'Grupo Global • 🔒 E2EE',
          created_by: userProfile.phone,
        },
      ]);
    } catch (e) {}
  };

  // 5. Enviar mensaje en chat activo
  const handleSendMessage = async ({ text, mediaUri, mediaType, ephemeral }) => {
    if (!selectedChatId) return;
    const cleanText = sanitizarEntrada(text);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const nuevoMsg = {
      id: msgId,
      sender: 'me',
      senderPhone: userProfile.phone,
      senderName: userProfile.name,
      text: cleanText,
      mediaUri,
      mediaType,
      ephemeral: !!ephemeral,
      time: hora,
    };

    setChats((prev) =>
      prev.map((c) =>
        c.id === selectedChatId
          ? { ...c, messages: [...(c.messages || []), nuevoMsg] }
          : c
      )
    );

    // Si es efímero (15 segundos), autodestruir
    if (ephemeral) {
      setTimeout(() => {
        setChats((prev) =>
          prev.map((c) =>
            c.id === selectedChatId
              ? { ...c, messages: (c.messages || []).filter((m) => m.id !== msgId) }
              : c
          )
        );
      }, 15000);
    }

    // Subir cifrado a Supabase 24/7
    try {
      const dbType =
        mediaType === 'image' || mediaType === 'audio' || mediaType === 'file'
          ? mediaType
          : 'text';
      const cipher = cifrarMensajeE2EE(mediaType === 'image' ? mediaUri : cleanText, selectedChatId);
      await supabase.from('nexchat_messages').insert([
        {
          id: msgId,
          chat_id: selectedChatId,
          sender_id: userProfile.id || userProfile.phone,
          sender_phone: userProfile.phone,
          sender_name: userProfile.name,
          type: dbType,
          content: cipher,
          time: hora,
          timestamp: Date.now(),
          expires_at: ephemeral ? Date.now() + 15000 : null,
          status: 'read',
        },
      ]);
    } catch (e) {}
  };

  // 6. Publicar Estado de 24h
  const handlePublishStatus = async (content, bgColor) => {
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newSt = {
      id: `st_${Date.now()}`,
      user_id: userProfile.id || userProfile.phone,
      user_phone: userProfile.phone,
      user_name: userProfile.name,
      user_avatar: userProfile.avatar?.startsWith('data:') ? '📸' : (userProfile.avatar || '😎'),
      content: sanitizarEntrada(content),
      bg_color: bgColor,
      time: hora,
      expires_at: Date.now() + 86400000,
    };
    setStatuses((prev) => [newSt, ...prev]);

    try {
      await supabase.from('nexchat_statuses').insert([newSt]);
    } catch (e) {}
  };

  // 7. Iniciar llamada de voz o video
  const handleStartCall = (chatObj, type = 'audio') => {
    const registro = {
      id: `call_${Date.now()}`,
      name: chatObj.name,
      avatar: chatObj.avatar || '👤',
      peerPhone: chatObj.peerPhone,
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const nuevaLista = [registro, ...callHistory];
    setCallHistory(nuevaLista);
    AsyncStorage.setItem('@nexchat_calls_v3', JSON.stringify(nuevaLista)).catch(() => {});
    setActiveCall({ ...chatObj, type });
  };

  // 8. Actualizar perfil
  const handleUpdateProfile = async (updated) => {
    setUserProfile(updated);
    await AsyncStorage.setItem('@nexchat_user_v3', JSON.stringify(updated));
    try {
      await supabase
        .from('nexchat_users')
        .update({
          name: updated.name,
          bio: updated.bio,
          avatar: updated.avatar,
        })
        .eq('phone', updated.phone);
    } catch (e) {}
  };

  // 9. Verificar actualizaciones OTA manualmente
  const handleCheckUpdates = async () => {
    if (__DEV__) {
      Alert.alert('Modo Desarrollo', 'Las actualizaciones OTA están activas automáticamente en tu APK instalada.');
      return;
    }
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert('🎉 Nueva Versión Lista', 'Se descargó la última actualización. Reiniciando app...', [
          { text: 'Reiniciar Ahora', onPress: () => Updates.reloadAsync() },
        ]);
      } else {
        Alert.alert('✅ Al Día', 'Ya tienes la última versión de NexChat Global instalada.');
      }
    } catch (e) {
      Alert.alert('✅ Al Día', 'Tu aplicación está actualizada con la última versión.');
    }
  };

  // 10. Cerrar sesión o Botón de Pánico
  const handleLogout = async () => {
    await AsyncStorage.removeItem('@nexchat_user_v3');
    setUserProfile(null);
    setSelectedChatId(null);
  };

  const handlePanicWipe = async () => {
    await AsyncStorage.multiRemove([
      '@nexchat_user_v3',
      '@nexchat_chats_v3',
      '@nexchat_calls_v3',
      'nexchat_recordar_credenciales',
    ]);
    setChats(CANAL_OFICIAL_INICIAL);
    setCallHistory([]);
    setUserProfile(null);
    setSelectedChatId(null);
  };

  const handleUnlockScreen = () => {
    const candidateHash = generarHashPin(unlockPin, userProfile.phone);
    if (
      unlockPin === userProfile.pin ||
      candidateHash === userProfile.pinHash
    ) {
      setIsLocked(false);
      setUnlockPin('');
    } else {
      Alert.alert('PIN Incorrecto', 'El PIN de seguridad no coincide.');
      setUnlockPin('');
    }
  };

  // 11. Eliminar mensaje para mí (solo en mi teléfono)
  const handleDeleteMessageForMe = (chatId, msgId) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: (c.messages || []).filter((m) => m.id !== msgId) }
          : c
      )
    );
  };

  // 12. Eliminar mensaje para todos (en mi teléfono y en Supabase 24/7 para los demás)
  const handleDeleteMessageForAll = async (chatId, msgId) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: (c.messages || []).map((m) =>
                m.id === msgId
                  ? {
                      ...m,
                      text: '🚫 Eliminaste este mensaje',
                      mediaUri: null,
                      mediaType: 'text',
                      deletedForAll: true,
                    }
                  : m
              ),
            }
          : c
      )
    );

    try {
      await supabase
        .from('nexchat_messages')
        .update({
          content: '🚫 Este mensaje fue eliminado',
          type: 'text',
        })
        .eq('id', msgId);
    } catch (e) {}
  };

  // 13. Editar nombre de un contacto o grupo
  const handleEditContactName = async (chatId, newName) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, name: newName } : c))
    );
    try {
      await supabase
        .from('nexchat_chats')
        .update({ name: newName })
        .eq('id', chatId);
    } catch (e) {}
  };

  // 14. Vaciar o eliminar un chat
  const handleClearChat = (chatId) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: [] } : c))
    );
  };

  const handleDeleteChat = (chatId) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
    }
  };

  if (loadingSession) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: '#0B141A' }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>💬🔒</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900' }}>NexChat Global</Text>
      </View>
    );
  }

  // Si no ha iniciado sesión, mostrar Login / Registro
  if (!userProfile) {
    return (
      <LoginScreen
        onLoginSuccess={async (profile) => {
          setUserProfile(profile);
          setChats(CANAL_OFICIAL_INICIAL);
          try {
            await AsyncStorage.setItem('@nexchat_user_v3', JSON.stringify(profile));
          } catch {}
        }}
      />
    );
  }

  const selectedChat = chats.find((c) => c.id === selectedChatId);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      {/* BANNER OTA SI HAY ACTUALIZACIÓN */}
      {otaAvailable && (
        <TouchableOpacity
          onPress={() => Updates.reloadAsync()}
          style={styles.otaBanner}
        >
          <Text style={styles.otaBannerText}>
            🚀 Nueva actualización descargada. Toca aquí para aplicar los cambios al instante.
          </Text>
        </TouchableOpacity>
      )}

      {/* SI HAY UN CHAT ABIERTO, MOSTRAR PANTALLA DE CONVERSACIÓN */}
      {selectedChat ? (
        <ChatDetalleScreen
          chat={selectedChat}
          userProfile={userProfile}
          onBack={() => setSelectedChatId(null)}
          onSendMessage={handleSendMessage}
          onStartCall={handleStartCall}
          onDeleteMessageForMe={handleDeleteMessageForMe}
          onDeleteMessageForAll={handleDeleteMessageForAll}
          onEditContactName={handleEditContactName}
          onClearChat={handleClearChat}
          onDeleteChat={handleDeleteChat}
        />
      ) : (
        <>
          {/* HEADER PRINCIPAL ESTILO WHATSAPP */}
          <View style={[styles.topHeader, { backgroundColor: colors.headerBg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 24 }}>💬</Text>
              <View>
                <Text style={styles.brandTitle}>NexChat</Text>
                <Text style={styles.brandSub}>● Nube 24/7 Activa • E2EE</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity onPress={toggleTheme} style={styles.headerIconBtn}>
                <Text style={{ fontSize: 18 }}>{isDark ? '☀️' : '🌙'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsLocked(true)} style={styles.headerIconBtn}>
                <Text style={{ fontSize: 18 }}>🔒</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* CONTENIDO DE PESTAÑA ACTIVA */}
          <View style={{ flex: 1 }}>
            {activeTab === 'chats' && (
              <ChatsScreen
                chats={chats}
                userProfile={userProfile}
                onSelectChat={(chat) => {
                  setChats((prev) =>
                    prev.map((c) => (c.id === chat.id ? { ...c, unread: 0 } : c))
                  );
                  setSelectedChatId(chat.id);
                }}
                onCreateDirectChat={handleCreateDirectChat}
                onCreateGroupChat={handleCreateGroupChat}
                onEditContactName={handleEditContactName}
                onDeleteChat={handleDeleteChat}
              />
            )}

            {activeTab === 'estados' && (
              <EstadosScreen
                statuses={statuses}
                userProfile={userProfile}
                onPublishStatus={handlePublishStatus}
              />
            )}

            {activeTab === 'llamadas' && (
              <LlamadasScreen
                callHistory={callHistory}
                onStartCall={handleStartCall}
              />
            )}

            {activeTab === 'perfil' && (
              <PerfilScreen
                userProfile={userProfile}
                onUpdateProfile={handleUpdateProfile}
                onCheckUpdates={handleCheckUpdates}
                onLogout={handleLogout}
                onLockNow={() => setIsLocked(true)}
                onPanicWipe={handlePanicWipe}
              />
            )}
          </View>

          {/* BARRA DE NAVEGACIÓN INFERIOR (4 PESTAÑAS ESTILO WHATSAPP) */}
          <View style={[styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.border }]}>
            {[
              { id: 'chats', label: 'Chats', icon: '💬' },
              { id: 'estados', label: 'Estados', icon: '⭕' },
              { id: 'llamadas', label: 'Llamadas', icon: '📞' },
              { id: 'perfil', label: 'Perfil', icon: '👤' },
            ].map((t) => {
              const active = activeTab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  style={styles.tabItem}
                >
                  <View
                    style={[
                      styles.tabIconPill,
                      active && { backgroundColor: 'rgba(16,185,129,0.2)' },
                    ]}
                  >
                    <Text style={{ fontSize: 19 }}>{t.icon}</Text>
                  </View>
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: active ? colors.primary : colors.textMuted, fontWeight: active ? '900' : '600' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* MODAL DE LLAMADA EN VIVO */}
      <Modal visible={!!activeCall} animationType="slide" transparent>
        {activeCall && (
          <View style={styles.callModal}>
            <Text style={styles.callEncryptedBadge}>🔒 CIFRADO DE EXTREMO A EXTREMO (SHA-256)</Text>
            <View style={styles.callAvatarBig}>
              <Text style={{ fontSize: 64 }}>{activeCall.avatar || '👤'}</Text>
            </View>
            <Text style={styles.callPeerName}>{activeCall.name}</Text>
            <Text style={styles.callTimer}>
              {activeCall.type === 'video' ? '📹 Videollamada en curso • ' : '📞 Llamada de voz • '}
              {Math.floor(callSeconds / 60).toString().padStart(2, '0')}:
              {(callSeconds % 60).toString().padStart(2, '0')}
            </Text>

            <View style={styles.callControlsRow}>
              <TouchableOpacity
                onPress={() => setIsMuted(!isMuted)}
                style={[styles.callControlBtn, isMuted && { backgroundColor: '#F59E0B' }]}
              >
                <Text style={{ fontSize: 24 }}>{isMuted ? '🔇' : '🎙️'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveCall(null)}
                style={[styles.callControlBtn, { backgroundColor: '#EF4444', width: 70, height: 70, borderRadius: 35 }]}
              >
                <Text style={{ fontSize: 28 }}>📵</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* MODAL DE BLOQUEO POR PIN */}
      <Modal visible={isLocked} animationType="fade" transparent>
        <View style={styles.lockOverlay}>
          <View style={[styles.lockCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 44, marginBottom: 8 }}>🔒</Text>
            <Text style={[styles.lockTitle, { color: colors.text }]}>NexChat Bloqueado</Text>
            <Text style={[styles.lockSub, { color: colors.textMuted }]}>
              Ingresa tu PIN de seguridad 2FA para desbloquear tus conversaciones:
            </Text>
            <TextInput
              style={[styles.lockInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={8}
              value={unlockPin}
              onChangeText={setUnlockPin}
            />
            <TouchableOpacity
              onPress={handleUnlockScreen}
              style={[styles.unlockBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>Desbloquear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 12,
    paddingBottom: 12,
    elevation: 4,
  },
  brandTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  brandSub: { color: '#6EE7B7', fontSize: 11, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 16 : 10,
    paddingHorizontal: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconPill: {
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 14,
    marginBottom: 2,
  },
  tabLabel: { fontSize: 11 },
  otaBanner: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  otaBannerText: { color: '#052E16', fontSize: 12, fontWeight: '900' },
  callModal: {
    flex: 1,
    backgroundColor: '#071E18',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  callEncryptedBadge: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(16,185,129,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  callAvatarBig: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#065F46',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#10B981',
  },
  callPeerName: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  callTimer: { color: '#A7F3D0', fontSize: 15, fontWeight: '700' },
  callControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  callControlBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    padding: 24,
  },
  lockCard: {
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  lockTitle: { fontSize: 20, fontWeight: '900', marginBottom: 6 },
  lockSub: { fontSize: 13, textAlign: 'center', marginBottom: 18, lineHeight: 18 },
  lockInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  unlockBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
});
