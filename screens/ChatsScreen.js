import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeContext';
import { PAISES_GLOBALES } from '../lib/paises';
import { formatearEstadoConexion } from '../lib/seguridad';

const CATEGORIAS_GRUPO = [
  { id: 'GRP::people', icon: 'people', label: 'Amigos', color: '#0284C7' },
  { id: 'GRP::briefcase', icon: 'briefcase', label: 'Trabajo', color: '#00A884' },
  { id: 'GRP::home', icon: 'home', label: 'Familia', color: '#8B5CF6' },
  { id: 'GRP::game-controller', icon: 'game-controller', label: 'Juegos', color: '#EC4899' },
  { id: 'GRP::football', icon: 'football', label: 'Deporte', color: '#F59E0B' },
  { id: 'GRP::school', icon: 'school', label: 'Estudio', color: '#3B82F6' },
];

export default function ChatsScreen({
  chats = [],
  userProfile,
  usersPresence = {},
  onSelectChat,
  onCreateDirectChat,
  onCreateGroupChat,
  onEditContactName,
  onDeleteChat,
}) {
  const { colors } = useTheme();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('all'); // 'all' | 'unread' | 'groups'
  const [chatEditando, setChatEditando] = useState(null);
  const [nuevoNombreEditado, setNuevoNombreEditado] = useState('');

  // Menú estilo WhatsApp / Telegram: null | 'menu' | 'nuevo_contacto' | 'nuevo_grupo'
  const [vistaModal, setVistaModal] = useState(null);
  const [volverAGrupoTrasContacto, setVolverAGrupoTrasContacto] = useState(false);

  // Directorio de personas registradas en NexChat (Supabase)
  const [usuariosNexChat, setUsuariosNexChat] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [busquedaDirectorio, setBusquedaDirectorio] = useState('');

  // Estado para Agregar Persona (Nuevo Contacto estilo WhatsApp & Telegram)
  const [paisSeleccionado, setPaisSeleccionado] = useState(PAISES_GLOBALES[0]); // Colombia por defecto
  const [modalPaises, setModalPaises] = useState(false);
  const [busquedaPais, setBusquedaPais] = useState('');

  const [nombreAmigo, setNombreAmigo] = useState('');
  const [apellidoAmigo, setApellidoAmigo] = useState('');
  const [telefonoAmigo, setTelefonoAmigo] = useState('');
  const [buscandoAmigo, setBuscandoAmigo] = useState(false);
  const [usuarioEncontradoLive, setUsuarioEncontradoLive] = useState(null);
  const [verificacionTerminada, setVerificacionTerminada] = useState(false);

  // Estado para Crear Nuevo Grupo (Estilo WhatsApp & Telegram)
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [iconoGrupo, setIconoGrupo] = useState('GRP::people');
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState([]);
  const [busquedaMiembroGrupo, setBusquedaMiembroGrupo] = useState('');

  const listaSegura = Array.isArray(chats) ? chats : [];
  const totalSinLeer = listaSegura.reduce((acc, c) => acc + (Number(c?.unread) || 0), 0);

  const chatsFiltrados = listaSegura.filter((c) => {
    if (!c) return false;
    if (filtro === 'unread' && (!c.unread || c.unread <= 0)) return false;
    if (filtro === 'groups' && !c.isGroup) return false;
    if (busqueda.trim() !== '') {
      const q = busqueda.toLowerCase();
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.peerPhone || c.phone || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Cargar directorio de amigos registrados cuando se abre el menú
  useEffect(() => {
    if (vistaModal) {
      cargarDirectorioUsuarios();
    }
  }, [vistaModal]);

  // Verificación en vivo estilo WhatsApp mientras escribes el número de tu amigo
  useEffect(() => {
    const limpio = telefonoAmigo.replace(/[^0-9]/g, '');
    if (limpio.length < 6) {
      setUsuarioEncontradoLive(null);
      setVerificacionTerminada(false);
      return;
    }
    setVerificacionTerminada(false);
    const timer = setTimeout(async () => {
      try {
        const numCompleto = `${paisSeleccionado.code} ${limpio}`;
        const { data } = await supabase
          .from('nexchat_users')
          .select('*')
          .or(`phone.eq.${numCompleto},phone.ilike.%${limpio}%`)
          .limit(1)
          .maybeSingle();
        setUsuarioEncontradoLive(data || null);
      } catch {
        setUsuarioEncontradoLive(null);
      } finally {
        setVerificacionTerminada(true);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [telefonoAmigo, paisSeleccionado]);

  async function cargarDirectorioUsuarios() {
    setCargandoUsuarios(true);
    try {
      const { data } = await supabase
        .from('nexchat_users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80);
      if (data) {
        const myDigits = String(userProfile?.phone || '').replace(/[^0-9]/g, '');
        setUsuariosNexChat(
          data.filter((u) => String(u.phone || '').replace(/[^0-9]/g, '') !== myDigits)
        );
      }
    } catch {}
    setCargandoUsuarios(false);
  }

  // Lista combinada e inteligente de todos tus contactos (agenda de chats + directorio NexChat)
  const obtenerContactosUnificados = () => {
    const myDigits = String(userProfile?.phone || '').replace(/[^0-9]/g, '');
    const mapa = new Map();

    // 1. Contactos con los que ya tienes chat (respeta el nombre personalizado que le pusiste)
    listaSegura.forEach((c) => {
      if (!c || c.official || c.isGroup) return;
      const phone = c.peerPhone || c.phone || '';
      const digits = String(phone).replace(/[^0-9]/g, '');
      if (!digits || digits === myDigits) return;
      mapa.set(digits, {
        id: c.id,
        phone,
        digits,
        name: c.name || phone,
        avatar: c.avatar,
        bio: 'En tus contactos',
        fromAgenda: true,
      });
    });

    // 2. Usuarios registrados en NexChat
    usuariosNexChat.forEach((u) => {
      const phone = u.phone || '';
      const digits = String(phone).replace(/[^0-9]/g, '');
      if (!digits || digits === myDigits) return;
      if (mapa.has(digits)) {
        const prev = mapa.get(digits);
        mapa.set(digits, {
          ...prev,
          avatar: prev.avatar && prev.avatar !== '👤' ? prev.avatar : u.avatar,
          bio: u.bio || prev.bio,
        });
      } else {
        mapa.set(digits, {
          id: u.id || phone,
          phone,
          digits,
          name: u.name || phone,
          avatar: u.avatar,
          bio: u.bio || 'Disponible en NexChat',
          fromAgenda: false,
        });
      }
    });

    return Array.from(mapa.values());
  };

  const contactosUnificados = obtenerContactosUnificados();

  // 1. Guardar Nuevo Contacto e Iniciar Chat (o añadirlo al grupo si venía de Crear Grupo)
  async function handleGuardarContacto() {
    const soloDigitos = telefonoAmigo.trim();
    if (!soloDigitos || soloDigitos.length < 6) {
      Alert.alert('Número incompleto', 'Escribe el número de celular de tu contacto.');
      return;
    }

    const numeroCompleto = soloDigitos.startsWith('+')
      ? soloDigitos
      : `${paisSeleccionado.code} ${soloDigitos}`;

    setBuscandoAmigo(true);
    let peerData = usuarioEncontradoLive;
    if (!peerData) {
      try {
        const soloNum = soloDigitos.replace(/[^0-9]/g, '');
        const { data } = await supabase
          .from('nexchat_users')
          .select('*')
          .or(`phone.eq.${numeroCompleto},phone.ilike.%${soloNum}%`)
          .limit(1)
          .maybeSingle();
        if (data) peerData = data;
      } catch {}
    }
    setBuscandoAmigo(false);

    if (!peerData) {
      Alert.alert(
        'Esta persona no tiene NexChat',
        `El número ${numeroCompleto} no está registrado en NexChat Global.\n\nNo se le puede escribir hasta que descargue la aplicación y cree su cuenta.`
      );
      return;
    }

    const nombreCompuesto = [nombreAmigo.trim(), apellidoAmigo.trim()].filter(Boolean).join(' ');
    const nombreFinal = nombreCompuesto || peerData.name || numeroCompleto;

    setTelefonoAmigo('');
    setNombreAmigo('');
    setApellidoAmigo('');
    setUsuarioEncontradoLive(null);
    setVerificacionTerminada(false);

    if (volverAGrupoTrasContacto) {
      // Añadirlo a la agenda sin salir de la creación del grupo y marcarlo automáticamente
      onCreateDirectChat(peerData.phone, nombreFinal, peerData, true);
      setMiembrosSeleccionados((prev) =>
        prev.includes(peerData.phone) ? prev : [...prev, peerData.phone]
      );
      setVolverAGrupoTrasContacto(false);
      setVistaModal('nuevo_grupo');
      return;
    }

    onCreateDirectChat(peerData.phone, nombreFinal, peerData, false);
    setVistaModal(null);
  }

  // 2. Seleccionar / Deseleccionar miembro para un grupo
  function toggleMiembroGrupo(phone) {
    setMiembrosSeleccionados((prev) =>
      prev.includes(phone) ? prev.filter((p) => p !== phone) : [...prev, phone]
    );
  }

  function toggleSeleccionarTodosGrupo(listaVisible) {
    const telefonosVisibles = listaVisible.map((u) => u.phone);
    const todosMarcados =
      telefonosVisibles.length > 0 &&
      telefonosVisibles.every((p) => miembrosSeleccionados.includes(p));
    if (todosMarcados) {
      setMiembrosSeleccionados((prev) => prev.filter((p) => !telefonosVisibles.includes(p)));
    } else {
      setMiembrosSeleccionados((prev) => Array.from(new Set([...prev, ...telefonosVisibles])));
    }
  }

  // 3. Elegir foto de galería para el grupo
  async function elegirFotoGrupo() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        setIconoGrupo(a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri);
      }
    } catch {}
  }

  // 4. Crear Grupo Oficialmente
  function handleCrearGrupoFinal() {
    if (!nombreGrupo.trim()) {
      Alert.alert('Falta el nombre', 'Escribe un nombre para el nuevo grupo.');
      return;
    }
    if (miembrosSeleccionados.length === 0) {
      Alert.alert(
        'Selecciona participantes',
        'Toca al menos 1 contacto de la lista para añadirlo al grupo.'
      );
      return;
    }

    onCreateGroupChat(nombreGrupo.trim(), miembrosSeleccionados, iconoGrupo);
    setNombreGrupo('');
    setMiembrosSeleccionados([]);
    setBusquedaMiembroGrupo('');
    setVistaModal(null);
  }

  const renderAvatar = (
    avatarStr,
    isOfficial = false,
    size = 50,
    fallbackName = '',
    showOnlineDot = false
  ) => {
    const esImg =
      avatarStr && (avatarStr.startsWith('http') || avatarStr.startsWith('data:image'));
    const esCatGrupo = avatarStr && String(avatarStr).startsWith('GRP::');
    const catObj = esCatGrupo
      ? CATEGORIAS_GRUPO.find((c) => c.id === avatarStr) || CATEGORIAS_GRUPO[0]
      : null;

    let innerContent = null;
    if (esImg) {
      innerContent = (
        <Image
          source={{ uri: avatarStr }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#202c33' }}
        />
      );
    } else if (isOfficial) {
      innerContent = (
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
          <Ionicons name="shield-checkmark" size={size * 0.5} color="#FFFFFF" />
        </View>
      );
    } else if (catObj) {
      innerContent = (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: catObj.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={catObj.icon} size={size * 0.48} color="#FFFFFF" />
        </View>
      );
    } else {
      const limpio = String(fallbackName || '').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ+ ]/g, '').trim();
      const iniciales = limpio
        ? limpio.startsWith('+')
          ? limpio.slice(0, 3)
          : limpio.slice(0, 2).toUpperCase()
        : 'NC';
      innerContent = (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#0284C7',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.36, fontWeight: '900' }}>
            {iniciales}
          </Text>
        </View>
      );
    }

    return (
      <View style={{ width: size, height: size, position: 'relative' }}>
        {innerContent}
        {showOnlineDot && (
          <View
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: Math.max(12, size * 0.25),
              height: Math.max(12, size * 0.25),
              borderRadius: Math.max(6, size * 0.125),
              backgroundColor: '#10B981',
              borderWidth: 2,
              borderColor: colors.bg,
            }}
          />
        )}
      </View>
    );
  };

  const paisesFiltrados = PAISES_GLOBALES.filter((p) => {
    if (!busquedaPais.trim()) return true;
    const q = busquedaPais.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.includes(q);
  });

  const directorioFiltrado = contactosUnificados.filter((u) => {
    if (!busquedaDirectorio.trim()) return true;
    const q = busquedaDirectorio.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  });

  const contactosGrupoFiltrados = contactosUnificados.filter((u) => {
    if (!busquedaMiembroGrupo.trim()) return true;
    const q = busquedaMiembroGrupo.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Barra de Búsqueda, Filtros y Botón + Nuevo */}
      <View style={[styles.searchSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar conversación o número..."
            placeholderTextColor={colors.textMuted}
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>

        <View style={styles.filterRow}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { id: 'all', label: 'Todos', count: 0 },
              { id: 'unread', label: 'No leídos', count: totalSinLeer },
              { id: 'groups', label: 'Grupos', count: 0 },
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterPill,
                  filtro === f.id && styles.filterPillActive,
                  { flexDirection: 'row', alignItems: 'center', gap: 5 },
                ]}
                onPress={() => setFiltro(f.id)}
              >
                <Text style={[styles.filterText, filtro === f.id && styles.filterTextActive]}>
                  {f.label}
                </Text>
                {f.count > 0 && (
                  <View
                    style={{
                      backgroundColor: filtro === f.id ? '#FFFFFF' : '#00A884',
                      minWidth: 17,
                      height: 17,
                      borderRadius: 8.5,
                      paddingHorizontal: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: filtro === f.id ? '#00A884' : '#FFFFFF',
                        fontSize: 10,
                        fontWeight: '900',
                      }}
                    >
                      {f.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.newTopBtn}
            onPress={() => {
              setVolverAGrupoTrasContacto(false);
              setVistaModal('menu');
            }}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.newTopBtnText}>Añadir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Conversaciones con Estado de Conexión en Vivo */}
      <FlatList
        data={chatsFiltrados}
        keyExtractor={(item, idx) => item.id || String(idx)}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          const msgs = Array.isArray(item.messages) ? item.messages : [];
          const ultimo = msgs[msgs.length - 1];
          const estadoCon = formatearEstadoConexion(
            item.peerPhone || item.phone,
            usersPresence,
            item.official,
            item.isGroup,
            item.members?.length
          );

          let vistaPrevia = item.status || 'Cifrado de extremo a extremo';
          if (ultimo) {
            vistaPrevia = ultimo.text || ultimo.content || vistaPrevia;
          }

          return (
            <TouchableOpacity
              style={[styles.chatRow, { borderColor: colors.border }]}
              onPress={() => onSelectChat && onSelectChat(item)}
              onLongPress={() => {
                if (!item.official) {
                  setNuevoNombreEditado(item.name || '');
                  setChatEditando(item);
                }
              }}
            >
              {renderAvatar(
                item.avatar,
                item.official,
                52,
                item.name,
                estadoCon.isOnline && !item.isGroup
              )}

              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 5 }}>
                    <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.official && <Ionicons name="checkmark-circle" size={16} color="#00A884" />}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={[
                        styles.timeText,
                        { color: item.unread > 0 ? '#00a884' : colors.textMuted },
                        item.unread > 0 && { fontWeight: '800' },
                      ]}
                    >
                      {ultimo ? ultimo.time : item.lastTime || 'Ahora'}
                    </Text>
                    {!item.official && (
                      <TouchableOpacity
                        onPress={() => {
                          setNuevoNombreEditado(item.name || '');
                          setChatEditando(item);
                        }}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Estado de conexión estilo WhatsApp / Telegram ("en línea", "Activo hace X min...") */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: estadoCon.isOnline ? '#10B981' : '#64748B',
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: estadoCon.isOnline ? '800' : '600',
                      color: estadoCon.isOnline ? '#10B981' : colors.textMuted,
                    }}
                    numberOfLines={1}
                  >
                    {estadoCon.shortText}
                  </Text>
                </View>

                <View style={[styles.rowBetween, { marginTop: 3 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8, gap: 4 }}>
                    {ultimo && (ultimo.sender === 'me' || ultimo.senderPhone === userProfile?.phone) && (
                      <Ionicons name="checkmark-done" size={15} color="#34B7F1" />
                    )}
                    <Text
                      style={[
                        styles.previewText,
                        {
                          color: item.unread > 0 ? colors.text : colors.textMuted,
                          fontWeight: item.unread > 0 ? '800' : '500',
                          marginRight: 0,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {vistaPrevia}
                    </Text>
                  </View>
                  {item.unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Botón Flotante estilo WhatsApp */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setVolverAGrupoTrasContacto(false);
          setVistaModal('menu');
        }}
      >
        <Ionicons name="person-add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* MODAL RÁPIDO PARA EDITAR NOMBRE DEL CONTACTO O ELIMINAR CHAT */}
      <Modal
        visible={!!chatEditando}
        transparent
        animationType="fade"
        onRequestClose={() => setChatEditando(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 22 }}>
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>
                Editar Contacto
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>NOMBRE VISIBLE</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={nuevoNombreEditado}
              onChangeText={setNuevoNombreEditado}
              placeholder="Escribe el nuevo nombre..."
              placeholderTextColor={colors.textMuted}
            />

            {chatEditando?.peerPhone ? (
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', marginTop: 8 }}>
                Teléfono: {chatEditando.peerPhone}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={() => {
                if (nuevoNombreEditado.trim() && onEditContactName && chatEditando) {
                  onEditContactName(chatEditando.id, nuevoNombreEditado.trim());
                }
                setChatEditando(null);
              }}
              style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
            >
              <Text style={styles.submitBtnText}>Guardar Nuevo Nombre</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (onDeleteChat && chatEditando) {
                  onDeleteChat(chatEditando.id);
                }
                setChatEditando(null);
              }}
              style={[
                styles.submitBtn,
                { backgroundColor: 'rgba(239,68,68,0.14)', borderWidth: 1, borderColor: '#EF4444', marginTop: 10 },
              ]}
            >
              <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '900' }}>
                Eliminar Contacto / Chat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setChatEditando(null)}
              style={{ marginTop: 14, paddingVertical: 8, alignItems: 'center' }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PANTALLA COMPLETA ESTILO WHATSAPP & TELEGRAM: CONTACTOS, AGREGAR PERSONA Y CREAR GRUPO */}
      <Modal
        visible={!!vistaModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (vistaModal === 'nuevo_contacto' && volverAGrupoTrasContacto) {
            setVolverAGrupoTrasContacto(false);
            setVistaModal('nuevo_grupo');
          } else if (vistaModal === 'menu') {
            setVistaModal(null);
          } else {
            setVistaModal('menu');
          }
        }}
      >
        <View style={[styles.fullScreenModal, { backgroundColor: colors.bg }]}>
          {/* HEADER DEL MODAL */}
          <View style={[styles.modalHeader, { backgroundColor: colors.headerBg }]}>
            <TouchableOpacity
              onPress={() => {
                if (vistaModal === 'nuevo_contacto' && volverAGrupoTrasContacto) {
                  setVolverAGrupoTrasContacto(false);
                  setVistaModal('nuevo_grupo');
                } else if (vistaModal === 'menu') {
                  setVistaModal(null);
                } else {
                  setVistaModal('menu');
                }
              }}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalHeaderTitle}>
                {vistaModal === 'menu'
                  ? 'Contactos y Grupos'
                  : vistaModal === 'nuevo_contacto'
                  ? 'Añadir nuevo contacto'
                  : 'Crear nuevo grupo'}
              </Text>
              <Text style={styles.modalHeaderSub}>
                {vistaModal === 'menu'
                  ? `${contactosUnificados.length} contactos disponibles en NexChat`
                  : vistaModal === 'nuevo_contacto'
                  ? 'Directorio internacional con todos los países'
                  : `${miembrosSeleccionados.length} participantes seleccionados`}
              </Text>
            </View>
          </View>

          {/* VISTA 1: MENÚ PRINCIPAL DE CONTACTOS Y GRUPOS */}
          {vistaModal === 'menu' && (
            <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
              {/* Buscador Global */}
              <View style={[styles.searchBar, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 14 }]}>
                <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Buscar persona por nombre o número (+57, +52, +34...)"
                  placeholderTextColor={colors.textMuted}
                  value={busquedaDirectorio}
                  onChangeText={setBusquedaDirectorio}
                />
              </View>

              {/* Acciones Principales */}
              <View style={[styles.menuBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => {
                    setVolverAGrupoTrasContacto(false);
                    setVistaModal('nuevo_contacto');
                  }}
                  style={styles.actionRow}
                >
                  <View style={[styles.greenCircleIcon, { backgroundColor: colors.primary }]}>
                    <Ionicons name="person-add" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Nuevo contacto</Text>
                    <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                      Añadir persona con selector de todos los países del mundo
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <TouchableOpacity
                  onPress={() => setVistaModal('nuevo_grupo')}
                  style={styles.actionRow}
                >
                  <View style={[styles.greenCircleIcon, { backgroundColor: '#0284C7' }]}>
                    <Ionicons name="people" size={22} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Nuevo grupo</Text>
                    <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                      Selecciona contactos de tu lista con un solo toque
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Lista de Contactos ya registrados en NexChat */}
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                MIS CONTACTOS EN NEXCHAT ({directorioFiltrado.length})
              </Text>

              {cargandoUsuarios ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
              ) : directorioFiltrado.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="globe-outline" size={32} color={colors.primary} style={{ marginBottom: 6 }} />
                  <Text style={[styles.actionTitle, { color: colors.text }]}>
                    Añade un contacto de cualquier país
                  </Text>
                  <Text style={[styles.actionSub, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
                    Toca "Nuevo contacto" arriba para elegir el país e ingresar el número de tu amigo.
                  </Text>
                </View>
              ) : (
                directorioFiltrado.map((u) => {
                  const estadoCon = formatearEstadoConexion(u.phone, usersPresence);
                  return (
                    <TouchableOpacity
                      key={u.id || u.phone}
                      onPress={() => {
                        onCreateDirectChat(u.phone, u.name, u, false);
                        setVistaModal(null);
                      }}
                      style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      {renderAvatar(u.avatar, false, 48, u.name, estadoCon.isOnline)}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.actionTitle, { color: colors.text }]}>{u.name}</Text>
                        <Text
                          style={{
                            color: estadoCon.isOnline ? '#10B981' : colors.textMuted,
                            fontSize: 11,
                            fontWeight: estadoCon.isOnline ? '800' : '600',
                            marginTop: 2,
                          }}
                        >
                          {estadoCon.shortText} • {u.phone}
                        </Text>
                      </View>
                      <View style={[styles.chatPill, { backgroundColor: 'rgba(0,168,132,0.16)' }]}>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '900' }}>Chatear</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* VISTA 2: NUEVO CONTACTO (ESTILO WHATSAPP & TELEGRAM CON TODOS LOS PAÍSES) */}
          {vistaModal === 'nuevo_contacto' && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
              <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.inputRowIcon}>
                  <Ionicons name="person-outline" size={22} color={colors.primary} style={{ marginTop: 18 }} />
                  <View style={{ flex: 1, gap: 10 }}>
                    <View>
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>NOMBRE</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                        placeholder="Nombre (ej. Juan, María...)"
                        placeholderTextColor={colors.textMuted}
                        value={nombreAmigo}
                        onChangeText={setNombreAmigo}
                      />
                    </View>
                    <View>
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>APELLIDO (OPCIONAL)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                        placeholder="Apellido"
                        placeholderTextColor={colors.textMuted}
                        value={apellidoAmigo}
                        onChangeText={setApellidoAmigo}
                      />
                    </View>
                  </View>
                </View>

                {/* Selector de País estilo WhatsApp + Número de Teléfono */}
                <View style={[styles.inputRowIcon, { marginTop: 18 }]}>
                  <Ionicons name="call-outline" size={22} color={colors.primary} style={{ marginTop: 20 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>PAÍS / INDICATIVO GLOBAL</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setBusquedaPais('');
                        setModalPaises(true);
                      }}
                      style={[styles.countrySelectorBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    >
                      <Text style={{ fontSize: 22 }}>{paisSeleccionado.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.countrySelectorName, { color: colors.text }]}>
                          {paisSeleccionado.name}
                        </Text>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>
                          Indicativo: {paisSeleccionado.code}
                        </Text>
                      </View>
                      <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 13 }}>
                        Cambiar ▼
                      </Text>
                    </TouchableOpacity>

                    <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 14 }]}>
                      NÚMERO DE TELÉFONO
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setModalPaises(true)}
                        style={[styles.codePrefixBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                      >
                        <Text style={{ fontSize: 16 }}>{paisSeleccionado.flag}</Text>
                        <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 15 }}>
                          {paisSeleccionado.code}
                        </Text>
                      </TouchableOpacity>

                      <TextInput
                        style={[
                          styles.textInput,
                          { flex: 1, backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
                        ]}
                        placeholder="310 555 8899"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="phone-pad"
                        value={telefonoAmigo}
                        onChangeText={setTelefonoAmigo}
                      />
                    </View>
                  </View>
                </View>

                {usuarioEncontradoLive ? (
                  <View style={[styles.liveMatchBox, { borderColor: colors.primary }]}>
                    {renderAvatar(usuarioEncontradoLive.avatar, false, 44, usuarioEncontradoLive.name, true)}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '900' }}>
                        Esta persona tiene cuenta en NexChat
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                        {usuarioEncontradoLive.name}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                        {usuarioEncontradoLive.bio}
                      </Text>
                    </View>
                  </View>
                ) : verificacionTerminada && telefonoAmigo.replace(/[^0-9]/g, '').length >= 6 ? (
                  <View
                    style={[
                      styles.liveMatchBox,
                      {
                        borderColor: '#EF4444',
                        backgroundColor: 'rgba(239,68,68,0.12)',
                      },
                    ]}
                  >
                    <Ionicons name="alert-circle" size={28} color="#EF4444" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '900' }}>
                        Esta persona no tiene NexChat
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2, lineHeight: 16 }}>
                        El número {paisSeleccionado.code} {telefonoAmigo.trim()} no tiene cuenta registrada. No se le puede escribir hasta que cree su cuenta.
                      </Text>
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={handleGuardarContacto}
                  disabled={buscandoAmigo}
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor:
                        verificacionTerminada && !usuarioEncontradoLive && telefonoAmigo.replace(/[^0-9]/g, '').length >= 6
                          ? '#475569'
                          : colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.submitBtnText,
                      verificacionTerminada && !usuarioEncontradoLive && telefonoAmigo.replace(/[^0-9]/g, '').length >= 6 && {
                        color: '#E2E8F0',
                      },
                    ]}
                  >
                    {buscandoAmigo
                      ? 'Verificando cuenta en NexChat...'
                      : verificacionTerminada && !usuarioEncontradoLive && telefonoAmigo.replace(/[^0-9]/g, '').length >= 6
                      ? 'Sin cuenta en NexChat (No se puede escribir)'
                      : volverAGrupoTrasContacto
                      ? 'Guardar y Añadir al Grupo'
                      : 'Guardar Contacto y Chatear'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* VISTA 3: CREAR NUEVO GRUPO ESTILO WHATSAPP & TELEGRAM (SELECCIÓN PROACTIVA DE CONTACTOS) */}
          {vistaModal === 'nuevo_grupo' && (
            <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 80 }}>
              {/* TARJETA CABECERA DEL GRUPO (FOTO + NOMBRE) */}
              <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <TouchableOpacity
                    onPress={elegirFotoGrupo}
                    style={[styles.groupAvatarPicker, { borderColor: colors.primary }]}
                  >
                    {renderAvatar(iconoGrupo, false, 68, nombreGrupo || 'Grupo')}
                    <View style={[styles.camCorner, { backgroundColor: colors.primary }]}>
                      <Ionicons name="camera" size={14} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 0 }]}>
                      NOMBRE DEL GRUPO
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
                      ]}
                      placeholder="Ej. Familia, Amigos, Trabajo..."
                      placeholderTextColor={colors.textMuted}
                      value={nombreGrupo}
                      onChangeText={setNombreGrupo}
                    />
                    <TouchableOpacity onPress={elegirFotoGrupo} style={{ marginTop: 6 }}>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>
                        Cambiar foto desde Galería
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Categorías vectoriales limpias */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, marginTop: 12 }}
                >
                  {CATEGORIAS_GRUPO.map((cat) => {
                    const activo = iconoGrupo === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setIconoGrupo(cat.id)}
                        style={[
                          styles.catPillBtn,
                          {
                            backgroundColor: activo ? cat.color + '25' : colors.inputBg,
                            borderColor: activo ? cat.color : colors.border,
                          },
                        ]}
                      >
                        <Ionicons name={cat.icon} size={15} color={cat.color} />
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '800' }}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* CHIPS HORIZONTALES DE PARTICIPANTES SELECCIONADOS (COMO WHATSAPP / TELEGRAM) */}
              {miembrosSeleccionados.length > 0 && (
                <View
                  style={[
                    styles.selectedChipsCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {miembrosSeleccionados.map((phone) => {
                      const cObj =
                        contactosUnificados.find((x) => x.phone === phone) || {
                          name: phone,
                          phone,
                        };
                      return (
                        <TouchableOpacity
                          key={phone}
                          onPress={() => toggleMiembroGrupo(phone)}
                          style={[styles.memberChip, { backgroundColor: colors.inputBg }]}
                        >
                          {renderAvatar(cObj.avatar, false, 28, cObj.name)}
                          <Text
                            style={{ color: colors.text, fontSize: 12, fontWeight: '800', maxWidth: 100 }}
                            numberOfLines={1}
                          >
                            {cObj.name}
                          </Text>
                          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* BUSCADOR DE PARTICIPANTES Y BOTÓN SELECCIONAR TODOS */}
              <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 0 }]}>
                    AÑADIR PARTICIPANTES ({miembrosSeleccionados.length} seleccionados)
                  </Text>
                  {contactosGrupoFiltrados.length > 0 && (
                    <TouchableOpacity onPress={() => toggleSeleccionarTodosGrupo(contactosGrupoFiltrados)}>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '900' }}>
                        {contactosGrupoFiltrados.every((u) => miembrosSeleccionados.includes(u.phone))
                          ? 'Desmarcar todos'
                          : 'Seleccionar todos'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View
                  style={[
                    styles.searchBar,
                    { backgroundColor: colors.inputBg, marginTop: 8, marginBottom: 10 },
                  ]}
                >
                  <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Buscar en tus contactos por nombre o teléfono..."
                    placeholderTextColor={colors.textMuted}
                    value={busquedaMiembroGrupo}
                    onChangeText={setBusquedaMiembroGrupo}
                  />
                </View>

                {/* Botón rápido para añadir a alguien nuevo sin escribir números separados por comas */}
                <TouchableOpacity
                  onPress={() => {
                    setVolverAGrupoTrasContacto(true);
                    setVistaModal('nuevo_contacto');
                  }}
                  style={[
                    styles.addContactShortcutRow,
                    { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.smallCircleIcon, { backgroundColor: colors.primary }]}>
                    <Ionicons name="person-add" size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>
                      ¿No está en tu lista? Añadir nuevo contacto
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      Busca con selector de país y se añadirá automáticamente al grupo
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </TouchableOpacity>

                {/* LISTA DE CONTACTOS CON CHECKBOX DE UN TOQUE */}
                {contactosGrupoFiltrados.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
                      No se encontraron contactos con ese filtro. Usa el botón de arriba para añadir un nuevo contacto.
                    </Text>
                  </View>
                ) : (
                  contactosGrupoFiltrados.map((u) => {
                    const marcado = miembrosSeleccionados.includes(u.phone);
                    const estadoCon = formatearEstadoConexion(u.phone, usersPresence);
                    return (
                      <TouchableOpacity
                        key={u.id || u.phone}
                        onPress={() => toggleMiembroGrupo(u.phone)}
                        style={[
                          styles.memberSelectRow,
                          { borderColor: colors.border },
                          marcado && { backgroundColor: 'rgba(0,168,132,0.12)' },
                        ]}
                      >
                        {renderAvatar(u.avatar, false, 44, u.name, estadoCon.isOnline)}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                            {u.name}
                          </Text>
                          <Text
                            style={{
                              color: estadoCon.isOnline ? '#10B981' : colors.textMuted,
                              fontSize: 11,
                              fontWeight: estadoCon.isOnline ? '700' : '500',
                            }}
                          >
                            {estadoCon.shortText} • {u.phone}
                          </Text>
                        </View>
                        <Ionicons
                          name={marcado ? 'checkmark-circle' : 'ellipse-outline'}
                          size={25}
                          color={marcado ? colors.primary : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}

                <TouchableOpacity
                  onPress={handleCrearGrupoFinal}
                  style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 18 }]}
                >
                  <Text style={styles.submitBtnText}>
                    Crear Grupo "{nombreGrupo.trim() || 'Nuevo'}" ({miembrosSeleccionados.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* MODAL BUSCADOR DE TODOS LOS PAÍSES DEL MUNDO (ESTILO WHATSAPP & TELEGRAM) */}
      <Modal
        visible={modalPaises}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalPaises(false)}
      >
        <View style={[styles.fullScreenModal, { backgroundColor: colors.bg }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.headerBg }]}>
            <TouchableOpacity onPress={() => setModalPaises(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalHeaderTitle}>Selecciona un país</Text>
              <Text style={styles.modalHeaderSub}>
                {PAISES_GLOBALES.length} países e indicativos internacionales
              </Text>
            </View>
          </View>

          <View style={{ padding: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={[styles.searchBar, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Buscar país o código (ej. Colombia, México, +52, +1...)"
                placeholderTextColor={colors.textMuted}
                value={busquedaPais}
                onChangeText={setBusquedaPais}
                autoFocus
              />
            </View>
          </View>

          <FlatList
            data={paisesFiltrados}
            keyExtractor={(item, idx) => `${item.name}_${item.code}_${idx}`}
            renderItem={({ item }) => {
              const activo =
                paisSeleccionado.name === item.name && paisSeleccionado.code === item.code;
              return (
                <TouchableOpacity
                  onPress={() => {
                    setPaisSeleccionado(item);
                    setModalPaises(false);
                  }}
                  style={[
                    styles.countryListRow,
                    { borderColor: colors.border },
                    activo && { backgroundColor: 'rgba(16,185,129,0.12)' },
                  ]}
                >
                  <Text style={{ fontSize: 26 }}>{item.flag}</Text>
                  <Text style={[styles.countryListName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.countryListCode, { color: colors.primary }]}>{item.code}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchSection: {
    padding: 10,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13 },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  filterPill: {
    backgroundColor: '#202c33',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  filterPillActive: { backgroundColor: '#00a884' },
  filterText: { color: '#8696a0', fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF', fontWeight: '800' },
  newTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00a884',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  newTopBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  timeText: { fontSize: 11 },
  previewText: { fontSize: 13, flex: 1, marginRight: 8 },
  badge: {
    backgroundColor: '#00a884',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 22,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#00a884',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fullScreenModal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  modalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  modalHeaderSub: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  menuBox: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  greenCircleIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 74,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  chatPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  formCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  inputRowIcon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  countrySelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  countrySelectorName: {
    fontSize: 15,
    fontWeight: '800',
  },
  codePrefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 6,
  },
  liveMatchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'rgba(16,185,129,0.1)',
    marginTop: 16,
    gap: 12,
  },
  submitBtn: {
    marginTop: 22,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  groupAvatarPicker: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  camCorner: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  selectedChipsCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  addContactShortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  smallCircleIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderRadius: 10,
    gap: 12,
  },
  countryListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  countryListName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  countryListCode: {
    fontSize: 15,
    fontWeight: '900',
  },
});
