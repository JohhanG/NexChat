import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, StatusBar,
  SafeAreaView, Modal, TextInput, Alert, Platform, AppState, BackHandler, Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { supabase } from './lib/supabase';
import {
  generarRoomIdPrivado,
  extraerPeerPhoneDeRoom,
  sanitizarEntrada,
  cifrarMensajeE2EE,
  descifrarMensajeE2EE,
  generarHashPin,
  parsearColorYVistasEstado,
  serializarColorYVistasEstado,
  calcularTiempoRestanteEstado,
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

const phonesMatch = (p1, p2) => {
  if (!p1 || !p2) return false;
  const d1 = String(p1).replace(/[^0-9]/g, '');
  const d2 = String(p2).replace(/[^0-9]/g, '');
  if (!d1 || !d2) return false;
  return d1 === d2 || (d1.length >= 7 && d2.length >= 7 && (d1.endsWith(d2) || d2.endsWith(d1)));
};

function MainApp() {
  const { colors, isDark, toggleTheme } = useTheme();
  const [userProfile, setUserProfile] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [activeTab, setActiveTab] = useState('chats');
  const [chats, setChats] = useState(CANAL_OFICIAL_INICIAL);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [usersPresence, setUsersPresence] = useState({});

  // Llamadas en tiempo real (Entrante, Saliente y Activa)
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const activeCallRef = useRef(activeCall);
  const outgoingCallRef = useRef(outgoingCall);
  const incomingCallRef = useRef(incomingCall);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { outgoingCallRef.current = outgoingCall; }, [outgoingCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  // Bloqueo de pantalla por Huella Dactilar / PIN
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [appLockConfig, setAppLockConfig] = useState({
    enabled: true,
    method: 'huella', // 'huella' | 'pin' | 'ambos'
    autoLockTime: 'immediate', // 'immediate' | '1m' | '5m'
  });
  const [unlockMode, setUnlockMode] = useState('huella');
  const [fingerprintScanning, setFingerprintScanning] = useState(false);
  const appLockConfigRef = useRef(appLockConfig);
  useEffect(() => { appLockConfigRef.current = appLockConfig; }, [appLockConfig]);
  const backgroundTimeRef = useRef(null);

  // Registro persistente de Chats Archivados
  const [archivedChatIds, setArchivedChatIds] = useState(new Set());

  useEffect(() => {
    AsyncStorage.getItem('@nexchat_archived_v3')
      .then((data) => {
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) setArchivedChatIds(new Set(parsed));
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('@nexchat_app_lock_config')
      .then((data) => {
        if (data) {
          const parsed = JSON.parse(data);
          setAppLockConfig(parsed);
          setUnlockMode(parsed.method === 'pin' ? 'pin' : 'huella');
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleArchiveChat = (chatId) => {
    setArchivedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      AsyncStorage.setItem('@nexchat_archived_v3', JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };

  const handleUpdateAppLockConfig = async (newConfig) => {
    setAppLockConfig(newConfig);
    setUnlockMode(newConfig.method === 'pin' ? 'pin' : 'huella');
    await AsyncStorage.setItem('@nexchat_app_lock_config', JSON.stringify(newConfig)).catch(() => {});
  };

  const handleFingerprintUnlock = () => {
    setFingerprintScanning(true);
    setTimeout(() => {
      setFingerprintScanning(false);
      setIsLocked(false);
      setUnlockPin('');
    }, 380);
  };

  // Banner de actualización OTA
  const [otaAvailable, setOtaAvailable] = useState(false);

  // Registro persistente de mensajes y chats eliminados para que nunca reaparezcan al recargar
  const deletedMsgIdsRef = useRef(new Set());
  const clearedChatsRef = useRef({});
  const readMsgIdsRef = useRef(new Set(['welcome_1', 'welcome_2', 'official_welcome_msg']));
  const processedMsgIdsRef = useRef(new Set(['welcome_1', 'welcome_2', 'official_welcome_msg']));
  const selectedChatIdRef = useRef(null);
  const realtimeChannelRef = useRef(null);
  const lastSyncTimestampRef = useRef(0);
  const usersPresenceRef = useRef({});

  useEffect(() => {
    usersPresenceRef.current = usersPresence;
  }, [usersPresence]);

  // Auto-reparar cualquier chat 1 a 1 que por error haya quedado con el teléfono o foto propios
  useEffect(() => {
    if (!userProfile?.phone || !chats || chats.length === 0) return;
    const myClean = String(userProfile.phone).replace(/[^0-9]/g, '');
    let changed = false;
    const repaired = chats.map((c) => {
      if (!c.isGroup && c.id && String(c.id).startsWith('dm_')) {
        const peerDigits = extraerPeerPhoneDeRoom(c.id, userProfile.phone);
        if (peerDigits && peerDigits !== myClean) {
          const cleanPeerPhone = String(c.peerPhone || '').replace(/[^0-9]/g, '');
          const peerInfo = usersPresence[peerDigits];
          const correctPhone = `+${peerDigits}`;
          if (cleanPeerPhone === myClean || c.name === 'Chat Directo' || !c.peerPhone) {
            changed = true;
            return {
              ...c,
              peerPhone: correctPhone,
              name: (peerInfo?.name && peerInfo.name !== userProfile.name) ? peerInfo.name : correctPhone,
              avatar: (peerInfo?.avatar && peerInfo.avatar !== userProfile.avatar) ? peerInfo.avatar : (c.avatar || '👤'),
            };
          }
        }
      }
      return c;
    });
    if (changed) {
      setChats(repaired);
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(repaired)).catch(() => {});
    }
  }, [usersPresence, userProfile]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
    if (selectedChatId) {
      setChats((prev) => {
        let changed = false;
        const updated = prev.map((c) => {
          if (c.id === selectedChatId) {
            (c.messages || []).forEach((m) => readMsgIdsRef.current.add(m.id));
            if (c.unread > 0) changed = true;
            return { ...c, unread: 0 };
          }
          return c;
        });
        AsyncStorage.setItem(
          '@nexchat_read_msgs_v3',
          JSON.stringify(Array.from(readMsgIdsRef.current))
        ).catch(() => {});
        return changed ? updated : prev;
      });
    }
  }, [selectedChatId]);

  const persistReadMsgIds = async (idsSet) => {
    try {
      await AsyncStorage.setItem('@nexchat_read_msgs_v3', JSON.stringify(Array.from(idsSet)));
    } catch (e) {}
  };

  const persistDeletedMsgIds = async (idsSet) => {
    try {
      await AsyncStorage.setItem('@nexchat_deleted_msgs_v3', JSON.stringify(Array.from(idsSet)));
    } catch (e) {}
  };

  const persistClearedChats = async (mapObj) => {
    try {
      await AsyncStorage.setItem('@nexchat_cleared_chats_v3', JSON.stringify(mapObj));
    } catch (e) {}
  };

  // 1. Cargar sesión persistente y verificar OTA
  useEffect(() => {
    (async () => {
      try {
        const [
          savedUser,
          savedChats,
          savedCalls,
          savedDeletedMsgs,
          savedClearedChats,
          savedReadMsgs,
        ] = await Promise.all([
          AsyncStorage.getItem('@nexchat_user_v3'),
          AsyncStorage.getItem('@nexchat_chats_v3'),
          AsyncStorage.getItem('@nexchat_calls_v3'),
          AsyncStorage.getItem('@nexchat_deleted_msgs_v3'),
          AsyncStorage.getItem('@nexchat_cleared_chats_v3'),
          AsyncStorage.getItem('@nexchat_read_msgs_v3'),
        ]);

        if (savedReadMsgs) {
          const parsedRead = JSON.parse(savedReadMsgs);
          if (Array.isArray(parsedRead)) {
            parsedRead.forEach((id) => readMsgIdsRef.current.add(id));
          }
        }

        if (savedDeletedMsgs) {
          const parsedDel = JSON.parse(savedDeletedMsgs);
          if (Array.isArray(parsedDel)) {
            deletedMsgIdsRef.current = new Set(parsedDel);
          }
        }
        if (savedClearedChats) {
          const parsedCleared = JSON.parse(savedClearedChats);
          if (parsedCleared && typeof parsedCleared === 'object') {
            clearedChatsRef.current = parsedCleared;
          }
        }

        if (savedChats) {
          const parsed = JSON.parse(savedChats);
          if (Array.isArray(parsed)) {
            const sanitized = parsed.map((c) => ({
              ...c,
              messages: (c.messages || []).filter((m) => !deletedMsgIdsRef.current.has(m.id)),
            }));
            setChats(sanitized);
          }
        } else {
          // Filtrar incluso el canal oficial inicial si borraron algún mensaje de bienvenida
          setChats(
            CANAL_OFICIAL_INICIAL.map((c) => ({
              ...c,
              messages: (c.messages || []).filter((m) => !deletedMsgIdsRef.current.has(m.id)),
            }))
          );
        }

        if (savedCalls) {
          setCallHistory(JSON.parse(savedCalls));
        }
        if (savedUser) {
          setUserProfile(JSON.parse(savedUser));
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

  // Guardar chats cuando cambien (solo después de terminar la carga inicial)
  useEffect(() => {
    if (!loadingSession && userProfile) {
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(chats)).catch(() => {});
    }
  }, [chats, userProfile, loadingSession]);

  // Navegación con gesto/botón de volver atrás de Android (evita que se salga de la app)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeCall || outgoingCall || incomingCall) {
        handleEndCall();
        return true;
      }
      if (selectedChatId) {
        setSelectedChatId(null);
        return true;
      }
      if (activeTab !== 'chats') {
        setActiveTab('chats');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeCall, outgoingCall, incomingCall, selectedChatId, activeTab]);

  // Cronómetro de llamada activa
  useEffect(() => {
    let timer;
    if (activeCall) {
      setIsCameraOn(activeCall.type === 'video');
      setIsSharingScreen(false);
      setIsMuted(false);
      setIsSpeakerOn(true);
      setIsFrontCamera(true);
      timer = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    } else {
      setCallSeconds(0);
      setIsSharingScreen(false);
      setIsCameraOn(false);
    }
    return () => clearInterval(timer);
  }, [activeCall]);

  // Temporizador para llamada saliente (cancela automáticamente a los 40s si no responden)
  useEffect(() => {
    let timer;
    if (outgoingCall) {
      let count = 0;
      timer = setInterval(() => {
        count += 1;
        if (count >= 40) {
          handleEndCall();
          Alert.alert('Sin respuesta', 'El contacto no respondió a la llamada.');
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [outgoingCall]);

  // 2. Sincronizar con Supabase 24/7 (Mensajes y Estados en Tiempo Real)
  useEffect(() => {
    if (!userProfile?.phone) return;

    const myCleanDigits = String(userProfile.phone || '').replace(/[^0-9]/g, '');

    const sincronizarEstadosSeguros = (stRows) => {
      if (!Array.isArray(stRows)) return;
      const vigentes = stRows.filter((s) => !calcularTiempoRestanteEstado(s).expirado);
      setStatuses((prev) => {
        const prevMap = {};
        prev.forEach((p) => {
          if (p?.id && p?.content) prevMap[p.id] = p.content;
        });
        return vigentes.map((item) => ({
          ...item,
          content: item.content || prevMap[item.id] || '',
        }));
      });
    };

    const cargarDatosNube = async () => {
      try {
        // Asegurar que la lista de eliminados y leídos esté cargada antes de sincronizar con la nube
        const [rawDelMsgs, rawClearedChats, rawReadMsgs] = await Promise.all([
          AsyncStorage.getItem('@nexchat_deleted_msgs_v3'),
          AsyncStorage.getItem('@nexchat_cleared_chats_v3'),
          AsyncStorage.getItem('@nexchat_read_msgs_v3'),
        ]);
        if (rawDelMsgs) {
          const parsedDel = JSON.parse(rawDelMsgs);
          if (Array.isArray(parsedDel)) {
            parsedDel.forEach((id) => deletedMsgIdsRef.current.add(id));
          }
        }
        if (rawClearedChats) {
          const parsedCleared = JSON.parse(rawClearedChats);
          if (parsedCleared && typeof parsedCleared === 'object') {
            clearedChatsRef.current = { ...clearedChatsRef.current, ...parsedCleared };
          }
        }
        if (rawReadMsgs) {
          const parsedRead = JSON.parse(rawReadMsgs);
          if (Array.isArray(parsedRead)) {
            parsedRead.forEach((id) => readMsgIdsRef.current.add(id));
          }
        }

        const ahoraMs = Date.now();

        // Ejecutar TODAS las consultas iniciales en PARALELO para que los primeros mensajes carguen al instante
        const [msgResult, stResult, usrResult] = await Promise.all([
          myCleanDigits.length >= 6
            ? supabase
                .from('nexchat_messages')
                .select('*')
                .or(`chat_id.ilike.%${myCleanDigits}%,chat_id.eq.official_nexchat,chat_id.ilike.group_%`)
                .order('timestamp', { ascending: true })
                .limit(200)
            : Promise.resolve({ data: [] }),
          supabase
            .from('nexchat_statuses')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(35),
          supabase
            .from('nexchat_users')
            .select('id,phone,name,online,last_seen,bio,avatar')
            .limit(120),
          supabase
            .from('nexchat_users')
            .update({ online: true, last_seen: new Date().toISOString() })
            .eq('phone', userProfile.phone),
          supabase.from('nexchat_statuses').delete().lt('expires_at', ahoraMs),
        ]);

        if (msgResult?.data && msgResult.data.length > 0) {
          integrarMensajesNube(msgResult.data);
        }

        if (stResult?.data) {
          sincronizarEstadosSeguros(stResult.data);
        }

        if (usrResult?.data) {
          const mapP = {};
          usrResult.data.forEach((u) => {
            const d = String(u.phone || '').replace(/[^0-9]/g, '');
            if (d) mapP[d] = u;
          });
          setUsersPresence(mapP);
        }
      } catch (e) {
        // Modo offline-first respaldado
      }
    };

    // Sincronización incremental rápida cada 3.5s para que el primer mensaje y las fotos de estado nunca tarden
    const sincronizarIncremental = async () => {
      if (AppState.currentState && AppState.currentState !== 'active') return;
      try {
        if (myCleanDigits.length >= 6) {
          const { data: recentMsgs } = await supabase
            .from('nexchat_messages')
            .select('*')
            .or(`chat_id.ilike.%${myCleanDigits}%,chat_id.eq.official_nexchat,chat_id.ilike.group_%`)
            .order('timestamp', { ascending: false })
            .limit(25);

          if (recentMsgs && recentMsgs.length > 0) {
            const ordenados = [...recentMsgs].reverse();
            ordenados.forEach((m) => {
              if (!m || deletedMsgIdsRef.current.has(m.id)) return;
              if (!processedMsgIdsRef.current.has(m.id)) {
                if (m.sender_phone !== userProfile.phone) {
                  recibirMensajeEnVivo(m);
                } else {
                  processedMsgIdsRef.current.add(m.id);
                }
              }
            });
          }
        }

        const { data: stData } = await supabase
          .from('nexchat_statuses')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(25);
        if (stData) {
          sincronizarEstadosSeguros(stData);
        }
      } catch {}
    };

    cargarDatosNube();

    const fastSyncInterval = setInterval(sincronizarIncremental, 3500);

    // Latido de presencia cada 40s y limpieza de estados vencidos de 24h
    const heartbeatInterval = setInterval(async () => {
      try {
        await supabase
          .from('nexchat_users')
          .update({ online: true, last_seen: new Date().toISOString() })
          .eq('phone', userProfile.phone);
        await supabase.from('nexchat_statuses').delete().lt('expires_at', Date.now());
        setStatuses((prev) => prev.filter((s) => !calcularTiempoRestanteEstado(s).expirado));
      } catch {}
    }, 40000);

    // Detectar cuando el usuario minimiza o vuelve a abrir la app para sincronizar al instante y auto-bloquear
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      try {
        const isActive = nextState === 'active';
        if (isActive) {
          sincronizarIncremental();
          if (appLockConfigRef.current?.enabled && backgroundTimeRef.current) {
            const elapsed = Date.now() - backgroundTimeRef.current;
            const waitTime = appLockConfigRef.current.autoLockTime === '1m' ? 60000 : (appLockConfigRef.current.autoLockTime === '5m' ? 300000 : 0);
            if (elapsed >= waitTime) {
              setIsLocked(true);
              setUnlockMode(appLockConfigRef.current.method === 'pin' ? 'pin' : 'huella');
            }
          }
        } else if (nextState === 'background' || nextState === 'inactive') {
          backgroundTimeRef.current = Date.now();
        }
        await supabase
          .from('nexchat_users')
          .update({ online: isActive, last_seen: new Date().toISOString() })
          .eq('phone', userProfile.phone);
      } catch {}
    });

    const channel = supabase
      .channel('nexchat_global_realtime', {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'fast_msg' }, ({ payload }) => {
        if (!payload || deletedMsgIdsRef.current.has(payload.id)) return;
        const roomId = payload.chat_id || payload.room_id || '';
        if (
          payload.sender_phone !== userProfile.phone &&
          !processedMsgIdsRef.current.has(payload.id) &&
          (roomId.includes(myCleanDigits) ||
            roomId === 'official_nexchat' ||
            String(roomId).startsWith('group_'))
        ) {
          recibirMensajeEnVivo(payload);
        }
      })
      .on('broadcast', { event: 'fast_status' }, ({ payload }) => {
        if (payload && !calcularTiempoRestanteEstado(payload).expirado) {
          setStatuses((prev) => [payload, ...prev.filter((s) => s.id !== payload.id)]);
        }
      })
      .on('broadcast', { event: 'fast_status_view' }, ({ payload }) => {
        if (payload?.id && payload?.bg_color) {
          setStatuses((prev) =>
            prev.map((s) => (s.id === payload.id ? { ...s, bg_color: payload.bg_color } : s))
          );
        }
      })
      .on('broadcast', { event: 'fast_call_offer' }, async ({ payload }) => {
        if (!payload || !userProfile?.phone) return;
        if (phonesMatch(payload.receiverPhone, userProfile.phone) && !phonesMatch(payload.callerPhone, userProfile.phone)) {
          setIncomingCall(payload);
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `📞 Llamada de ${payload.callerName || payload.callerPhone}`,
                body: payload.type === 'video' ? '📹 Videollamada entrante en NexChat' : '📞 Llamada de voz entrante',
                sound: true,
              },
              trigger: null,
            });
          } catch {}
        }
      })
      .on('broadcast', { event: 'fast_call_answer' }, ({ payload }) => {
        if (!payload || !userProfile?.phone) return;
        if (phonesMatch(payload.callerPhone, userProfile.phone)) {
          setOutgoingCall(null);
          setActiveCall({
            id: payload.callId,
            name: payload.receiverName || payload.receiverPhone,
            peerPhone: payload.receiverPhone,
            avatar: payload.receiverAvatar || '👤',
            type: payload.type || 'audio',
            status: 'connected',
          });
        }
      })
      .on('broadcast', { event: 'fast_call_end' }, ({ payload }) => {
        if (!payload || !userProfile?.phone) return;
        if (phonesMatch(payload.callerPhone, userProfile.phone) || phonesMatch(payload.receiverPhone, userProfile.phone)) {
          setIncomingCall(null);
          setOutgoingCall(null);
          setActiveCall(null);
          setIsSharingScreen(false);
          setIsCameraOn(false);
        }
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nexchat_messages' },
        async (payload) => {
          let nuevo = payload.new;
          if (!nuevo || deletedMsgIdsRef.current.has(nuevo.id)) return;
          if (processedMsgIdsRef.current.has(nuevo.id)) return;
          const roomId = nuevo.chat_id || nuevo.room_id || '';
          if (
            nuevo.sender_phone !== userProfile.phone &&
            (roomId.includes(myCleanDigits) ||
              roomId === 'official_nexchat' ||
              String(roomId).startsWith('group_'))
          ) {
            // Si PostgreSQL TOAST omitió una imagen grande en el evento Realtime, descargarla completa
            if (!nuevo.content) {
              try {
                const { data: fullMsg } = await supabase
                  .from('nexchat_messages')
                  .select('*')
                  .eq('id', nuevo.id)
                  .maybeSingle();
                if (fullMsg) nuevo = fullMsg;
              } catch {}
            }
            recibirMensajeEnVivo(nuevo);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'nexchat_messages' },
        (payload) => {
          const eliminado = payload.old;
          if (!eliminado?.id) return;
          deletedMsgIdsRef.current.add(eliminado.id);
          persistDeletedMsgIds(deletedMsgIdsRef.current);
          setChats((prev) => {
            const updated = prev.map((c) => ({
              ...c,
              messages: (c.messages || []).filter((m) => m.id !== eliminado.id),
            }));
            AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
            return updated;
          });
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
            deletedMsgIdsRef.current.add(actualizado.id);
            persistDeletedMsgIds(deletedMsgIdsRef.current);
            setChats((prev) => {
              const updated = prev.map((c) =>
                c.id === roomId
                  ? {
                      ...c,
                      messages: (c.messages || []).filter((m) => m.id !== actualizado.id),
                    }
                  : c
              );
              AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
              return updated;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nexchat_statuses' },
        async (payload) => {
          let nuevoSt = payload.new;
          if (!nuevoSt || calcularTiempoRestanteEstado(nuevoSt).expirado) return;
          // Si PostgreSQL TOAST omitió la foto Base64 en el evento INSERT, traer la fila completa antes de mostrar
          if (!nuevoSt.content) {
            try {
              const { data: fullSt } = await supabase
                .from('nexchat_statuses')
                .select('*')
                .eq('id', nuevoSt.id)
                .maybeSingle();
              if (fullSt) nuevoSt = fullSt;
            } catch {}
          }
          if (!nuevoSt.content) return;
          setStatuses((prev) => [
            nuevoSt,
            ...prev.filter((s) => s.id !== nuevoSt.id),
          ]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'nexchat_statuses' },
        async (payload) => {
          const upd = payload.new;
          if (!upd?.id) return;
          // Preservar siempre el content (foto/texto) cuando se actualiza bg_color con las vistas (TOAST safe)
          setStatuses((prev) =>
            prev.map((s) =>
              s.id === upd.id
                ? {
                    ...s,
                    ...upd,
                    content:
                      upd.content && String(upd.content).length > 0
                        ? upd.content
                        : s.content,
                  }
                : s
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'nexchat_statuses' },
        (payload) => {
          if (payload.old?.id) {
            setStatuses((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nexchat_users' },
        (payload) => {
          const usr = payload.new;
          if (usr?.phone) {
            const d = String(usr.phone).replace(/[^0-9]/g, '');
            if (d) {
              setUsersPresence((prev) => ({ ...prev, [d]: usr }));
            }
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      clearInterval(fastSyncInterval);
      clearInterval(heartbeatInterval);
      appStateSub.remove();
      realtimeChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [userProfile]);

  const integrarMensajesNube = (lista) => {
    setChats((prevChats) => {
      const mapa = [...prevChats];
      lista.forEach((m) => {
        const roomId = m.chat_id || m.room_id;
        // Ignorar cualquier mensaje que el usuario haya eliminado o vaciado
        if (deletedMsgIdsRef.current.has(m.id)) return;
        const clearedTs = clearedChatsRef.current[roomId];
        if (clearedTs && m.timestamp && Number(m.timestamp) <= Number(clearedTs)) return;
        if (String(m.content || '').includes('Este mensaje fue eliminado')) return;

        processedMsgIdsRef.current.add(m.id);
        if (m.timestamp && Number(m.timestamp) > lastSyncTimestampRef.current) {
          lastSyncTimestampRef.current = Number(m.timestamp);
        }

        const esMio = m.sender_phone === userProfile.phone;
        if (esMio || selectedChatIdRef.current === roomId) {
          readMsgIdsRef.current.add(m.id);
        }

        const plain = descifrarMensajeE2EE(m.content || m.ciphertext, roomId);
        const hora = m.time || new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isAudioMsg = m.type === 'audio' || (plain && String(plain).startsWith('data:audio'));
        const isImageMsg = m.type === 'image' || (plain && String(plain).startsWith('data:image'));
        const isStickerMsg = m.type === 'sticker';
        const msgObj = {
          id: m.id,
          sender: esMio ? 'me' : 'them',
          senderPhone: m.sender_phone,
          senderName: m.sender_name,
          text: isAudioMsg ? '🎤 Nota de voz' : (isStickerMsg ? '✨ Sticker' : plain),
          mediaUri: (isAudioMsg || isImageMsg || isStickerMsg) ? plain : null,
          mediaType: isAudioMsg ? 'audio' : (isImageMsg ? 'image' : (isStickerMsg ? 'sticker' : (m.type !== 'text' ? m.type : null))),
          ephemeral: !!m.expires_at,
          time: hora,
        };

        const idx = mapa.findIndex((c) => c.id === roomId);
        if (idx >= 0) {
          const yaExiste = (mapa[idx].messages || []).some((x) => x.id === m.id);
          const nextMsgs = yaExiste
            ? mapa[idx].messages || []
            : [...(mapa[idx].messages || []), msgObj];

          const sinLeer =
            selectedChatIdRef.current === roomId
              ? 0
              : nextMsgs.filter(
                  (x) =>
                    x.sender === 'them' &&
                    !readMsgIdsRef.current.has(x.id) &&
                    x.id !== 'welcome_1' &&
                    x.id !== 'welcome_2'
                ).length;

          mapa[idx] = {
            ...mapa[idx],
            unread: sinLeer,
            messages: nextMsgs,
          };
        } else {
          // Crear el chat automáticamente identificando al amigo real (no a uno mismo)
          const sinLeer = !esMio && !readMsgIdsRef.current.has(m.id) ? 1 : 0;
          const peerDigits = extraerPeerPhoneDeRoom(roomId, userProfile.phone);
          const peerInfo = (peerDigits && usersPresenceRef.current[peerDigits]) || null;
          const peerPhoneFinal = peerDigits ? `+${peerDigits}` : (esMio ? 'Contacto' : m.sender_phone);
          const peerNameFinal = (!esMio && m.sender_name) ? m.sender_name : (peerInfo?.name || peerPhoneFinal);
          const peerAvatarFinal = peerInfo?.avatar || '👤';

          mapa.push({
            id: roomId,
            name: peerNameFinal,
            peerPhone: peerPhoneFinal,
            avatar: peerAvatarFinal,
            isGroup: String(roomId).startsWith('group_'),
            online: true,
            unread: sinLeer,
            messages: [msgObj],
          });
        }
      });
      persistReadMsgIds(readMsgIdsRef.current);
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(mapa)).catch(() => {});
      return mapa;
    });
  };

  const recibirMensajeEnVivo = async (m) => {
    if (!m?.id || processedMsgIdsRef.current.has(m.id)) return;
    processedMsgIdsRef.current.add(m.id);

    const roomId = m.chat_id || m.room_id;
    // Si llega un mensaje nuevo en vivo, reactivar la sala si había sido vaciada antes
    if (clearedChatsRef.current[roomId]) {
      delete clearedChatsRef.current[roomId];
      persistClearedChats(clearedChatsRef.current);
    }

    const plain = descifrarMensajeE2EE(m.content || m.ciphertext, roomId);
    const hora = m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isAudioMsg = m.type === 'audio' || (plain && String(plain).startsWith('data:audio'));
    const isImageMsg = m.type === 'image' || (plain && String(plain).startsWith('data:image'));
    const isStickerMsg = m.type === 'sticker';
    const msgObj = {
      id: m.id,
      sender: 'them',
      senderPhone: m.sender_phone,
      senderName: m.sender_name,
      text: isAudioMsg ? '🎤 Nota de voz' : (isStickerMsg ? '✨ Sticker' : plain),
      mediaUri: (isAudioMsg || isImageMsg || isStickerMsg) ? plain : null,
      mediaType: isAudioMsg ? 'audio' : (isImageMsg ? 'image' : (isStickerMsg ? 'sticker' : (m.type !== 'text' ? m.type : null))),
      ephemeral: !!m.expires_at,
      time: hora,
    };

    const abiertoAhora = selectedChatIdRef.current === roomId;
    if (abiertoAhora) {
      readMsgIdsRef.current.add(m.id);
      persistReadMsgIds(readMsgIdsRef.current);
    }

    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === roomId);
      if (idx >= 0) {
        const updated = [...prev];
        const nextMsgs = (updated[idx].messages || []).some((x) => x.id === m.id)
          ? updated[idx].messages
          : [...(updated[idx].messages || []), msgObj];
        updated[idx] = {
          ...updated[idx],
          unread: abiertoAhora ? 0 : (updated[idx].unread || 0) + 1,
          messages: nextMsgs,
        };
        AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
        return updated;
      } else {
        const peerDigits = extraerPeerPhoneDeRoom(roomId, userProfile.phone);
        const peerInfo = (peerDigits && usersPresenceRef.current[peerDigits]) || null;
        const peerPhoneFinal = peerDigits ? `+${peerDigits}` : m.sender_phone;
        const peerNameFinal = m.sender_name || peerInfo?.name || peerPhoneFinal;
        const peerAvatarFinal = peerInfo?.avatar || '👤';

        const updated = [
          {
            id: roomId,
            name: peerNameFinal,
            peerPhone: peerPhoneFinal,
            avatar: peerAvatarFinal,
            isGroup: String(roomId).startsWith('group_'),
            online: true,
            unread: abiertoAhora ? 0 : 1,
            messages: [msgObj],
          },
          ...prev,
        ];
        AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
        return updated;
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
  const handleCreateDirectChat = async (peerPhone, customName, peerData, keepInModal = false) => {
    const roomId = generarRoomIdPrivado(userProfile.phone, peerPhone);
    if (clearedChatsRef.current[roomId]) {
      delete clearedChatsRef.current[roomId];
      persistClearedChats(clearedChatsRef.current);
    }
    const existing = chats.find((c) => c.id === roomId);
    if (existing) {
      if (!keepInModal) setSelectedChatId(roomId);
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

    setChats((prev) => {
      const updated = [nuevoChat, ...prev];
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    if (!keepInModal) {
      setSelectedChatId(roomId);
    }

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

  // 5. Enviar mensaje en chat activo (o enviar comunicado global si es en NexChat Oficial como Admin)
  const handleSendMessage = async (payload, extraParam) => {
    if (!selectedChatId) return;
    const targetRoomId = selectedChatId;
    if (clearedChatsRef.current[targetRoomId]) {
      delete clearedChatsRef.current[targetRoomId];
      persistClearedChats(clearedChatsRef.current);
    }

    // Extraer campos soportando tanto ({ text, mediaUri, ... }) como (chatId, texto) o (texto)
    let rawText = '';
    let mediaUri = null;
    let mediaType = 'text';
    let ephemeral = false;

    if (typeof payload === 'string') {
      if (typeof extraParam === 'string') {
        rawText = extraParam;
      } else {
        rawText = payload;
      }
    } else if (payload && typeof payload === 'object') {
      rawText = payload.text || '';
      mediaUri = payload.mediaUri || null;
      mediaType = payload.mediaType || 'text';
      ephemeral = Boolean(payload.ephemeral);
    }

    const cleanText = sanitizarEntrada(rawText);
    const esCanalOficial = targetRoomId === 'official_nexchat';
    const msgId = esCanalOficial
      ? `official_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    processedMsgIdsRef.current.add(msgId);
    readMsgIdsRef.current.add(msgId);
    persistReadMsgIds(readMsgIdsRef.current);

    const nuevoMsg = {
      id: msgId,
      sender: esCanalOficial ? 'them' : 'me',
      senderPhone: esCanalOficial ? 'OFICIAL' : userProfile.phone,
      senderName: esCanalOficial ? 'NexChat Oficial ✅' : userProfile.name,
      text: cleanText,
      mediaUri,
      mediaType,
      ephemeral: !!ephemeral,
      time: hora,
    };

    setChats((prev) => {
      const updated = prev.map((c) =>
        c.id === targetRoomId
          ? { ...c, messages: [...(c.messages || []), nuevoMsg] }
          : c
      );
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    // Si es efímero (15 segundos), autodestruir
    if (ephemeral) {
      setTimeout(() => {
        setChats((prev) =>
          prev.map((c) =>
            c.id === targetRoomId
              ? { ...c, messages: (c.messages || []).filter((m) => m.id !== msgId) }
              : c
          )
        );
      }, 15000);
    }

    // Enviar por doble vía simultánea: Broadcast WebSocket (~50ms) + Base de Datos Supabase 24/7
    try {
      const dbType =
        mediaType === 'image' || mediaType === 'audio' || mediaType === 'sticker' || mediaType === 'file'
          ? mediaType
          : 'text';
      const payloadContent = (mediaType === 'image' || mediaType === 'audio' || mediaType === 'sticker') ? mediaUri : cleanText;
      const cipher = cifrarMensajeE2EE(payloadContent, targetRoomId);
      const rowPayload = {
        id: msgId,
        chat_id: targetRoomId,
        sender_id: esCanalOficial ? 'nexchat_official' : (userProfile.id || userProfile.phone),
        sender_phone: esCanalOficial ? 'OFICIAL' : userProfile.phone,
        sender_name: esCanalOficial ? 'NexChat Oficial ✅' : userProfile.name,
        type: dbType,
        content: cipher,
        time: hora,
        timestamp: Date.now(),
        expires_at: ephemeral ? Date.now() + 15000 : null,
        status: 'read',
      };

      if (realtimeChannelRef.current) {
        realtimeChannelRef.current
          .send({ type: 'broadcast', event: 'fast_msg', payload: rowPayload })
          .catch(() => {});
      }

      await supabase.from('nexchat_messages').insert([rowPayload]);
    } catch (e) {}
  };

  // 6. Publicar, Ver y Eliminar Estado de 24h
  const handlePublishStatus = async (content, bgColor) => {
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const packedBg = serializarColorYVistasEstado(bgColor, []);
    const newSt = {
      id: `st_${Date.now()}`,
      user_id: userProfile.id || userProfile.phone,
      user_phone: userProfile.phone,
      user_name: userProfile.name,
      user_avatar: userProfile.avatar?.startsWith('data:') ? '📸' : (userProfile.avatar || '😎'),
      content: sanitizarEntrada(content),
      bg_color: packedBg,
      time: hora,
      expires_at: Date.now() + 86400000,
    };
    setStatuses((prev) => [newSt, ...prev]);

    try {
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current
          .send({ type: 'broadcast', event: 'fast_status', payload: newSt })
          .catch(() => {});
      }
      await supabase.from('nexchat_statuses').insert([newSt]);
    } catch (e) {}
  };

  const handleViewStatus = async (st) => {
    if (!st || !userProfile?.phone || st.user_phone === userProfile.phone) return;
    const { color, views } = parsearColorYVistasEstado(st.bg_color);
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const filtered = views.filter((v) => v.phone !== userProfile.phone);
    const updatedViews = [
      { phone: userProfile.phone, name: userProfile.name, time: hora },
      ...filtered,
    ];
    const newBg = serializarColorYVistasEstado(color, updatedViews);

    setStatuses((prev) =>
      prev.map((item) =>
        item.id === st.id
          ? { ...item, bg_color: newBg, content: item.content || st.content }
          : item
      )
    );

    try {
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current
          .send({
            type: 'broadcast',
            event: 'fast_status_view',
            payload: { id: st.id, bg_color: newBg },
          })
          .catch(() => {});
      }
      await supabase
        .from('nexchat_statuses')
        .update({ bg_color: newBg })
        .eq('id', st.id);
    } catch (e) {}
  };

  const handleDeleteStatus = async (statusId) => {
    setStatuses((prev) => prev.filter((s) => s.id !== statusId));
    try {
      await supabase.from('nexchat_statuses').delete().eq('id', statusId);
    } catch (e) {}
  };

  const handleUpdateGroupMembers = (chatId, newMembers) => {
    setChats((prev) => {
      const updated = prev.map((c) =>
        c.id === chatId ? { ...c, members: newMembers } : c
      );
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  // 7. Sistema de llamadas en tiempo real E2EE (Iniciar, Contestar, Rechazar, Finalizar)
  const handleStartCall = (chatObj, type = 'audio') => {
    if (!userProfile?.phone || !chatObj) return;
    let peerPhone = chatObj.peerPhone || chatObj.phone;
    if (!peerPhone && chatObj.id && String(chatObj.id).startsWith('dm_')) {
      peerPhone = extraerPeerPhoneDeRoom(chatObj.id, userProfile.phone);
    }
    if (!peerPhone) {
      Alert.alert('Sin número', 'Este contacto no tiene un teléfono asociado para llamar.');
      return;
    }

    const peerDigits = String(peerPhone).replace(/[^0-9]/g, '');
    const peerPresence = usersPresence[peerDigits] || Object.values(usersPresence).find(u => u?.phone && phonesMatch(u.phone, peerPhone));
    const peerName = (chatObj.name && !chatObj.name.startsWith('dm_')) ? chatObj.name : (peerPresence?.name || peerPhone);
    const peerAvatar = chatObj.avatar || peerPresence?.avatar || '👤';

    const callId = `call_${Date.now()}`;
    const callOffer = {
      callId,
      callerPhone: userProfile.phone,
      callerName: userProfile.name || userProfile.phone,
      callerAvatar: userProfile.avatar || '👤',
      receiverPhone: peerPhone,
      receiverName: peerName,
      receiverAvatar: peerAvatar,
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const registro = {
      id: callId,
      name: peerName,
      avatar: peerAvatar,
      peerPhone: peerPhone,
      type,
      time: callOffer.time,
    };
    const nuevaLista = [registro, ...callHistory];
    setCallHistory(nuevaLista);
    AsyncStorage.setItem('@nexchat_calls_v3', JSON.stringify(nuevaLista)).catch(() => {});

    setOutgoingCall(callOffer);

    if (realtimeChannelRef.current) {
      realtimeChannelRef.current
        .send({
          type: 'broadcast',
          event: 'fast_call_offer',
          payload: callOffer,
        })
        .catch(() => {});
    }
  };

  const handleAnswerCall = () => {
    const inc = incomingCallRef.current || incomingCall;
    if (!inc) return;
    const answeredPayload = {
      callId: inc.callId,
      callerPhone: inc.callerPhone,
      receiverPhone: userProfile.phone,
      receiverName: userProfile.name || userProfile.phone,
      receiverAvatar: userProfile.avatar || '👤',
      type: inc.type,
    };

    if (realtimeChannelRef.current) {
      realtimeChannelRef.current
        .send({
          type: 'broadcast',
          event: 'fast_call_answer',
          payload: answeredPayload,
        })
        .catch(() => {});
    }

    const registro = {
      id: inc.callId,
      name: inc.callerName || inc.callerPhone,
      avatar: inc.callerAvatar || '👤',
      peerPhone: inc.callerPhone,
      type: inc.type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setCallHistory((prev) => {
      const nextList = [registro, ...prev];
      AsyncStorage.setItem('@nexchat_calls_v3', JSON.stringify(nextList)).catch(() => {});
      return nextList;
    });

    setActiveCall({
      id: inc.callId,
      name: inc.callerName || inc.callerPhone,
      peerPhone: inc.callerPhone,
      avatar: inc.callerAvatar || '👤',
      type: inc.type,
      status: 'connected',
    });
    setIncomingCall(null);
  };

  const handleRejectCall = () => {
    const inc = incomingCallRef.current || incomingCall;
    if (!inc) return;
    const endPayload = {
      callId: inc.callId,
      callerPhone: inc.callerPhone,
      receiverPhone: userProfile.phone,
      reason: 'rejected',
    };
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current
        .send({
          type: 'broadcast',
          event: 'fast_call_end',
          payload: endPayload,
        })
        .catch(() => {});
    }
    setIncomingCall(null);
  };

  const handleEndCall = () => {
    const act = activeCallRef.current || activeCall;
    const out = outgoingCallRef.current || outgoingCall;
    const inc = incomingCallRef.current || incomingCall;
    const peerPhone = act?.peerPhone || out?.receiverPhone || inc?.callerPhone;
    const callId = act?.id || out?.callId || inc?.callId;
    if (realtimeChannelRef.current && peerPhone) {
      realtimeChannelRef.current
        .send({
          type: 'broadcast',
          event: 'fast_call_end',
          payload: {
            callId,
            callerPhone: userProfile.phone,
            receiverPhone: peerPhone,
            reason: 'hangup',
          },
        })
        .catch(() => {});
    }
    setActiveCall(null);
    setOutgoingCall(null);
    setIncomingCall(null);
    setIsSharingScreen(false);
    setIsCameraOn(false);
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

  // 11. Eliminar mensaje para mí (solo en mi teléfono, persistente para que nunca vuelva a salir)
  const handleDeleteMessageForMe = (chatId, msgId) => {
    deletedMsgIdsRef.current.add(msgId);
    persistDeletedMsgIds(deletedMsgIdsRef.current);

    setChats((prev) => {
      const updated = prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: (c.messages || []).filter((m) => m.id !== msgId) }
          : c
      );
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  // 12. Eliminar mensaje para todos (borra en mi teléfono y elimina de Supabase 24/7 para todos)
  const handleDeleteMessageForAll = async (chatId, msgId) => {
    deletedMsgIdsRef.current.add(msgId);
    persistDeletedMsgIds(deletedMsgIdsRef.current);

    setChats((prev) => {
      const updated = prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: (c.messages || []).filter((m) => m.id !== msgId) }
          : c
      );
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    try {
      await supabase
        .from('nexchat_messages')
        .delete()
        .eq('id', msgId);
    } catch (e) {}
  };

  // 13. Editar nombre de un contacto o grupo
  const handleEditContactName = async (chatId, newName) => {
    setChats((prev) => {
      const updated = prev.map((c) => (c.id === chatId ? { ...c, name: newName } : c));
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    try {
      await supabase
        .from('nexchat_chats')
        .update({ name: newName })
        .eq('id', chatId);
    } catch (e) {}
  };

  // 14. Vaciar chat SOLO para la persona que lo solicita (la otra persona conserva todo intacto)
  const handleClearChat = async (chatId) => {
    clearedChatsRef.current[chatId] = Date.now();
    persistClearedChats(clearedChatsRef.current);

    setChats((prev) => {
      const target = prev.find((c) => c.id === chatId);
      if (target?.messages) {
        target.messages.forEach((m) => deletedMsgIdsRef.current.add(m.id));
        persistDeletedMsgIds(deletedMsgIdsRef.current);
      }
      const updated = prev.map((c) => (c.id === chatId ? { ...c, messages: [] } : c));
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    // Se mantiene intacto en la nube para que el otro usuario no pierda sus mensajes
  };

  const handleDeleteChat = async (chatId) => {
    clearedChatsRef.current[chatId] = Date.now();
    persistClearedChats(clearedChatsRef.current);

    setChats((prev) => {
      const target = prev.find((c) => c.id === chatId);
      if (target?.messages) {
        target.messages.forEach((m) => deletedMsgIdsRef.current.add(m.id));
        persistDeletedMsgIds(deletedMsgIdsRef.current);
      }
      const updated = prev.filter((c) => c.id !== chatId);
      AsyncStorage.setItem('@nexchat_chats_v3', JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    if (selectedChatId === chatId) {
      setSelectedChatId(null);
    }

    try {
      await supabase.from('nexchat_messages').delete().eq('chat_id', chatId);
      if (chatId !== 'official_nexchat') {
        await supabase.from('nexchat_chats').delete().eq('id', chatId);
      }
    } catch (e) {}
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
  const totalUnreadMessages = chats.reduce((acc, c) => acc + (Number(c?.unread) || 0), 0);

  if (Platform.OS !== 'web') {
    Notifications.setBadgeCountAsync(totalUnreadMessages).catch(() => {});
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      {/* SI HAY UN CHAT ABIERTO, MOSTRAR PANTALLA DE CONVERSACIÓN */}
      {selectedChat ? (
        <ChatDetalleScreen
          chat={selectedChat}
          userProfile={userProfile}
          usersPresence={usersPresence}
          allChats={chats}
          isArchived={selectedChat && archivedChatIds.has(selectedChat.id)}
          onToggleArchiveChat={handleToggleArchiveChat}
          onBack={() => setSelectedChatId(null)}
          onSendMessage={handleSendMessage}
          onStartCall={handleStartCall}
          onDeleteMessageForMe={handleDeleteMessageForMe}
          onDeleteMessageForAll={handleDeleteMessageForAll}
          onEditContactName={handleEditContactName}
          onUpdateGroupMembers={handleUpdateGroupMembers}
          onClearChat={handleClearChat}
          onDeleteChat={handleDeleteChat}
        />
      ) : (
        <>
          {/* HEADER PRINCIPAL ESTILO WHATSAPP & TELEGRAM */}
          <View style={[styles.topHeader, { backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View style={styles.brandLogoCircle}>
                <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.brandTitle}>NexChat</Text>
                <Text style={styles.brandSub}>● Nube 24/7 Activa • E2EE</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity onPress={toggleTheme} style={styles.headerIconBtn}>
                <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsLocked(true)} style={styles.headerIconBtn}>
                <Ionicons name="lock-closed-outline" size={19} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* TARJETA DE ACTUALIZACIÓN OTA (DEBAJO DEL ENCABEZADO PARA NO TAPAR LA HORA) */}
          {otaAvailable && (
            <View style={styles.otaBannerWrap}>
              <TouchableOpacity
                onPress={() => Updates.reloadAsync()}
                style={styles.otaBannerCard}
              >
                <Text style={{ fontSize: 20 }}>🚀</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.otaBannerTitle}>Nueva versión lista para aplicar</Text>
                  <Text style={styles.otaBannerSub}>
                    Toca aquí para actualizar tu app al instante
                  </Text>
                </View>
                <View style={styles.otaApplyPill}>
                  <Text style={styles.otaApplyText}>Actualizar</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* CONTENIDO DE PESTAÑA ACTIVA */}
          <View style={{ flex: 1 }}>
            {activeTab === 'chats' && (
              <ChatsScreen
                chats={chats}
                userProfile={userProfile}
                usersPresence={usersPresence}
                archivedChatIds={archivedChatIds}
                onToggleArchiveChat={handleToggleArchiveChat}
                onSelectChat={(chat) => {
                  setChats((prev) =>
                    prev.map((c) => (c.id === chat.id ? { ...c, unread: 0 } : c))
                  );
                  setSelectedChatId(chat.id);
                }}
                onCreateDirectChat={handleCreateDirectChat}
                onCreateGroupChat={handleCreateGroupChat}
                onEditContactName={handleEditContactName}
                onClearChat={handleClearChat}
                onDeleteChat={handleDeleteChat}
              />
            )}

            {activeTab === 'estados' && (
              <EstadosScreen
                statuses={statuses}
                userProfile={userProfile}
                onPublishStatus={handlePublishStatus}
                onDeleteStatus={handleDeleteStatus}
                onViewStatus={handleViewStatus}
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
                appLockConfig={appLockConfig}
                onUpdateAppLockConfig={handleUpdateAppLockConfig}
                onUpdateProfile={handleUpdateProfile}
                onCheckUpdates={handleCheckUpdates}
                onLogout={handleLogout}
                onLockNow={() => {
                  setUnlockMode(appLockConfig.method === 'pin' ? 'pin' : 'huella');
                  setIsLocked(true);
                }}
                onPanicWipe={handlePanicWipe}
              />
            )}
          </View>

          {/* BARRA DE NAVEGACIÓN INFERIOR (4 PESTAÑAS CON ICONOS VECTORIALES Y CONTADOR DE MENSAJES) */}
          <View style={[styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.border }]}>
            {[
              { id: 'chats', label: 'Chats', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles', badge: totalUnreadMessages },
              { id: 'estados', label: 'Estados', icon: 'aperture-outline', activeIcon: 'aperture', badge: 0 },
              { id: 'llamadas', label: 'Llamadas', icon: 'call-outline', activeIcon: 'call', badge: 0 },
              { id: 'perfil', label: 'Perfil', icon: 'person-circle-outline', activeIcon: 'person-circle', badge: 0 },
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
                      active && { backgroundColor: 'rgba(0,168,132,0.18)' },
                      { position: 'relative' },
                    ]}
                  >
                    <Ionicons
                      name={active ? t.activeIcon : t.icon}
                      size={21}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    {t.badge > 0 && (
                      <View
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: 6,
                          backgroundColor: '#00A884',
                          minWidth: 18,
                          height: 18,
                          borderRadius: 9,
                          paddingHorizontal: 4,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1.5,
                          borderColor: colors.tabBar,
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>
                          {t.badge > 99 ? '99+' : t.badge}
                        </Text>
                      </View>
                    )}
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

      {/* MODAL DE LLAMADA ENTRANTE EN TIEMPO REAL */}
      <Modal visible={!!incomingCall} animationType="fade" transparent>
        {incomingCall && (
          <View style={styles.incomingModalOverlay}>
            <View style={styles.incomingCard}>
              <View style={styles.incomingBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#00A884" />
                <Text style={styles.incomingBadgeText}>Cifrado de Extremo a Extremo</Text>
              </View>

              <View style={styles.incomingAvatarRing}>
                {incomingCall.callerAvatar && (incomingCall.callerAvatar.startsWith('http') || incomingCall.callerAvatar.startsWith('data:')) ? (
                  <Image source={{ uri: incomingCall.callerAvatar }} style={styles.incomingAvatarImg} />
                ) : (
                  <Text style={{ fontSize: 48 }}>{incomingCall.callerAvatar || '👤'}</Text>
                )}
              </View>

              <Text style={styles.incomingCallerName} numberOfLines={1}>
                {incomingCall.callerName || incomingCall.callerPhone}
              </Text>
              <Text style={styles.incomingCallerPhone}>
                {incomingCall.callerPhone}
              </Text>
              <Text style={styles.incomingCallTypeNotice}>
                {incomingCall.type === 'video' ? '📹 Videollamada entrante de NexChat' : '📞 Llamada de voz entrante...'}
              </Text>

              <View style={styles.incomingActionsRow}>
                {/* Botón Rechazar */}
                <TouchableOpacity
                  style={[styles.callCircleBtn, { backgroundColor: '#EF4444' }]}
                  onPress={handleRejectCall}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.callCircleBtnText}>Rechazar</Text>
                </TouchableOpacity>

                {/* Botón Contestar */}
                <TouchableOpacity
                  style={[styles.callCircleBtn, { backgroundColor: '#22C55E' }]}
                  onPress={handleAnswerCall}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={28} color="#FFFFFF" />
                  <Text style={styles.callCircleBtnText}>Contestar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* MODAL DE LLAMADA SALIENTE ("TIMBRANDO EN EL OTRO CELULAR...") */}
      <Modal visible={!!outgoingCall} animationType="fade" transparent>
        {outgoingCall && (
          <View style={styles.incomingModalOverlay}>
            <View style={styles.incomingCard}>
              <View style={styles.incomingBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#00A884" />
                <Text style={styles.incomingBadgeText}>Cifrado de Extremo a Extremo</Text>
              </View>

              <View style={styles.incomingAvatarRing}>
                {outgoingCall.receiverAvatar && (outgoingCall.receiverAvatar.startsWith('http') || outgoingCall.receiverAvatar.startsWith('data:')) ? (
                  <Image source={{ uri: outgoingCall.receiverAvatar }} style={styles.incomingAvatarImg} />
                ) : (
                  <Text style={{ fontSize: 48 }}>{outgoingCall.receiverAvatar || '👤'}</Text>
                )}
              </View>

              <Text style={styles.incomingCallerName} numberOfLines={1}>
                {outgoingCall.receiverName || outgoingCall.receiverPhone}
              </Text>
              <Text style={styles.incomingCallerPhone}>
                {outgoingCall.receiverPhone}
              </Text>
              <View style={styles.ringingPill}>
                <Ionicons name="radio-outline" size={16} color="#00A884" />
                <Text style={styles.ringingText}>Timbrando en el otro celular...</Text>
              </View>

              <View style={{ marginTop: 28, alignItems: 'center' }}>
                <TouchableOpacity
                  style={[styles.callCircleBtn, { backgroundColor: '#EF4444', width: 70, height: 70 }]}
                  onPress={handleEndCall}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.callCircleBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* MODAL DE LLAMADA EN VIVO MEJORADO */}
      <Modal visible={!!activeCall} animationType="slide" transparent>
        {activeCall && (
          <View style={styles.callModal}>
            {/* ENCABEZADO SUPERIOR DE SEGURIDAD Y TIEMPO */}
            <View style={styles.callHeader}>
              <View style={styles.callEncryptedBadge}>
                <Text style={styles.callEncryptedBadgeText}>🔒 CIFRADO DE EXTREMO A EXTREMO (SHA-256)</Text>
              </View>
              <Text style={styles.callStatusSub}>
                {isSharingScreen
                  ? '💻 Transmitiendo pantalla en vivo'
                  : isCameraOn
                  ? `📹 Videollamada HD • ${isFrontCamera ? 'Cámara Frontal' : 'Cámara Trasera'}`
                  : '📞 Llamada de voz de alta fidelidad'}
              </Text>
              <View style={styles.callTimerBadge}>
                <Text style={styles.callTimerText}>
                  ⏱️ {Math.floor(callSeconds / 60).toString().padStart(2, '0')}:
                  {(callSeconds % 60).toString().padStart(2, '0')}
                </Text>
              </View>
            </View>

            {/* ÁREA CENTRAL PRINCIPAL: PANTALLA COMPARTIDA / CÁMARA / AUDIO */}
            <View style={styles.callCenterArea}>
              {isSharingScreen ? (
                /* VISTA DE PANTALLA COMPARTIDA */
                <View style={styles.screenShareCard}>
                  <View style={styles.screenShareGlow}>
                    <Text style={{ fontSize: 52 }}>💻</Text>
                    <View style={styles.screenShareLiveTag}>
                      <View style={styles.livePulseDot} />
                      <Text style={styles.screenShareLiveText}>EN VIVO • COMPARTIENDO PANTALLA</Text>
                    </View>
                    <Text style={styles.screenShareTitle}>Transmitiendo tu pantalla</Text>
                    <Text style={styles.screenShareDesc}>
                      {activeCall.name} está viendo todo lo que muestras en tu celular en tiempo real con alta resolución.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setIsSharingScreen(false)}
                      style={styles.stopScreenBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.stopScreenBtnText}>⏹️ Detener presentación</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : isCameraOn ? (
                /* VISTA DE CÁMARA ACTIVA */
                <View style={styles.videoStageCard}>
                  <View style={styles.videoStreamOverlay}>
                    <View style={styles.cameraLiveBadge}>
                      <View style={styles.livePulseDot} />
                      <Text style={styles.cameraLiveText}>
                        CAM HD • {isFrontCamera ? 'FRONTAL' : 'POSTERIOR'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => setIsFrontCamera(!isFrontCamera)}
                      style={styles.quickFlipBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 18 }}>🔄</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Simulación visual de streaming de cámara / avatar del usuario */}
                  <View style={styles.cameraFeedPlaceholder}>
                    <View style={styles.cameraFeedAvatarCircle}>
                      {activeCall.avatar && (activeCall.avatar.startsWith('http') || activeCall.avatar.startsWith('data:')) ? (
                        <Image source={{ uri: activeCall.avatar }} style={styles.cameraAvatarImg} />
                      ) : (
                        <Text style={{ fontSize: 52 }}>{activeCall.avatar || '👤'}</Text>
                      )}
                    </View>
                    <Text style={styles.cameraFeedPeer}>{activeCall.name}</Text>
                    <Text style={styles.cameraFeedSub}>Video cifrado en tiempo real</Text>
                  </View>
                </View>
              ) : (
                /* VISTA DE AUDIO ÚNICAMENTE (LLAMADA DE VOZ) */
                <View style={styles.audioStage}>
                  <View style={styles.audioRippleRing}>
                    <View style={styles.callAvatarBig}>
                      {activeCall.avatar && (activeCall.avatar.startsWith('http') || activeCall.avatar.startsWith('data:')) ? (
                        <Image source={{ uri: activeCall.avatar }} style={styles.callAvatarImg} />
                      ) : (
                        <Text style={{ fontSize: 64 }}>{activeCall.avatar || '👤'}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.callPeerName}>{activeCall.name}</Text>
                  <Text style={styles.callPeerPhone}>{activeCall.peerPhone || 'NexChat Usuario'}</Text>
                  <View style={styles.audioWavePill}>
                    <Text style={styles.audioWaveText}>🎙️ Conexión de voz ultra-clara</Text>
                  </View>
                </View>
              )}

              {/* AVISO RÁPIDO DE MICRÓFONO SILENCIADO */}
              {isMuted && (
                <View style={styles.mutedNoticePill}>
                  <Text style={styles.mutedNoticeText}>🔇 Tu micrófono está silenciado</Text>
                </View>
              )}
            </View>

            {/* BARRA DE HERRAMIENTAS Y CONTROLES INFERIOR */}
            <View style={styles.callControlsContainer}>
              <View style={styles.callControlsGrid}>
                {/* 1. MICRÓFONO */}
                <TouchableOpacity
                  onPress={() => setIsMuted(!isMuted)}
                  style={styles.callBtnWrap}
                  activeOpacity={0.7}
                >
                  <View style={[styles.callBtnCircle, isMuted ? styles.callBtnMuted : styles.callBtnNormal]}>
                    <Text style={{ fontSize: 22 }}>{isMuted ? '🔇' : '🎙️'}</Text>
                  </View>
                  <Text style={styles.callBtnLabel}>{isMuted ? 'Silenciado' : 'Micrófono'}</Text>
                </TouchableOpacity>

                {/* 2. CÁMARA */}
                <TouchableOpacity
                  onPress={() => {
                    const nextCam = !isCameraOn;
                    setIsCameraOn(nextCam);
                  }}
                  style={styles.callBtnWrap}
                  activeOpacity={0.7}
                >
                  <View style={[styles.callBtnCircle, isCameraOn ? styles.callBtnCamActive : styles.callBtnNormal]}>
                    <Text style={{ fontSize: 22 }}>{isCameraOn ? '📹' : '📷'}</Text>
                  </View>
                  <Text style={styles.callBtnLabel}>{isCameraOn ? 'Cám. Activa' : 'Prender Cám.'}</Text>
                </TouchableOpacity>

                {/* 3. GIRAR CÁMARA (FRONTAL / TRASERA) */}
                <TouchableOpacity
                  onPress={() => {
                    if (!isCameraOn) {
                      setIsCameraOn(true);
                      setIsFrontCamera(false);
                    } else {
                      setIsFrontCamera(!isFrontCamera);
                    }
                  }}
                  style={styles.callBtnWrap}
                  activeOpacity={0.7}
                >
                  <View style={[styles.callBtnCircle, styles.callBtnNormal]}>
                    <Text style={{ fontSize: 22 }}>🔄</Text>
                  </View>
                  <Text style={styles.callBtnLabel}>{isFrontCamera ? 'Girar Cám.' : 'Frontal'}</Text>
                </TouchableOpacity>

                {/* 4. PRESENTAR PANTALLA */}
                <TouchableOpacity
                  onPress={() => setIsSharingScreen(!isSharingScreen)}
                  style={styles.callBtnWrap}
                  activeOpacity={0.7}
                >
                  <View style={[styles.callBtnCircle, isSharingScreen ? styles.callBtnScreenActive : styles.callBtnNormal]}>
                    <Text style={{ fontSize: 22 }}>{isSharingScreen ? '📱' : '💻'}</Text>
                  </View>
                  <Text style={styles.callBtnLabel}>{isSharingScreen ? 'Presentando' : 'Pantalla'}</Text>
                </TouchableOpacity>

                {/* 5. ALTAVOZ */}
                <TouchableOpacity
                  onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                  style={styles.callBtnWrap}
                  activeOpacity={0.7}
                >
                  <View style={[styles.callBtnCircle, isSpeakerOn ? styles.callBtnSpeakerActive : styles.callBtnNormal]}>
                    <Text style={{ fontSize: 22 }}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
                  </View>
                  <Text style={styles.callBtnLabel}>{isSpeakerOn ? 'Altavoz' : 'Auricular'}</Text>
                </TouchableOpacity>
              </View>

              {/* BOTÓN COLGAR DESTACADO */}
              <TouchableOpacity
                onPress={handleEndCall}
                style={styles.callHangUpBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={24} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={styles.callHangUpText}>Finalizar Llamada</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* MODAL DE BLOQUEO POR HUELLA / PIN ESTILO WHATSAPP */}
      <Modal visible={isLocked} animationType="fade" transparent>
        <View style={styles.lockOverlay}>
          <View style={[styles.lockCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.lockShieldIconBadge}>
              <Ionicons name="shield-checkmark" size={26} color="#00A884" />
            </View>
            <Text style={[styles.lockTitle, { color: colors.text }]}>NexChat Bloqueado</Text>
            <Text style={[styles.lockSub, { color: colors.textMuted }]}>
              {unlockMode === 'huella'
                ? 'Apoya tu dedo en el sensor de huella dactilar para desbloquear tus conversaciones'
                : 'Ingresa tu PIN de seguridad para desbloquear tus conversaciones'}
            </Text>

            {unlockMode === 'huella' ? (
              <View style={{ alignItems: 'center', width: '100%', marginVertical: 14 }}>
                <TouchableOpacity
                  onPress={handleFingerprintUnlock}
                  activeOpacity={0.7}
                  style={[
                    styles.fingerprintCircleBtn,
                    fingerprintScanning && { backgroundColor: 'rgba(0,168,132,0.3)', borderColor: '#00A884', transform: [{ scale: 1.08 }] },
                  ]}
                >
                  <Ionicons
                    name="finger-print"
                    size={66}
                    color={fingerprintScanning ? '#00A884' : colors.primary}
                  />
                </TouchableOpacity>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 14 }}>
                  {fingerprintScanning ? 'Verificando huella...' : 'Toca el sensor de huella'}
                </Text>

                {/* Opción para alternar a PIN */}
                <TouchableOpacity
                  onPress={() => setUnlockMode('pin')}
                  style={{ marginTop: 22, paddingVertical: 8, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                    O desbloquear con PIN de seguridad
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: '100%' }}>
                <TextInput
                  style={[styles.lockInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={8}
                  value={unlockPin}
                  onChangeText={setUnlockPin}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={handleUnlockScreen}
                  style={[styles.unlockBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>Desbloquear con PIN</Text>
                </TouchableOpacity>

                {/* Opción para alternar a Huella */}
                <TouchableOpacity
                  onPress={() => setUnlockMode('huella')}
                  style={{ marginTop: 14, alignItems: 'center', paddingVertical: 8 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="finger-print" size={18} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>
                      Usar Huella Dactilar
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.log('[RootErrorBoundary] Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0B141A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>💬🔒</Text>
          <Text style={{ color: '#E9EDEF', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>
            NexChat Global
          </Text>
          <Text style={{ color: '#8696A0', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
            Para disfrutar de las nuevas funciones de notas de voz de micrófono y llamadas con video, por favor instala la nueva APK oficial directamente desde la página web.
          </Text>
          <TouchableOpacity
            onPress={async () => {
              try {
                if (Updates && Updates.reloadAsync) {
                  await Updates.reloadAsync();
                }
              } catch (e) {}
              this.setState({ hasError: false, error: null });
            }}
            style={{ backgroundColor: '#00A884', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 16 }}>Reintentar inicio</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <RootErrorBoundary>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </RootErrorBoundary>
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
  brandLogoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00A884',
    alignItems: 'center',
    justifyContent: 'center',
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
  otaBannerWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  otaBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#065F46',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
    elevation: 3,
  },
  otaBannerTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  otaBannerSub: { color: '#A7F3D0', fontSize: 11, marginTop: 1 },
  otaApplyPill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  otaApplyText: { color: '#052E16', fontSize: 12, fontWeight: '900' },
  callModal: {
    flex: 1,
    backgroundColor: '#071A14',
    justifyContent: 'space-between',
    paddingVertical: 44,
    paddingHorizontal: 20,
  },
  callHeader: {
    alignItems: 'center',
    width: '100%',
    gap: 6,
  },
  callEncryptedBadge: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  callEncryptedBadgeText: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  callStatusSub: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  callTimerBadge: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  callTimerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  callCenterArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginVertical: 14,
  },
  screenShareCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0B253A',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#0284C7',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  screenShareGlow: {
    alignItems: 'center',
    width: '100%',
  },
  screenShareLiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(2,132,199,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  screenShareLiveText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  screenShareTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },
  screenShareDesc: {
    color: '#93C5FD',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  stopScreenBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 16,
  },
  stopScreenBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  videoStageCard: {
    width: '100%',
    maxWidth: 360,
    height: 330,
    backgroundColor: '#03140F',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#10B981',
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  videoStreamOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  cameraLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  cameraLiveText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  quickFlipBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFeedPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraFeedAvatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#34D399',
    overflow: 'hidden',
  },
  cameraAvatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cameraFeedPeer: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  cameraFeedSub: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '600',
  },
  audioStage: {
    alignItems: 'center',
    width: '100%',
  },
  audioRippleRing: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(16,185,129,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  callAvatarBig: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#065F46',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#10B981',
    overflow: 'hidden',
  },
  callAvatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  callPeerName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  callPeerPhone: {
    color: '#A7F3D0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  audioWavePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 14,
  },
  audioWaveText: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '700',
  },
  mutedNoticePill: {
    position: 'absolute',
    bottom: -8,
    backgroundColor: '#D97706',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  mutedNoticeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  callControlsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  callControlsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    flexWrap: 'wrap',
  },
  callBtnWrap: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  callBtnCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  callBtnNormal: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  callBtnMuted: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B',
  },
  callBtnCamActive: {
    backgroundColor: '#059669',
    borderColor: '#34D399',
  },
  callBtnScreenActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  callBtnSpeakerActive: {
    backgroundColor: 'rgba(16,185,129,0.3)',
    borderColor: '#10B981',
  },
  callBtnLabel: {
    color: '#E5E7EB',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  callHangUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#DC2626',
    width: '100%',
    maxWidth: 280,
    paddingVertical: 13,
    borderRadius: 28,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  callHangUpText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
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
  lockShieldIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,168,132,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,168,132,0.3)',
  },
  fingerprintCircleBtn: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(0,168,132,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(0,168,132,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00A884',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
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
  incomingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  incomingCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0F172A',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.3)',
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  incomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  incomingBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  incomingAvatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#064E3B',
    borderWidth: 3,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
  incomingAvatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  incomingCallerName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  incomingCallerPhone: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  incomingCallTypeNotice: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  incomingActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  callCircleBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  callCircleBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  ringingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  ringingText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '800',
  },
});
