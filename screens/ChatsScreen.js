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

const ICONOS_GRUPO = ['👥', '🚀', '🔥', '🏆', '💎', '🎮', '⚽', '🎵'];

export default function ChatsScreen({
  chats = [],
  userProfile,
  onSelectChat,
  onCreateDirectChat,
  onCreateGroupChat,
}) {
  const { colors } = useTheme();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('all'); // 'all' | 'unread' | 'groups'

  // Menú estilo WhatsApp / Telegram: null | 'menu' | 'nuevo_contacto' | 'nuevo_grupo'
  const [vistaModal, setVistaModal] = useState(null);

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

  // Estado para Crear Nuevo Grupo
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [iconoGrupo, setIconoGrupo] = useState('👥');
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState([]);
  const [numeroExtraGrupo, setNumeroExtraGrupo] = useState('');

  const listaSegura = Array.isArray(chats) ? chats : [];

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
        setUsuariosNexChat(data.filter((u) => u.phone !== userProfile?.phone));
      }
    } catch {}
    setCargandoUsuarios(false);
  }

  // 1. Guardar Nuevo Contacto e Iniciar Chat (Estilo WhatsApp y Telegram)
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

    // Bloquear si la persona NO tiene cuenta registrada en NexChat
    if (!peerData) {
      Alert.alert(
        '⚠️ No tiene cuenta en NexChat',
        `El número ${numeroCompleto} no está registrado en NexChat Global.\n\nNo se le puede escribir hasta que descargue la aplicación y cree su cuenta.`
      );
      return;
    }

    const nombreCompuesto = [nombreAmigo.trim(), apellidoAmigo.trim()].filter(Boolean).join(' ');
    const nombreFinal = nombreCompuesto || peerData.name || numeroCompleto;
    onCreateDirectChat(peerData.phone, nombreFinal, peerData);

    setTelefonoAmigo('');
    setNombreAmigo('');
    setApellidoAmigo('');
    setUsuarioEncontradoLive(null);
    setVerificacionTerminada(false);
    setVistaModal(null);
  }

  // 2. Seleccionar / Deseleccionar miembro para un grupo
  function toggleMiembroGrupo(phone) {
    setMiembrosSeleccionados((prev) =>
      prev.includes(phone) ? prev.filter((p) => p !== phone) : [...prev, phone]
    );
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
    const extras = numeroExtraGrupo
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const todos = Array.from(new Set([...miembrosSeleccionados, ...extras]));

    onCreateGroupChat(nombreGrupo.trim(), todos, iconoGrupo);
    setNombreGrupo('');
    setMiembrosSeleccionados([]);
    setNumeroExtraGrupo('');
    setVistaModal(null);
  }

  const renderAvatar = (avatarStr, isOfficial = false, size = 50) => {
    const esImg =
      avatarStr && (avatarStr.startsWith('http') || avatarStr.startsWith('data:image'));
    if (esImg) {
      return (
        <Image
          source={{ uri: avatarStr }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#202c33' }}
        />
      );
    }
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isOfficial ? '#00a884' : '#0284c7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: size * 0.44 }}>{avatarStr || '👤'}</Text>
      </View>
    );
  };

  const paisesFiltrados = PAISES_GLOBALES.filter((p) => {
    if (!busquedaPais.trim()) return true;
    const q = busquedaPais.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.includes(q);
  });

  const directorioFiltrado = usuariosNexChat.filter((u) => {
    if (!busquedaDirectorio.trim()) return true;
    const q = busquedaDirectorio.toLowerCase();
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
              { id: 'all', label: 'Todos' },
              { id: 'unread', label: 'No leídos' },
              { id: 'groups', label: 'Grupos' },
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterPill, filtro === f.id && styles.filterPillActive]}
                onPress={() => setFiltro(f.id)}
              >
                <Text style={[styles.filterText, filtro === f.id && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.newTopBtn}
            onPress={() => setVistaModal('menu')}
          >
            <Text style={styles.newTopBtnText}>+ Añadir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Conversaciones */}
      <FlatList
        data={chatsFiltrados}
        keyExtractor={(item, idx) => item.id || String(idx)}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          const msgs = Array.isArray(item.messages) ? item.messages : [];
          const ultimo = msgs[msgs.length - 1];
          let vistaPrevia = item.status || '🔒 Cifrado de extremo a extremo';
          if (ultimo) {
            vistaPrevia = ultimo.text || ultimo.content || vistaPrevia;
          }

          return (
            <TouchableOpacity
              style={[styles.chatRow, { borderColor: colors.border }]}
              onPress={() => onSelectChat && onSelectChat(item)}
            >
              {renderAvatar(item.avatar, item.official, 52)}

              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 }}>
                    <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.official && <Text style={{ fontSize: 13 }}>✅</Text>}
                  </View>
                  <Text
                    style={[
                      styles.timeText,
                      { color: item.unread > 0 ? '#00a884' : colors.textMuted },
                      item.unread > 0 && { fontWeight: '800' },
                    ]}
                  >
                    {ultimo ? ultimo.time : item.lastTime || 'Ahora'}
                  </Text>
                </View>

                <View style={[styles.rowBetween, { marginTop: 4 }]}>
                  <Text style={[styles.previewText, { color: colors.textMuted }]} numberOfLines={1}>
                    {vistaPrevia}
                  </Text>
                  {item.unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Botón Flotante estilo WhatsApp */}
      <TouchableOpacity style={styles.fab} onPress={() => setVistaModal('menu')}>
        <Ionicons name="person-add" size={24} color="#111b21" />
      </TouchableOpacity>

      {/* PANTALLA COMPLETA ESTILO WHATSAPP & TELEGRAM: CONTACTOS, AGREGAR PERSONA Y CREAR GRUPO */}
      <Modal
        visible={!!vistaModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setVistaModal(null)}
      >
        <View style={[styles.fullScreenModal, { backgroundColor: colors.bg }]}>
          {/* HEADER DEL MODAL */}
          <View style={[styles.modalHeader, { backgroundColor: colors.headerBg }]}>
            <TouchableOpacity
              onPress={() => {
                if (vistaModal === 'menu') setVistaModal(null);
                else setVistaModal('menu');
              }}
              style={styles.backBtn}
            >
              <Text style={styles.backIcon}>←</Text>
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
                  ? `${usuariosNexChat.length} contactos en NexChat • Global`
                  : vistaModal === 'nuevo_contacto'
                  ? 'Todos los países disponibles (WhatsApp / Telegram)'
                  : 'Añade foto y participantes al grupo'}
              </Text>
            </View>
          </View>

          {/* VISTA 1: MENÚ PRINCIPAL ESTILO WHATSAPP & TELEGRAM */}
          {vistaModal === 'menu' && (
            <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
              {/* Buscador Global estilo Telegram */}
              <View style={[styles.searchBar, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 14 }]}>
                <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Buscar persona por nombre o número (+57, +34, +1...)"
                  placeholderTextColor={colors.textMuted}
                  value={busquedaDirectorio}
                  onChangeText={setBusquedaDirectorio}
                />
              </View>

              {/* Acciones Principales estilo WhatsApp */}
              <View style={[styles.menuBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => setVistaModal('nuevo_contacto')}
                  style={styles.actionRow}
                >
                  <View style={[styles.greenCircleIcon, { backgroundColor: colors.primary }]}>
                    <Ionicons name="person-add" size={20} color="#052e16" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Nuevo contacto</Text>
                    <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                      Añadir persona con selector de todos los países del mundo
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <TouchableOpacity
                  onPress={() => setVistaModal('nuevo_grupo')}
                  style={styles.actionRow}
                >
                  <View style={[styles.greenCircleIcon, { backgroundColor: colors.primary }]}>
                    <Ionicons name="people" size={22} color="#052e16" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Nuevo grupo</Text>
                    <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                      Crear sala grupal con amigos, foto de galería e íconos
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Lista de Contactos ya registrados en NexChat */}
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                CONTACTOS EN NEXCHAT ({directorioFiltrado.length})
              </Text>

              {cargandoUsuarios ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
              ) : directorioFiltrado.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>🌍</Text>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>
                    Añade un contacto de cualquier país
                  </Text>
                  <Text style={[styles.actionSub, { color: colors.textMuted, textAlign: 'center', marginTop: 4 }]}>
                    Toca "Nuevo contacto" arriba para elegir el país e ingresar el número de tu amigo.
                  </Text>
                </View>
              ) : (
                directorioFiltrado.map((u) => (
                  <TouchableOpacity
                    key={u.id || u.phone}
                    onPress={() => {
                      onCreateDirectChat(u.phone, u.name, u);
                      setVistaModal(null);
                    }}
                    style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    {renderAvatar(u.avatar, false, 48)}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actionTitle, { color: colors.text }]}>{u.name}</Text>
                      <Text style={[styles.actionSub, { color: colors.textMuted }]} numberOfLines={1}>
                        {u.bio || '🔒 Disponible en NexChat'}
                      </Text>
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                        📱 {u.phone}
                      </Text>
                    </View>
                    <View style={[styles.chatPill, { backgroundColor: 'rgba(16,185,129,0.16)' }]}>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '900' }}>Chatear</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {/* VISTA 2: NUEVO CONTACTO (ESTILO WHATSAPP & TELEGRAM CON TODOS LOS PAÍSES) */}
          {vistaModal === 'nuevo_contacto' && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
              <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Fila Nombre y Apellido como en WhatsApp / Telegram */}
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
                        Cambiar país ▼
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

                {/* Tarjeta en vivo si el número ya está en NexChat o aviso si NO tiene cuenta */}
                {usuarioEncontradoLive ? (
                  <View style={[styles.liveMatchBox, { borderColor: colors.primary }]}>
                    {renderAvatar(usuarioEncontradoLive.avatar, false, 44)}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '900' }}>
                        ✅ Esta persona tiene cuenta en NexChat
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
                    <Text style={{ fontSize: 26 }}>🚫</Text>
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
                      ? '🚫 Sin cuenta en NexChat (No se puede escribir)'
                      : '💬 Guardar Contacto y Chatear'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* VISTA 3: CREAR NUEVO GRUPO CON FOTO Y PARTICIPANTES */}
          {vistaModal === 'nuevo_grupo' && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
              <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <TouchableOpacity onPress={elegirFotoGrupo} style={[styles.groupAvatarPicker, { borderColor: colors.primary }]}>
                    {renderAvatar(iconoGrupo, false, 76)}
                    <View style={[styles.camCorner, { backgroundColor: colors.primary }]}>
                      <Text style={{ fontSize: 12 }}>📷</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={elegirFotoGrupo}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', marginTop: 6 }}>
                      📷 Subir foto del grupo desde Galería
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.groupIconsRow}>
                    {ICONOS_GRUPO.map((ic) => (
                      <TouchableOpacity
                        key={ic}
                        onPress={() => setIconoGrupo(ic)}
                        style={[
                          styles.groupIconChip,
                          iconoGrupo === ic && { borderColor: colors.primary, borderWidth: 2 },
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>{ic}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>NOMBRE DEL GRUPO</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="Ej. Familia, Amigos del Fútbol, Trabajo..."
                  placeholderTextColor={colors.textMuted}
                  value={nombreGrupo}
                  onChangeText={setNombreGrupo}
                />

                <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 14 }]}>
                  AGREGAR NÚMEROS ADICIONALES (OPCIONAL)
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="+57 310..., +34 600..."
                  placeholderTextColor={colors.textMuted}
                  value={numeroExtraGrupo}
                  onChangeText={setNumeroExtraGrupo}
                />

                <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 16 }]}>
                  SELECCIONAR MIEMBROS DE NEXCHAT ({miembrosSeleccionados.length} seleccionados)
                </Text>

                {usuariosNexChat.map((u) => {
                  const marcado = miembrosSeleccionados.includes(u.phone);
                  return (
                    <TouchableOpacity
                      key={u.id || u.phone}
                      onPress={() => toggleMiembroGrupo(u.phone)}
                      style={[
                        styles.memberSelectRow,
                        { borderColor: colors.border },
                        marcado && { backgroundColor: 'rgba(16,185,129,0.12)' },
                      ]}
                    >
                      {renderAvatar(u.avatar, false, 40)}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>{u.name}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{u.phone}</Text>
                      </View>
                      <Ionicons
                        name={marcado ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={marcado ? colors.primary : colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={handleCrearGrupoFinal}
                  style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.submitBtnText}>
                    ✅ Crear Grupo "{nombreGrupo || 'Nuevo'}"
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
              <Text style={styles.backIcon}>←</Text>
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
                placeholder="Buscar país o código (ej. Colombia, España, +52, +1...)"
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
  filterTextActive: { color: '#111b21', fontWeight: '800' },
  newTopBtn: {
    backgroundColor: '#00a884',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  newTopBtnText: { color: '#111b21', fontSize: 12, fontWeight: '900' },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { fontSize: 15, fontWeight: '800', paddingRight: 4 },
  timeText: { fontSize: 11 },
  previewText: { fontSize: 12, flex: 1, paddingRight: 8 },
  badge: {
    backgroundColor: '#00a884',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#111b21', fontSize: 10, fontWeight: '800' },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#00a884',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fullScreenModal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 16,
    paddingBottom: 14,
    gap: 10,
    elevation: 4,
  },
  backBtn: { padding: 6 },
  backIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  modalHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  modalHeaderSub: { color: '#A7F3D0', fontSize: 12, marginTop: 1 },
  menuBox: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  greenCircleIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { fontSize: 15, fontWeight: '800' },
  actionSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '700' },
  divider: { height: 1 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  chatPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  inputRowIcon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  fieldLabel: { fontSize: 11, fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  countrySelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  countrySelectorName: { fontSize: 15, fontWeight: '800' },
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
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  submitBtn: {
    marginTop: 22,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: '#052e16', fontSize: 15, fontWeight: '900' },
  groupAvatarPicker: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2.5,
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
  groupIconsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  groupIconChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderRadius: 12,
    gap: 10,
    marginTop: 4,
  },
  countryListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    gap: 14,
  },
  countryListName: { flex: 1, fontSize: 15, fontWeight: '700' },
  countryListCode: { fontSize: 15, fontWeight: '900' },
});
