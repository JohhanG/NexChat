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
import { getDirectChatId } from '../lib/seguridad';

export default function ChatsScreen({ user, chats, setChats, messagesByChat, onOpenChat, saveChatsToDisk }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('all'); // 'all' | 'unread' | 'groups'
  const [modalVisible, setModalVisible] = useState(false);
  const [nombreContacto, setNombreContacto] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('+57 ');
  const [esGrupo, setEsGrupo] = useState(false);

  const chatsFiltrados = chats.filter((c) => {
    if (filtro === 'unread' && (!c.unread || c.unread <= 0)) return false;
    if (filtro === 'groups' && !c.isGroup) return false;
    if (busqueda.trim() !== '') {
      const q = busqueda.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
    }
    return true;
  });

  async function agregarContactoOGrupo() {
    if (!nombreContacto.trim()) {
      Alert.alert('Falta el nombre', 'Escribe el nombre de tu amigo o del grupo.');
      return;
    }

    const telLimpio = telefonoContacto.trim() || 'Sin número';
    const chatId = esGrupo
      ? 'group_' + nombreContacto.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
      : getDirectChatId(user.phone, telLimpio);

    let fotoAmigo = `https://api.dicebear.com/7.x/${esGrupo ? 'shapes' : 'avataaars'}/png?seed=${encodeURIComponent(
      nombreContacto.trim()
    )}`;

    if (!esGrupo) {
      try {
        const { data: usuarioRemoto } = await supabase
          .from('nexchat_users')
          .select('avatar')
          .eq('phone', telLimpio)
          .maybeSingle();
        if (usuarioRemoto?.avatar) fotoAmigo = usuarioRemoto.avatar;
      } catch {}
    }

    const nuevoChat = {
      id: chatId,
      name: nombreContacto.trim(),
      phone: esGrupo ? 'Grupo Global' : telLimpio,
      isGroup: esGrupo,
      avatar: fotoAmigo,
      status: esGrupo ? 'Grupo Global • 🔒 E2EE' : `${telLimpio} • 🔒 Conectado en Supabase`,
      unread: 0,
      lastTime: 'Ahora',
    };

    const actualizados = [nuevoChat, ...chats.filter((c) => c.id !== chatId)];
    setChats(actualizados);
    await saveChatsToDisk(actualizados);
    setModalVisible(false);
    setNombreContacto('');
    onOpenChat(nuevoChat);
  }

  return (
    <View style={styles.container}>
      {/* Barra de Búsqueda y Filtros */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#8696a0" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o número telefónico..."
            placeholderTextColor="#8696a0"
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>

        <View style={styles.filterRow}>
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
              <Text style={[styles.filterText, filtro === f.id && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Lista de Conversaciones */}
      <FlatList
        data={chatsFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const lista = messagesByChat[item.id] || [];
          const ultimo = lista[lista.length - 1];
          let vistaPrevia = item.status;
          if (ultimo) {
            if (ultimo.type === 'image') vistaPrevia = '📷 Foto';
            else if (ultimo.type === 'audio') vistaPrevia = '🎤 Nota de voz';
            else vistaPrevia = ultimo.content;
          }

          return (
            <TouchableOpacity
              style={styles.chatRow}
              onPress={() => {
                const actualizados = chats.map((c) => (c.id === item.id ? { ...c, unread: 0 } : c));
                setChats(actualizados);
                onOpenChat(item);
              }}
            >
              <Image
                source={{ uri: item.avatar || 'https://api.dicebear.com/7.x/shapes/png?seed=Nex' }}
                style={styles.avatar}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.timeText, item.unread > 0 && { color: '#00a884', fontWeight: '800' }]}>
                    {ultimo ? ultimo.time : item.lastTime}
                  </Text>
                </View>
                <View style={[styles.rowBetween, { marginTop: 3 }]}>
                  <Text style={styles.previewText} numberOfLines={1}>
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
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Agregar Amigo por Número o Grupo</Text>

            <Text style={styles.label}>Nombre de tu amigo o del Grupo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. María, Amigos Universidad..."
              placeholderTextColor="#8696a0"
              value={nombreContacto}
              onChangeText={setNombreContacto}
            />

            {!esGrupo && (
              <>
                <Text style={[styles.label, { marginTop: 12 }]}>Número de Celular (con indicativo)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+57 310 555 8899"
                  placeholderTextColor="#8696a0"
                  keyboardType="phone-pad"
                  value={telefonoContacto}
                  onChangeText={setTelefonoContacto}
                />
              </>
            )}

            <TouchableOpacity style={styles.checkRow} onPress={() => setEsGrupo(!esGrupo)}>
              <Ionicons name={esGrupo ? 'checkbox' : 'square-outline'} size={20} color="#00a884" />
              <Text style={styles.checkText}>Es un Grupo de mensajería (múltiples participantes)</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setModalVisible(false)}>
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={agregarContactoOGrupo}>
                <Text style={styles.primaryBtnText}>Guardar y Chatear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  searchSection: { padding: 10, backgroundColor: '#111b21', borderBottomWidth: 1, borderColor: '#222d34' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#202c33', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, color: '#e9edef', fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  filterPill: { backgroundColor: '#202c33', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  filterPillActive: { backgroundColor: '#00a884' },
  filterText: { color: '#8696a0', fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: '#111b21', fontWeight: '800' },
  chatRow: { flexDirection: 'row', alignItems: 'center', padding: 13, borderBottomWidth: 1, borderColor: '#222d34', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#202c33' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { color: '#e9edef', fontSize: 15, fontWeight: '700', flex: 1, paddingRight: 8 },
  timeText: { color: '#8696a0', fontSize: 11 },
  previewText: { color: '#8696a0', fontSize: 12, flex: 1, paddingRight: 8 },
  badge: { backgroundColor: '#00a884', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#111b21', fontSize: 10, fontWeight: '800' },
  fab: { position: 'absolute', right: 18, bottom: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: '#00a884', alignItems: 'center', justifyContent: 'center', elevation: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#202c33', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#2a3942' },
  modalTitle: { color: '#e9edef', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  label: { color: '#8696a0', fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: '#111b21', color: '#e9edef', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#2a3942', fontSize: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  checkText: { color: '#aebac1', fontSize: 12 },
  primaryBtn: { backgroundColor: '#00a884', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#111b21', fontWeight: '800', fontSize: 13 },
  secondaryBtn: { backgroundColor: '#2a3942', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  secondaryBtnText: { color: '#e9edef', fontWeight: '700', fontSize: 13 },
});
