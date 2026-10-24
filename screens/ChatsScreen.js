import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeContext';

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
  const [modalVisible, setModalVisible] = useState(false);
  const [nombreContacto, setNombreContacto] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('+57 ');
  const [esGrupo, setEsGrupo] = useState(false);
  const [buscandoUsuario, setBuscandoUsuario] = useState(false);

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

  async function agregarContactoOGrupo() {
    if (esGrupo) {
      if (!nombreContacto.trim()) {
        Alert.alert('Falta el nombre', 'Escribe el nombre del grupo.');
        return;
      }
      const miembros = telefonoContacto
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      onCreateGroupChat(nombreContacto.trim(), miembros);
      setModalVisible(false);
      setNombreContacto('');
      return;
    }

    const telLimpio = telefonoContacto.trim();
    if (!telLimpio || telLimpio.length < 6) {
      Alert.alert('Número requerido', 'Escribe el número de celular de tu amigo con su indicativo (ej. +57 310...).');
      return;
    }

    setBuscandoUsuario(true);
    let peerData = null;
    try {
      const { data: usuarioRemoto } = await supabase
        .from('nexchat_users')
        .select('*')
        .eq('phone', telLimpio)
        .maybeSingle();
      if (usuarioRemoto) {
        peerData = usuarioRemoto;
      }
    } catch {}
    setBuscandoUsuario(false);

    onCreateDirectChat(
      telLimpio,
      nombreContacto.trim() || peerData?.name || telLimpio,
      peerData
    );
    setModalVisible(false);
    setNombreContacto('');
  }

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
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.newTopBtnText}>+ Nuevo Chat</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Conversaciones */}
      <FlatList
        data={chatsFiltrados}
        keyExtractor={(item, idx) => item.id || String(idx)}
        renderItem={({ item }) => {
          const msgs = Array.isArray(item.messages) ? item.messages : [];
          const ultimo = msgs[msgs.length - 1];
          let vistaPrevia = item.status || '🔒 Cifrado de extremo a extremo';
          if (ultimo) {
            vistaPrevia = ultimo.text || ultimo.content || vistaPrevia;
          }

          const esImagenRemota =
            item.avatar &&
            (item.avatar.startsWith('http') || item.avatar.startsWith('data:image'));

          return (
            <TouchableOpacity
              style={[styles.chatRow, { borderColor: colors.border }]}
              onPress={() => onSelectChat && onSelectChat(item)}
            >
              {esImagenRemota ? (
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
              ) : (
                <View
                  style={[
                    styles.avatarEmojiBox,
                    { backgroundColor: item.official ? '#00a884' : '#0284c7' },
                  ]}
                >
                  <Text style={{ fontSize: 22 }}>{item.avatar || '🛡️'}</Text>
                </View>
              )}

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

      {/* Botón Flotante estilo WhatsApp para Agregar Amigo o Grupo */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="person-add" size={24} color="#111b21" />
      </TouchableOpacity>

      {/* Modal Agregar Amigo por Número Telefónico */}
      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {esGrupo ? '👥 Crear Nuevo Grupo Global' : '💬 Chatear con un Amigo por Número'}
            </Text>

            <TouchableOpacity style={styles.checkRow} onPress={() => setEsGrupo(!esGrupo)}>
              <Ionicons name={esGrupo ? 'checkbox' : 'square-outline'} size={20} color="#00a884" />
              <Text style={styles.checkText}>Crear un Grupo (varios amigos)</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: 12 }]}>
              {esGrupo ? 'Nombre del Grupo' : 'Nombre de tu Amigo (opcional)'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={esGrupo ? 'Ej. Familia, Amigos...' : 'Ej. Carlos, María...'}
              placeholderTextColor="#8696a0"
              value={nombreContacto}
              onChangeText={setNombreContacto}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>
              {esGrupo
                ? 'Números de miembros separados por coma'
                : 'Número de Celular de tu Amigo (con indicativo)'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="+57 310 555 8899"
              placeholderTextColor="#8696a0"
              keyboardType="phone-pad"
              value={telefonoContacto}
              onChangeText={setTelefonoContacto}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { flex: 1 }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }]}
                onPress={agregarContactoOGrupo}
                disabled={buscandoUsuario}
              >
                <Text style={styles.primaryBtnText}>
                  {buscandoUsuario ? 'Buscando...' : 'Abrir Chat'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  newTopBtnText: { color: '#111b21', fontSize: 11, fontWeight: '900' },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#202c33' },
  avatarEmojiBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00a884',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#202c33',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a3942',
  },
  modalTitle: { color: '#e9edef', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  label: { color: '#8696a0', fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#111b21',
    color: '#e9edef',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2a3942',
    fontSize: 14,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  checkText: { color: '#aebac1', fontSize: 12, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: '#00a884',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#111b21', fontWeight: '800', fontSize: 13 },
  secondaryBtn: {
    backgroundColor: '#2a3942',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#e9edef', fontWeight: '700', fontSize: 13 },
});
