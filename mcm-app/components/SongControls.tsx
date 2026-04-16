import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { useToast, PressableFeedback } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DEFAULT_FONT_SIZE_EM } from '../contexts/SettingsContext';
import SongFontPanel from './SongFontPanel';
import TransposePanel from './TransposePanel';
import ReportBugsModal from './ReportBugsModal';
import SecretPanelModal from './SecretPanelModal';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FontOption {
  name: string;
  cssValue: string;
}

interface SongControlsProps {
  chordsVisible: boolean;
  currentTranspose: number;
  currentFontSizeEm: number;
  currentFontFamily: string;
  availableFonts: FontOption[];
  notation: 'EN' | 'ES';
  onToggleChords: () => void;
  onSetTranspose: (semitones: number) => void;
  onSetFontSize: (sizeEm: number) => void;
  onSetFontFamily: (fontFamily: string) => void;
  onToggleNotation: () => void;
  onNavigateToFullscreen: () => void;
  onCopyLyrics: () => void;
  songTitle?: string;
  songFilename?: string;
  songAuthor?: string;
  songKey?: string;
  songCapo?: number;
  songInfo?: string;
  songContent?: string;
  firebaseCategory?: string;
}

const SongControls: React.FC<SongControlsProps> = ({
  chordsVisible,
  currentTranspose,
  currentFontSizeEm,
  currentFontFamily,
  availableFonts,
  notation,
  onToggleChords,
  onSetTranspose,
  onSetFontSize,
  onSetFontFamily,
  onToggleNotation,
  onNavigateToFullscreen,
  onCopyLyrics,
  songTitle,
  songFilename,
  songAuthor,
  songKey,
  songCapo,
  songInfo,
  songContent,
  firebaseCategory,
}) => {
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [showTransposePanel, setShowTransposePanel] = useState(false);
  const [showFontPanel, setShowFontPanel] = useState(false);
  const [showReportBugsModal, setShowReportBugsModal] = useState(false);
  const [showSecretPanel, setShowSecretPanel] = useState(false);
  const scheme = useColorScheme();
  const { toast } = useToast();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const hasModifications =
    currentTranspose !== 0 ||
    !chordsVisible ||
    currentFontSizeEm !== DEFAULT_FONT_SIZE_EM ||
    (availableFonts.length > 0 &&
      currentFontFamily !== availableFonts[0].cssValue) ||
    notation !== 'ES';

  const toggleMenu = () => {
    const toOpen = !showActionButtons;
    setShowActionButtons(toOpen);
    Animated.spring(rotateAnim, {
      toValue: toOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const rotateInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  useEffect(() => {
    return () => {
      setShowActionButtons(false);
      setShowTransposePanel(false);
      setShowFontPanel(false);
      setShowReportBugsModal(false);
      setShowSecretPanel(false);
    };
  }, []);

  const handleOpenTransposePanel = () => setShowTransposePanel(true);
  const handleOpenFontPanel = () => setShowFontPanel(true);

  const handleReportSuccess = () => {
    toast.show({
      variant: 'success',
      label: '¡Gracias por tu reporte!',
      actionLabel: 'OK',
      onActionPress: ({ hide }) => hide(),
    });
  };

  const handleSecretPanelSuccess = () => {
    toast.show({
      variant: 'success',
      label: '¡Gracias por tu reporte!',
      actionLabel: 'OK',
      onActionPress: ({ hide }) => hide(),
    });
  };

  const handleSetTranspose = (semitones: number) => {
    onSetTranspose(semitones);
  };

  const ActionButton = ({
    icon,
    label,
    onPress,
    isActive = false,
  }: {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    onPress: () => void;
    isActive?: boolean;
  }) => (
    <PressableFeedback
      style={[
        styles.actionButton,
        isActive &&
          (isDark ? styles.actionButtonActiveDark : styles.actionButtonActive),
      ]}
      onPress={onPress}
    >
      <PressableFeedback.Highlight />
      <MaterialIcons
        name={icon}
        size={18}
        color={
          isActive
            ? isDark
              ? '#7AB3FF'
              : '#253883'
            : isDark
              ? '#AEAEB2'
              : '#636366'
        }
      />
      <Text
        style={[
          styles.actionButtonText,
          isDark && styles.actionButtonTextDark,
          isActive &&
            (isDark
              ? styles.actionButtonTextActiveDark
              : styles.actionButtonTextActive),
        ]}
      >
        {label}
      </Text>
    </PressableFeedback>
  );

  return (
    <>
      {/* Scrim when menu is open */}
      {showActionButtons && (
        <PressableFeedback style={styles.scrim} onPress={toggleMenu} />
      )}

      {/* FAB & Action Menu */}
      <View
        style={[
          styles.fabContainer,
          { bottom: isIOS ? insets.bottom + 60 : 24 },
        ]}
      >
        {showActionButtons && (
          <View
            style={[styles.menuContainer, isDark && styles.menuContainerDark]}
          >
            <ActionButton
              icon={chordsVisible ? 'music-note' : 'music-off'}
              label={`Acordes ${chordsVisible ? 'ON' : 'OFF'}`}
              onPress={onToggleChords}
              isActive={!chordsVisible}
            />
            <ActionButton
              icon="translate"
              label={`Notación: ${notation}`}
              onPress={onToggleNotation}
              isActive={notation !== 'ES'}
            />
            <ActionButton
              icon="swap-vert"
              label={
                currentTranspose !== 0
                  ? `Tono ${currentTranspose > 0 ? '+' : ''}${currentTranspose}`
                  : 'Cambiar tono'
              }
              onPress={handleOpenTransposePanel}
              isActive={currentTranspose !== 0}
            />
            <ActionButton
              icon="text-fields"
              label="Tipo de letra"
              onPress={handleOpenFontPanel}
              isActive={
                currentFontSizeEm !== DEFAULT_FONT_SIZE_EM ||
                (availableFonts.length > 0 &&
                  currentFontFamily !== availableFonts[0].cssValue)
              }
            />

            <View
              style={[styles.menuDivider, isDark && styles.menuDividerDark]}
            />

            <ActionButton
              icon="content-copy"
              label="Copiar letra"
              onPress={() => {
                onCopyLyrics();
                toast.show({ label: 'Letra copiada al portapapeles' });
              }}
            />
            <ActionButton
              icon="fullscreen"
              label="Pantalla completa"
              onPress={onNavigateToFullscreen}
            />
            <ActionButton
              icon="bug-report"
              label="Reportar error"
              onPress={() => setShowReportBugsModal(true)}
            />
          </View>
        )}
        <View style={{ position: 'relative' }}>
          {hasModifications && !showActionButtons && (
            <View style={[styles.badge, isDark && styles.badgeDark]} />
          )}
          <PressableFeedback
            style={[
              styles.fabMain,
              isDark && styles.fabMainDark,
              showActionButtons && styles.fabMainOpen,
            ]}
            onPress={toggleMenu}
            accessibilityLabel="Configuración"
          >
            <PressableFeedback.Scale />
            <Animated.View
              style={{ transform: [{ rotate: rotateInterpolation }] }}
            >
              <MaterialIcons
                name={showActionButtons ? 'close' : 'tune'}
                size={22}
                color={isDark ? '#fff' : '#1C1C1E'}
              />
            </Animated.View>
          </PressableFeedback>
        </View>
      </View>

      <SongFontPanel
        visible={showFontPanel}
        onClose={() => setShowFontPanel(false)}
        availableFonts={availableFonts}
        currentFontSize={currentFontSizeEm}
        currentFontFamily={currentFontFamily}
        onSetFontSize={onSetFontSize}
        onSetFontFamily={onSetFontFamily}
      />

      <TransposePanel
        visible={showTransposePanel}
        onClose={() => setShowTransposePanel(false)}
        currentTranspose={currentTranspose}
        onSetTranspose={handleSetTranspose}
      />

      <ReportBugsModal
        visible={showReportBugsModal}
        onClose={() => setShowReportBugsModal(false)}
        songTitle={songTitle}
        songFilename={songFilename}
        songAuthor={songAuthor}
        songKey={songKey}
        songCapo={songCapo}
        songInfo={songInfo}
        songContent={songContent}
        firebaseCategory={firebaseCategory}
        onSuccess={handleReportSuccess}
        onOpenSecretPanel={() => setShowSecretPanel(true)}
      />

      <SecretPanelModal
        visible={showSecretPanel}
        onClose={() => setShowSecretPanel(false)}
        songTitle={songTitle}
        songFilename={songFilename}
        songAuthor={songAuthor}
        songKey={songKey}
        songCapo={songCapo}
        songInfo={songInfo}
        songContent={songContent}
        firebaseCategory={firebaseCategory}
        onSuccess={handleSecretPanelSuccess}
      />
    </>
  );
};

const isIOS = Platform.OS === 'ios';

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 999,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  menuContainer: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 200,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  menuContainerDark: {
    backgroundColor: '#2C2C2E',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      },
      default: {
        shadowOpacity: 0.4,
      },
    }),
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 4,
    marginHorizontal: 12,
  },
  menuDividerDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginHorizontal: 4,
    marginVertical: 1,
  },
  actionButtonActive: {
    backgroundColor: '#E8F0FE',
  },
  actionButtonActiveDark: {
    backgroundColor: '#1A2744',
  },
  actionButtonText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  actionButtonTextDark: {
    color: '#EBEBF0',
  },
  actionButtonTextActive: {
    color: '#253883',
    fontWeight: '600',
  },
  actionButtonTextActiveDark: {
    color: '#7AB3FF',
    fontWeight: '600',
  },
  fabMain: {
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        width: 54,
        height: 54,
        borderRadius: 27,
        boxShadow: '0 3px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
        cursor: 'pointer',
      },
      default: {
        width: 48,
        height: 48,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  fabMainDark: {
    backgroundColor: '#2C2C2E',
  },
  fabMainOpen: {
    backgroundColor: '#FF453A',
  },
  badge: {
    position: 'absolute',
    right: -1,
    top: -1,
    backgroundColor: '#FF453A',
    borderRadius: 6,
    width: 12,
    height: 12,
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#F2F2F7',
  },
  badgeDark: {
    borderColor: '#1C1C1E',
  },
});

export default SongControls;
