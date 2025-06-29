import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../app/styles/theme'; // Default import for theme
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DEFAULT_FONT_SIZE_EM } from '../contexts/SettingsContext';
import SongFontPanel from './SongFontPanel';
import TransposePanel from './TransposePanel';

// Define availableFonts structure if not already globally defined
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
}) => {
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [showTransposePanel, setShowTransposePanel] = useState(false);
  const [showFontPanel, setShowFontPanel] = useState(false);

  const handleOpenTransposePanel = () => setShowTransposePanel(true);
  const handleOpenFontPanel = () => setShowFontPanel(true);

  // Wrapper for onSetTranspose to also close the modal
  const handleSetTranspose = (semitones: number) => {
    onSetTranspose(semitones);
  };

  return (
    <>
      {/* FABs */}
      <View style={styles.fabContainer}>
        {showActionButtons && (
          <View style={styles.fabActionsContainer}>
            <TouchableOpacity
              style={[
                styles.fabAction,
                !chordsVisible && styles.fabActionActive,
              ]}
              onPress={onToggleChords}
            >
              <Text
                style={[
                  styles.fabActionText,
                  !chordsVisible && styles.fabActionTextActive,
                ]}
              >
                Acordes {chordsVisible ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.fabAction,
                notation !== 'ES' && styles.fabActionActive,
              ]}
              onPress={onToggleNotation}
            >
              <Text
                style={[
                  styles.fabActionText,
                  notation !== 'ES' && styles.fabActionTextActive,
                ]}
              >
                Notación: {notation}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.fabAction,
                currentTranspose !== 0 && styles.fabActionActive,
              ]}
              onPress={handleOpenTransposePanel}
            >
              <Text
                style={[
                  styles.fabActionText,
                  currentTranspose !== 0 && styles.fabActionTextActive,
                ]}
              >
                Cambiar tono
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.fabAction,
                (currentFontSizeEm !== DEFAULT_FONT_SIZE_EM ||
                  (availableFonts.length > 0 &&
                    currentFontFamily !== availableFonts[0].cssValue)) &&
                  styles.fabActionActive,
              ]}
              onPress={handleOpenFontPanel}
            >
              <Text
                style={[
                  styles.fabActionText,
                  (currentFontSizeEm !== DEFAULT_FONT_SIZE_EM ||
                    (availableFonts.length > 0 &&
                      currentFontFamily !== availableFonts[0].cssValue)) &&
                    styles.fabActionTextActive,
                ]}
              >
                Tipo de letra
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fabAction}
              onPress={onNavigateToFullscreen}
            >
              <Text style={styles.fabActionText}>Pantalla completa</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ position: 'relative' }}>
          {(currentTranspose !== 0 ||
            !chordsVisible ||
            currentFontSizeEm !== DEFAULT_FONT_SIZE_EM ||
            (availableFonts.length > 0 &&
              currentFontFamily !== availableFonts[0].cssValue) ||
            notation !== 'ES') && <View style={styles.badge} />}
          <TouchableOpacity
            style={styles.fabMain}
            onPress={() => setShowActionButtons(!showActionButtons)}
            accessibilityLabel="Configuración"
          >
            {/* Use IconSymbol for Material Design icons */}
            <MaterialIcons
              name={showActionButtons ? 'close' : 'settings'}
              size={32}
              color={theme.textLight}
              style={styles.fabMainIcon}
            />
          </TouchableOpacity>
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
    </>
  );
};

// Styles moved from SongDetailScreen.tsx
const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'flex-end',
  },
  fabActionsContainer: {
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  fabAction: {
    backgroundColor: theme.accentYellow,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  fabActionActive: {
    backgroundColor: theme.primary,
  },
  fabActionText: {
    color: theme.textDark,
    fontWeight: 'bold',
  },
  fabActionTextActive: {
    color: theme.textLight,
  },
  fabMain: {
    backgroundColor: theme.accentYellow,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabMainText: {
    color: theme.textLight,
    fontSize: 28,
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: 'red',
    borderRadius: 10,
    width: 20,
    height: 20,
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMainIcon: {
    // Center icon in FAB
    alignSelf: 'center',
  },
  // Ensure all necessary styles from SongDetailScreen related to FABs and Modals are here
});

export default SongControls;
