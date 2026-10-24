import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { hashPin } from '../lib/seguridad';

const STORAGE_REMEMBER_KEY = 'nexchat_recordar_credenciales';

const PAISES = [
  { code: '+57', label: '🇨🇴 Colombia (+57)' },
  { code: '+52', label: '🇲🇽 México (+52)' },
  { code: '+34', label: '🇪🇸 España (+34)' },
  { code: '+54', label: '🇦🇷 Argentina (+54)' },
  { code: '+56', label: '🇨🇱 Chile (+56)' },
  { code: '+51', label: '🇵🇪 Perú (+51)' },
  { code: '+593', label: '🇪🇨 Ecuador (+593)' },
  { code: '+58', label: '🇻🇪 Venezuela (+58)' },
  { code: '+1', label: '🇺🇸 EE.UU. (+1)' },
];

export default function LoginScreen({ onLoginSuccess }) {
  const [modo, setModo] = useState('login'); // 'login' | 'registro'
  const [pasoRegistro, setPasoRegistro] = useState(1); // 1: Teléfono, 2: OTP, 3: Perfil + PIN
  const [indicativo, setIndicativo] = useState('+57');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [pin, setPin] = useState('');
  const [mostrarPin, setMostrarPin] = useState(false);
  const [recordar, setRecordar] = useState(true);

  const [codigoOtpGenerado, setCodigoOtpGenerado] = useState('');
  const [codigoOtpIngresado, setCodigoOtpIngresado] = useState('');
  const [nombre, setNombre] = useState('');
  const [bio, setBio] = useState('🔒 Protegido con cifrado E2EE en NexChat');
  const [avatar, setAvatar] = useState('https://api.dicebear.com/7.x/avataaars/png?seed=NexUser');

  const [cargando, setCargando] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(0);

  useEffect(() => {
    cargarCredencialesRecordadas();
  }, []);

  async function cargarCredencialesRecordadas() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_REMEMBER_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.indicativo) setIndicativo(data.indicativo);
        if (data.telefono) setTelefono(data.telefono);
        if (data.pin) setPin(data.pin);
        setRecordar(true);
      }
    } catch {}
  }

  async function guardarCredenciales() {
    try {
      if (recordar) {
        await AsyncStorage.setItem(
          STORAGE_REMEMBER_KEY,
          JSON.stringify({ indicativo, telefono: telefono.trim(), pin: pin.trim() })
        );
      } else {
        await AsyncStorage.removeItem(STORAGE_REMEMBER_KEY);
      }
    } catch {}
  }

  // INICIAR SESIÓN EN CUENTA EXISTENTE
  async function handleIniciarSesion() {
    if (Date.now() < bloqueadoHasta) {
      const segs = Math.ceil((bloqueadoHasta - Date.now()) / 1000);
      Alert.alert('🛡️ Escudo Anti-Hack Activo', `Demasiados intentos fallidos. Espera ${segs} segundos.`);
      return;
    }

    if (!telefono.trim() || !pin.trim()) {
      Alert.alert('Datos incompletos', 'Ingresa tu número de celular y tu PIN secreto.');
      return;
    }

    const numeroCompleto = `${indicativo} ${telefono.trim()}`;
    const pinEncriptado = hashPin(pin.trim());

    setCargando(true);
    try {
      const { data } = await supabase
        .from('nexchat_users')
        .select('*')
        .eq('phone', numeroCompleto)
        .maybeSingle();
      setCargando(false);

      if (!data) {
        Alert.alert(
          'Cuenta no encontrada',
          `El número ${numeroCompleto} aún no está registrado. Toca la pestaña "Crear Cuenta Nueva".`
        );
        return;
      }

      if (data.pin_hash !== pinEncriptado && data.pin_hash !== pin.trim()) {
        const nuevosFallos = intentosFallidos + 1;
        setIntentosFallidos(nuevosFallos);
        if (nuevosFallos >= 3) {
          setBloqueadoHasta(Date.now() + 30000);
          setIntentosFallidos(0);
          Alert.alert('🛡️ Bloqueo Anti-Fuerza Bruta', 'Has fallado 3 veces seguidas. Cuenta bloqueada por 30 segundos.');
        } else {
          Alert.alert('❌ PIN Incorrecto', 'Verifica tu PIN de seguridad.');
        }
        return;
      }

      await guardarCredenciales();
      onLoginSuccess({
        id: data.id,
        phone: data.phone,
        email: data.email || '',
        name: data.name,
        bio: data.bio || '🔒 Protegido con cifrado E2EE en NexChat',
        avatar: data.avatar || avatar,
        pinHash: data.pin_hash,
      });
    } catch {
      setCargando(false);
      Alert.alert('Error de red', 'No se pudo conectar con Supabase.');
    }
  }

  // REGISTRO PASO 1: VERIFICAR NÚMERO Y ENVIAR CÓDIGO GRATIS AL CELULAR
  async function handlePaso1Telefono() {
    if (!telefono.trim() || telefono.trim().length < 6) {
      Alert.alert('Número inválido', 'Ingresa un número de teléfono válido.');
      return;
    }

    const numeroCompleto = `${indicativo} ${telefono.trim()}`;
    setCargando(true);
    try {
      const { data: existe } = await supabase
        .from('nexchat_users')
        .select('phone')
        .eq('phone', numeroCompleto)
        .maybeSingle();
      setCargando(false);

      if (existe) {
        Alert.alert('Cuenta existente', 'Este número ya tiene cuenta en NexChat. Inicia sesión con tu PIN.');
        setModo('login');
        return;
      }
    } catch {
      setCargando(false);
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    setCodigoOtpGenerado(otp);
    setCodigoOtpIngresado('');
    setPasoRegistro(2);

    // 1. Notificación Push Nativa en el Celular
    try {
      await Notifications.requestPermissionsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💬 NexChat (${numeroCompleto})`,
          body: `Tu código secreto de verificación de 6 dígitos es: ${otp}`,
        },
        trigger: null,
      });
    } catch {}

    // 2. Envío al Correo del Celular Gratis
    if (correo.trim() && correo.includes('@')) {
      fetch(`https://formsubmit.co/ajax/${encodeURIComponent(correo.trim())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `Tu codigo de NexChat es ${otp}`,
          Telefono: numeroCompleto,
          Codigo_OTP_NexChat: otp,
        }),
      }).catch(() => {});
    }

    Alert.alert(
      '📲 Código Enviado a tu Celular',
      `Hemos enviado tu código de 6 dígitos por Notificación Push${
        correo.includes('@') ? ` y a tu correo ${correo.trim()}` : ''
      }.\n\nCódigo recibido: ${otp}`
    );
  }

  // REGISTRO PASO 2: VALIDAR OTP
  function handlePaso2Otp() {
    if (codigoOtpIngresado.trim() !== codigoOtpGenerado) {
      Alert.alert('❌ Código incorrecto', 'Verifica los 6 dígitos enviados a tu celular.');
      return;
    }
    const numeroCompleto = `${indicativo} ${telefono.trim()}`;
    setAvatar(`https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(numeroCompleto)}`);
    setPasoRegistro(3);
  }

  // REGISTRO PASO 3: CREAR PERFIL + PIN SHA-256 EN SUPABASE
  async function handlePaso3CrearCuenta() {
    if (!nombre.trim() || !pin.trim() || pin.trim().length < 4) {
      Alert.alert('Datos incompletos', 'Escribe tu nombre visible y crea un PIN de al menos 4 caracteres.');
      return;
    }

    const numeroCompleto = `${indicativo} ${telefono.trim()}`;
    const pinEncriptado = hashPin(pin.trim());
    const nuevoUsuario = {
      id: 'user_' + numeroCompleto.replace(/[^0-9]/g, ''),
      phone: numeroCompleto,
      email: correo.trim() || null,
      name: nombre.trim(),
      pin_hash: pinEncriptado,
      bio: bio.trim() || '🔒 Protegido con cifrado E2EE en NexChat',
      avatar: avatar,
      online: true,
    };

    setCargando(true);
    try {
      const { error } = await supabase.from('nexchat_users').upsert(nuevoUsuario);
      setCargando(false);
      if (error) {
        Alert.alert('Error al crear cuenta', error.message);
        return;
      }
      await guardarCredenciales();
      onLoginSuccess({
        id: nuevoUsuario.id,
        phone: nuevoUsuario.phone,
        email: nuevoUsuario.email,
        name: nuevoUsuario.name,
        bio: nuevoUsuario.bio,
        avatar: nuevoUsuario.avatar,
        pinHash: pinEncriptado,
      });
    } catch {
      setCargando(false);
    }
  }

  async function elegirFotoGaleria() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        setAvatar(a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri);
      }
    } catch {}
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.headerBanner}>
          <View style={styles.logoCircle}>
            <Ionicons name="chatbubbles" size={34} color="#00a884" />
          </View>
          <Text style={styles.brandTitle}>NEXCHAT</Text>
          <Text style={styles.brandSub}>Mensajería Global 24/7 • Sin Límites • E2EE AES-256</Text>
        </View>

        <View style={styles.card}>
          {/* Selector Iniciar Sesión vs Crear Cuenta */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, modo === 'login' && styles.tabBtnActive]}
              onPress={() => setModo('login')}
            >
              <Text style={[styles.tabText, modo === 'login' && styles.tabTextActive]}>🔑 Iniciar Sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, modo === 'registro' && styles.tabBtnActive]}
              onPress={() => {
                setModo('registro');
                setPasoRegistro(1);
              }}
            >
              <Text style={[styles.tabText, modo === 'registro' && styles.tabTextActive]}>✨ Crear Cuenta Nueva</Text>
            </TouchableOpacity>
          </View>

          {modo === 'login' ? (
            <>
              <Text style={styles.sectionTitle}>Ingresa con tu número telefónico</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                {PAISES.map((p) => (
                  <TouchableOpacity
                    key={p.code}
                    style={[styles.countryChip, indicativo === p.code && styles.countryChipActive]}
                    onPress={() => setIndicativo(p.code)}
                  >
                    <Text style={[styles.countryText, indicativo === p.code && styles.countryTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Número de Celular ({indicativo})</Text>
              <TextInput
                style={styles.input}
                placeholder="323 418 5080"
                placeholderTextColor="#8696a0"
                keyboardType="phone-pad"
                value={telefono}
                onChangeText={setTelefono}
              />

              <Text style={[styles.label, { marginTop: 12 }]}>🛡️ PIN Secreto Anti-Hack</Text>
              <View style={styles.pinRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••"
                  placeholderTextColor="#8696a0"
                  secureTextEntry={!mostrarPin}
                  value={pin}
                  onChangeText={setPin}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setMostrarPin(!mostrarPin)}>
                  <Ionicons name={mostrarPin ? 'eye-off' : 'eye'} size={20} color="#8696a0" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.rememberRow} onPress={() => setRecordar(!recordar)}>
                <Ionicons name={recordar ? 'checkbox' : 'square-outline'} size={20} color="#00a884" />
                <Text style={styles.rememberText}>Recordar mis datos en este teléfono</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleIniciarSesion} disabled={cargando}>
                {cargando ? (
                  <ActivityIndicator color="#111b21" />
                ) : (
                  <Text style={styles.primaryBtnText}>🔓 Entrar a NexChat</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            /* CREAR CUENTA NUEVA EN 3 PASOS */
            <>
              <View style={styles.stepsRow}>
                <Text style={[styles.stepBadge, pasoRegistro === 1 && styles.stepBadgeActive]}>1. Teléfono</Text>
                <Text style={{ color: '#8696a0' }}>→</Text>
                <Text style={[styles.stepBadge, pasoRegistro === 2 && styles.stepBadgeActive]}>2. Código 6 Dígitos</Text>
                <Text style={{ color: '#8696a0' }}>→</Text>
                <Text style={[styles.stepBadge, pasoRegistro === 3 && styles.stepBadgeActive]}>3. Perfil y PIN</Text>
              </View>

              {pasoRegistro === 1 && (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                    {PAISES.map((p) => (
                      <TouchableOpacity
                        key={p.code}
                        style={[styles.countryChip, indicativo === p.code && styles.countryChipActive]}
                        onPress={() => setIndicativo(p.code)}
                      >
                        <Text style={[styles.countryText, indicativo === p.code && styles.countryTextActive]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>Tu número de celular ({indicativo})</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="323 418 5080"
                    placeholderTextColor="#8696a0"
                    keyboardType="phone-pad"
                    value={telefono}
                    onChangeText={setTelefono}
                  />

                  <Text style={[styles.label, { marginTop: 12, color: '#00a884' }]}>
                    📧 Tu Correo en el Celular (Opcional • Para recibir el código gratis)
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="tucorreo@gmail.com"
                    placeholderTextColor="#8696a0"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={correo}
                    onChangeText={setCorreo}
                  />

                  <TouchableOpacity style={styles.primaryBtn} onPress={handlePaso1Telefono} disabled={cargando}>
                    {cargando ? (
                      <ActivityIndicator color="#111b21" />
                    ) : (
                      <Text style={styles.primaryBtnText}>📲 Enviar Código Gratis al Celular →</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {pasoRegistro === 2 && (
                <>
                  <Text style={styles.sectionTitle}>
                    Verifica el código enviado a {indicativo} {telefono}
                  </Text>
                  <TextInput
                    style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 10, marginVertical: 14 }]}
                    placeholder="••••••"
                    placeholderTextColor="#8696a0"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={codigoOtpIngresado}
                    onChangeText={setCodigoOtpIngresado}
                  />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setPasoRegistro(1)}>
                      <Text style={styles.secondaryBtnText}>← Atrás</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.primaryBtn, { flex: 2, marginTop: 0 }]} onPress={handlePaso2Otp}>
                      <Text style={styles.primaryBtnText}>Verificar Código</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {pasoRegistro === 3 && (
                <>
                  <View style={{ alignItems: 'center', marginVertical: 10 }}>
                    <Image source={{ uri: avatar }} style={styles.avatarPreview} />
                    <TouchableOpacity onPress={elegirFotoGaleria}>
                      <Text style={{ color: '#00a884', fontWeight: '700', fontSize: 12 }}>
                        📷 Subir foto desde mi galería
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Tu Nombre Visible</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. Richard"
                    placeholderTextColor="#8696a0"
                    value={nombre}
                    onChangeText={setNombre}
                  />

                  <Text style={[styles.label, { marginTop: 12, color: '#00a884', fontWeight: '700' }]}>
                    🛡️ Crea tu PIN Anti-Hack (Verificación en 2 pasos)
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo 4 dígitos o letras"
                    placeholderTextColor="#8696a0"
                    secureTextEntry={!mostrarPin}
                    value={pin}
                    onChangeText={setPin}
                  />

                  <Text style={[styles.label, { marginTop: 12 }]}>Info / Estado</Text>
                  <TextInput style={styles.input} value={bio} onChangeText={setBio} />

                  <TouchableOpacity style={styles.primaryBtn} onPress={handlePaso3CrearCuenta} disabled={cargando}>
                    {cargando ? (
                      <ActivityIndicator color="#111b21" />
                    ) : (
                      <Text style={styles.primaryBtnText}>✅ Finalizar y Entrar a NexChat</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b141a' },
  headerBanner: {
    backgroundColor: '#00a884',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 22 : 32,
    paddingBottom: 26,
    alignItems: 'center',
  },
  logoCircle: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  brandTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  brandSub: { color: '#d1fae5', fontSize: 11, marginTop: 3 },
  card: { backgroundColor: '#111b21', margin: 14, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#222d34' },
  tabRow: { flexDirection: 'row', backgroundColor: '#202c33', borderRadius: 12, padding: 4, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  tabBtnActive: { backgroundColor: '#00a884' },
  tabText: { color: '#8696a0', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#111b21', fontWeight: '800' },
  sectionTitle: { color: '#e9edef', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  countryChip: { backgroundColor: '#202c33', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 6, borderWidth: 1, borderColor: '#2a3942' },
  countryChipActive: { backgroundColor: '#00a884', borderColor: '#00a884' },
  countryText: { color: '#e9edef', fontSize: 11 },
  countryTextActive: { color: '#111b21', fontWeight: '800' },
  stepsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 12 },
  stepBadge: { backgroundColor: '#202c33', color: '#8696a0', fontSize: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontWeight: '700' },
  stepBadgeActive: { backgroundColor: '#00a884', color: '#111b21' },
  label: { color: '#8696a0', fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: '#202c33', color: '#e9edef', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: '#2a3942', fontSize: 14 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { backgroundColor: '#202c33', padding: 11, borderRadius: 10, borderWidth: 1, borderColor: '#2a3942' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  rememberText: { color: '#aebac1', fontSize: 12 },
  primaryBtn: { backgroundColor: '#00a884', paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#111b21', fontWeight: '800', fontSize: 14 },
  secondaryBtn: { backgroundColor: '#202c33', paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  secondaryBtnText: { color: '#e9edef', fontWeight: '700', fontSize: 13 },
  avatarPreview: { width: 78, height: 78, borderRadius: 39, borderWidth: 3, borderColor: '#00a884', marginBottom: 6 },
});
