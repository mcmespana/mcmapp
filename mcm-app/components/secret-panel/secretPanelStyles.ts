/**
 * Estilos de `components/SecretPanelModal.tsx`.
 *
 * Extraídos tal cual, sin tocar ni un valor: eran 173 líneas de las
 * 1130 del fichero. Mismo patrón que `components/grupos/gruposStyles.ts`.
 */
import { StyleSheet } from 'react-native';
import { radii } from '@/constants/uiStyles';

export const styles = StyleSheet.create({
  // Estilos originales
  container: {
    minHeight: '90%',
    paddingBottom: 20,
  },
  fullContainer: {
    flex: 1,
    height: '100%',
    maxHeight: '100%',
  },
  authContainer: {
    minHeight: '60%',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  songInfo: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 20,
    textAlign: 'center',
  },
  mysteriousContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 20,
  },
  mysteriousText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  mysteriousSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.sm,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  contentInput: {
    minHeight: 200,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    flex: 0.48,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: radii.sm,
    marginTop: 20,
    marginBottom: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#8E8E93',
    opacity: 0.4,
    marginTop: 24,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  embedPreview: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: -4,
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  linkLabelInput: {
    flex: 0.9,
    marginBottom: 0,
  },
  linkUrlInput: {
    flex: 1.4,
    marginBottom: 0,
  },
  linkRemoveBtn: {
    padding: 6,
  },
  addLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addLinkText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
