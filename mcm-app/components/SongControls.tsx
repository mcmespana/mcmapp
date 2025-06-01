import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Button, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import theme from '../app/styles/theme'; // Default import for theme

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
  notation?: 'english' | 'spanish'; // Added notation prop
  availableFonts: FontOption[];
  onToggleChords: () => void;
  onSetTranspose: (semitones: number) => void;
  onSetFontSize: (sizeEm: number) => void;
  onSetFontFamily: (fontFamily: string) => void;
  onChangeNotation: () => void; // For "Notación (Próximamente)"
}

const SongControls: React.FC<SongControlsProps> = ({
  chordsVisible,
  currentTranspose,
  currentFontSizeEm,
  currentFontFamily,
  notation = 'english', // Default to English if not provided
  availableFonts,
  onToggleChords,
  onSetTranspose,
  onSetFontSize,
  onSetFontFamily,
  onChangeNotation,
}) => {
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [showTransposeModal, setShowTransposeModal] = useState(false);
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [showFontFamilyModal, setShowFontFamilyModal] = useState(false);

  const handleOpenTransposeModal = () => setShowTransposeModal(true);
  const handleOpenFontSizeModal = () => setShowFontSizeModal(true);
  const handleOpenFontFamilyModal = () => setShowFontFamilyModal(true);

  // Wrapper for onSetTranspose to also close the modal
  const handleSetTransposeAndClose = (semitones: number) => {
    onSetTranspose(semitones);
    //setShowTransposeModal(false); // Keep modal open to see changes, or close if preferred
  };
  
  // Wrapper for onSetFontSize, modal can be kept open
  const handleSetFontSizeAndClose = (size: number) => {
    onSetFontSize(size);
    // setShowFontSizeModal(false); // Keep modal open
  }

  // Wrapper for onSetFontFamily to also close the modal
  const handleSetFontFamilyAndClose = (fontFamily: string) => {
    onSetFontFamily(fontFamily);
    setShowFontFamilyModal(false);
  };

  return (
    <>
      {/* FABs */}
      <View style={styles.fabContainer}>
        {showActionButtons && (
          <View style={styles.fabActionsContainer}>
            <TouchableOpacity style={[styles.fabAction, !chordsVisible && styles.fabActionActive]} onPress={onToggleChords}>
              <Text style={[styles.fabActionText, !chordsVisible && styles.fabActionTextActive]}>Acordes {chordsVisible ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fabAction, currentTranspose !== 0 && styles.fabActionActive]} onPress={handleOpenTransposeModal}>
              <Text style={[styles.fabActionText, currentTranspose !== 0 && styles.fabActionTextActive]}>Cambiar tono</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fabAction, notation === 'spanish' && styles.fabActionActive]} onPress={onChangeNotation}>
              <Text style={[styles.fabActionText, notation === 'spanish' && styles.fabActionTextActive]}>
                {notation === 'english' ? 'Notación (Esp)' : 'Notación (Eng)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fabAction, currentFontSizeEm !== 1.0 && styles.fabActionActive]} onPress={handleOpenFontSizeModal}>
              <Text style={[styles.fabActionText, currentFontSizeEm !== 1.0 && styles.fabActionTextActive]}>Tamaño Letra</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fabAction, availableFonts.length > 0 && currentFontFamily !== availableFonts[0].cssValue && styles.fabActionActive]} onPress={handleOpenFontFamilyModal}>
              <Text style={[styles.fabActionText, availableFonts.length > 0 && currentFontFamily !== availableFonts[0].cssValue && styles.fabActionTextActive]}>Tipo de Letra</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.fabMain} onPress={() => setShowActionButtons(!showActionButtons)}>
          <Text style={styles.fabMainText}>{showActionButtons ? '✕' : '🛠️'}</Text>
        </TouchableOpacity>
      </View>

      {/* Font Size Modal */}
      <Modal
        transparent={true}
        visible={showFontSizeModal}
        onRequestClose={() => setShowFontSizeModal(false)}
        animationType="fade"
      >
        <TouchableWithoutFeedback onPress={() => setShowFontSizeModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Ajustar Tamaño Letra</Text>
                <View style={styles.fontSizeButtonRow}>
                  <Button title="A+" onPress={() => handleSetFontSizeAndClose(currentFontSizeEm + 0.1)} />
                  <Button title="A-" onPress={() => handleSetFontSizeAndClose(Math.max(0.5, currentFontSizeEm - 0.1))} />
                </View>
                <Button title={`Original (${(currentFontSizeEm * 100).toFixed(0)}%)`} onPress={() => handleSetFontSizeAndClose(1.0)} />
                <Button title="Cerrar" onPress={() => setShowFontSizeModal(false)} color="#888"/>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Font Family Modal */}
      <Modal
        transparent={true}
        visible={showFontFamilyModal}
        onRequestClose={() => setShowFontFamilyModal(false)}
        animationType="fade"
      >
        <TouchableWithoutFeedback onPress={() => setShowFontFamilyModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Seleccionar Tipo de Letra</Text>
                {availableFonts.map((font) => (
                  <TouchableOpacity
                    key={font.cssValue}
                    style={styles.fontFamilyOptionButton}
                    onPress={() => handleSetFontFamilyAndClose(font.cssValue)}
                  >
                    <Text style={[styles.fontFamilyOptionText, { fontFamily: font.cssValue }]}>{font.name}</Text>
                  </TouchableOpacity>
                ))}
                <Button title="Cerrar" onPress={() => setShowFontFamilyModal(false)} color="#888"/>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Transpose Modal */}
      <Modal
        transparent={true}
        visible={showTransposeModal}
        onRequestClose={() => setShowTransposeModal(false)}
        animationType="fade"
      >
        <TouchableWithoutFeedback onPress={() => setShowTransposeModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Cambio tono</Text>
                <View style={styles.transposeButtonRow}>
                  <Button title="+1/2 tono" onPress={() => handleSetTransposeAndClose(currentTranspose + 1)} />
                  <Button title="+1 tono" onPress={() => handleSetTransposeAndClose(currentTranspose + 2)} />
                </View>
                <View style={styles.transposeButtonRow}>
                  <Button title="-1/2 tono" onPress={() => handleSetTransposeAndClose(currentTranspose - 1)} />
                  <Button title="-1 tono" onPress={() => handleSetTransposeAndClose(currentTranspose - 2)} />
                </View>
                <Button title="Tono Original 🔄" onPress={() => handleSetTransposeAndClose(0)} />
                <Button title="Volver" onPress={() => setShowTransposeModal(false)} color="#888"/>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    backgroundColor: theme.backgroundLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    borderWidth: 1.5,
    borderColor: theme.primary,
  },
  fabActionActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primaryDark,
  },
  fabActionText: {
    color: theme.primary,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.modalOverlay,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
    // Add shadow for modals if desired, e.g.:
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.25,
    // shadowRadius: 3.84,
    // elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: theme.textDark, // Ensure text color is appropriate
  },
  fontFamilyOptionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
    marginBottom: 10,
    alignItems: 'center',
    width: '100%', // Make buttons take full width of modal content
  },
  fontFamilyOptionText: {
    fontSize: 16,
    color: theme.textDark,
  },
  transposeButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Or 'space-between'
    marginBottom: 15,
    width: '100%',
  },
  fontSizeButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Or 'space-between'
    width: '100%',
    marginBottom: 10,
  },
  // Ensure all necessary styles from SongDetailScreen related to FABs and Modals are here
});

export default SongControls;
