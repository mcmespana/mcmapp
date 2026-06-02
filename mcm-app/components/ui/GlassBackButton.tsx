/**
 * Fallback Android/Web del botón "Atrás" glass: en estas plataformas usamos
 * el botón de retroceso nativo del stack (barra de color), así que este
 * componente no renderiza nada. Solo existe para que el import se resuelva
 * fuera de iOS (Metro coge `GlassBackButton.ios.tsx` en iOS y este en el resto).
 */
export default function GlassBackButton() {
  return null;
}
