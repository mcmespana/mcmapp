import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { Card, Button, PressableFeedback } from 'heroui-native';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import { LiturgicalBadge, getLiturgicalInfo } from '@/components/contigo/LiturgicalBadge';
import { ReadingCard } from '@/components/contigo/ReadingCard';
import ConfettiCannon from 'react-native-confetti-cannon';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha, getContrastColor } from '@/utils/colorUtils';
import spacing from '@/constants/spacing';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function formatDateDisplay(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return `${days[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

export default function EvangelioScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const router = useRouter();

  // Habit context
  const { todayStr, getRecord, setReadingDone } = useContigoHabits();
  
  // Date state
  const [selectedDate, setSelectedDate] = useState(todayStr || new Date().toISOString().split('T')[0]);
  const { readings, isLoading, error } = useDailyReadings(selectedDate);
  const [viewMode, setViewMode] = useState<'lectura' | 'comentario'>('lectura');
  const [showConfetti, setShowConfetti] = useState(false);

  const record = getRecord(selectedDate);
  const isDone = record?.readingDone || false;

  const liturgicalInfo = getLiturgicalInfo(selectedDate);
  const liturgicalColor = liturgicalInfo.hex;
  const isLightColor = liturgicalColor === '#F5F5F5';
  
  // Color decisions for the header
  const headerBgColor = isLightColor && isDark ? '#2C2C2C' : (isLightColor ? '#f8f9fa' : liturgicalColor);
  const headerTextColor = isLightColor && isDark ? '#FFFFFF' : (isLightColor ? '#1a1a1a' : '#FFFFFF');

  const goBack = () => router.back();

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToggleDone = async () => {
    const newValue = !isDone;
    await setReadingDone(selectedDate, newValue);
    if (newValue) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
    }
  };

  const openSource = () => {
    if (readings?.evangelio?.url) {
      Linking.openURL(readings.evangelio.url).catch(err => console.error("Couldn't open URL", err));
    }
  };

  const isToday = selectedDate === todayStr;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Hide native header which usually shows "(tabs)" */}
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        {/* ── Liturgical Header ── */}
        <View style={[styles.header, { backgroundColor: headerBgColor, borderBottomColor: hexAlpha(headerTextColor, '10') }]}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={26} color={headerTextColor} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: headerTextColor }]}>
              {isToday ? 'Evangelio de Hoy' : 'Evangelio del Día'}
            </Text>
          </View>

          <View style={{ width: 40 }} /> 
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* ── Date Navigator ── */}
          <View style={[styles.dateNavigatorContainer, { backgroundColor: headerBgColor, paddingBottom: 24, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, ...shadows.sm }]}>
            <View style={styles.dateNavigator}>
              <TouchableOpacity onPress={() => changeDate(-1)} style={[styles.dateNavBtn, { backgroundColor: hexAlpha(headerTextColor, '10') }]}>
                <MaterialIcons name="chevron-left" size={28} color={headerTextColor} />
              </TouchableOpacity>
              
              <View style={styles.dateDisplay}>
                <Text style={[styles.dateText, { color: headerTextColor }]}>
                  {formatDateDisplay(selectedDate)}
                </Text>
                <View style={styles.badgeContainer}>
                  <LiturgicalBadge dateStr={selectedDate} />
                </View>
                {readings?.info?.titulo && (
                  <Text style={[styles.tituloLiturgico, { color: hexAlpha(headerTextColor, '80') }]}>
                    {readings.info.titulo}
                  </Text>
                )}
              </View>
              
              <TouchableOpacity onPress={() => changeDate(1)} style={[styles.dateNavBtn, { backgroundColor: hexAlpha(headerTextColor, '10') }]}>
                <MaterialIcons name="chevron-right" size={28} color={headerTextColor} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Loading / Error ── */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.tint} />
              <Text style={[styles.loadingText, { color: theme.icon }]}>Preparando la Palabra...</Text>
            </View>
          ) : error || !readings?.evangelio ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={48} color={theme.icon} />
              <Text style={[styles.errorText, { color: theme.icon }]}>No se encontraron lecturas para este día.</Text>
              <Button variant="flat" color="primary" onPress={() => setSelectedDate(todayStr)} style={{ marginTop: 24 }}>
                <Button.Label>Volver a hoy</Button.Label>
              </Button>
            </View>
          ) : (
            <View style={styles.mainContent}>
              {/* ── Evangelio Card ── */}
              <Card 
                style={[
                  styles.evangelioCard, 
                  { 
                    backgroundColor: theme.card,
                    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                  }
                ]}
              >
                {/* Custom Segmented Control */}
                {readings.evangelio.comentario && (
                  <View style={[styles.segmentContainer, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)' }]}>
                    <PressableFeedback 
                      style={[styles.segmentButton, viewMode === 'lectura' && [styles.segmentActive, { backgroundColor: theme.card }]]}
                      onPress={() => setViewMode('lectura')}
                    >
                      <Text style={[styles.segmentText, viewMode === 'lectura' ? { color: theme.tint, fontWeight: '800' } : { color: theme.icon }]}>
                        📖 LECTURA
                      </Text>
                    </PressableFeedback>
                    <PressableFeedback 
                      style={[styles.segmentButton, viewMode === 'comentario' && [styles.segmentActive, { backgroundColor: theme.card }]]}
                      onPress={() => setViewMode('comentario')}
                    >
                      <Text style={[styles.segmentText, viewMode === 'comentario' ? { color: theme.tint, fontWeight: '800' } : { color: theme.icon }]}>
                        💡 COMENTARIO
                      </Text>
                    </PressableFeedback>
                  </View>
                )}

                <View style={styles.cardContent}>
                  {viewMode === 'lectura' && (
                    <View style={[styles.citaBadgeBig, { backgroundColor: hexAlpha(theme.tint, '10') }]}>
                      <Text style={[styles.citaTextBig, { color: theme.tint }]}>
                        {readings.evangelio.cita}
                      </Text>
                    </View>
                  )}

                  {viewMode === 'lectura' ? (
                    <Text style={[styles.bodyText, { color: theme.text }]}>
                      {readings.evangelio.texto}
                    </Text>
                  ) : (
                    <View>
                      <Text style={[styles.bodyText, { color: theme.text }]}>
                        {readings.evangelio.comentario}
                      </Text>
                      
                      {readings.evangelio.comentarista && (
                        <Text style={[styles.authorText, { color: theme.icon }]}>
                          — {readings.evangelio.comentarista}
                        </Text>
                      )}
                      
                      {readings.evangelio.url && (
                        <TouchableOpacity onPress={openSource} style={[styles.sourceLink, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                          <Text style={[styles.sourceText, { color: theme.tint }]}>Leer original completo</Text>
                          <MaterialIcons name="open-in-new" size={16} color={theme.tint} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </Card>

              {/* ── Tracker Joyful Button ── */}
              <View style={styles.trackerContainer}>
                {isDone ? (
                  <Button 
                    onPress={handleToggleDone}
                    style={[styles.doneButton, { backgroundColor: isDark ? '#1D3B16' : '#E6F4D7', borderColor: isDark ? '#2d4a22' : '#c3e6a1', borderWidth: 1 }]}
                  >
                    <View style={styles.doneContent}>
                      <MaterialIcons name="check-circle" size={28} color={isDark ? '#A3BD31' : '#2A5D19'} />
                      <Text style={[styles.doneText, { color: isDark ? '#A3BD31' : '#2A5D19' }]}>
                        ¡He rezado hoy con el Evangelio!
                      </Text>
                    </View>
                  </Button>
                ) : (
                  <Button 
                    variant="solid"
                    color="primary"
                    onPress={handleToggleDone}
                    style={styles.notDoneButton}
                  >
                    <View style={styles.doneContent}>
                      <MaterialIcons name="favorite" size={24} color="#FFF" />
                      <Text style={styles.notDoneText}>
                        Completar momento de oración
                      </Text>
                    </View>
                  </Button>
                )}
                <Text style={[styles.trackerNote, { color: theme.icon }]}>
                  Marcando este día sumas a tu constancia en la pestaña "Contigo".
                </Text>
              </View>

              {/* ── Other Readings ── */}
              <View style={styles.otherReadings}>
                <View style={styles.divider} />
                <Text style={[styles.otherReadingsTitle, { color: theme.text }]}>Otras lecturas de la misa</Text>
                
                {readings.lectura1 && (
                  <ReadingCard 
                    title="Primera Lectura" 
                    cita={readings.lectura1.cita} 
                    texto={readings.lectura1.texto} 
                  />
                )}
                
                {readings.salmo && (
                  <ReadingCard 
                    title="Salmo" 
                    cita={readings.salmo.cita} 
                    texto={readings.salmo.texto} 
                  />
                )}
                
                {readings.lectura2 && (
                  <ReadingCard 
                    title="Segunda Lectura" 
                    cita={readings.lectura2.cita} 
                    texto={readings.lectura2.texto} 
                  />
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {showConfetti && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ConfettiCannon count={120} origin={{ x: -10, y: 0 }} fallSpeed={2500} fadeOut />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    width: 44,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  mainContent: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  dateNavigatorContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 360,
  },
  dateNavBtn: {
    padding: 8,
    borderRadius: 20,
  },
  dateDisplay: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  dateText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  badgeContainer: {
    marginTop: 6,
  },
  tituloLiturgico: {
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  evangelioCard: {
    borderRadius: radii.2xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
    ...shadows.sm,
  },
  segmentContainer: {
    flexDirection: 'row',
    margin: 8,
    padding: 4,
    borderRadius: radii.xl,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radii.lg,
  },
  segmentActive: {
    ...shadows.sm,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 24,
    paddingTop: 16,
  },
  citaBadgeBig: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginBottom: 24,
  },
  citaTextBig: {
    fontSize: 15,
    fontWeight: '800',
  },
  bodyText: {
    fontSize: 19,
    lineHeight: 30,
    fontWeight: '400',
    textAlign: 'justify',
  },
  authorText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 24,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  sourceLink: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  trackerContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  doneButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: radii.xl,
  },
  notDoneButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: radii.xl,
  },
  doneContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
  },
  notDoneText: {
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
    color: '#FFF',
  },
  trackerNote: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.2)',
    marginBottom: 24,
    marginHorizontal: 16,
  },
  otherReadings: {
    marginBottom: 16,
  },
  otherReadingsTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 20,
    textAlign: 'center',
  },
});
