export const AppColors = {
  primary: '#007bff',        // Azul principal para elementos activos, bordes de FABs inactivos
  primaryDark: '#0056b3',     // Azul más oscuro para bordes de FABs activos
  accentYellow: '#f4c11e',    // Amarillo para el FAB principal y texto de FABs inactivos
  textLight: '#ffffff',       // Texto blanco (para FABs activos y FAB principal)
  textDark: '#212529',        // Texto oscuro general
  backgroundLight: '#ffffff', // Fondo blanco para FABs inactivos
  modalOverlay: 'rgba(0, 0, 0, 0.5)', // Fondo semitransparente para overlay de modales
  secondaryText: '#6c757d',   // Color para texto secundario o comentarios
} as const;

export type AppColorsType = typeof AppColors;

export default {
  ...AppColors,
  // Puedes agregar más configuraciones de tema aquí si es necesario
} as const;
