import { useEffect, useState } from 'react';
import { shufflePhrases } from '@/constants/updatePhrases';

/**
 * La frase del aviso «un momentín»: una al azar al aparecer y, si la pantalla
 * se alarga, la siguiente cada `intervalMs`, sin repetir hasta agotarlas todas.
 * Con `active` en `false` no corre ningún temporizador.
 */
export default function useUpdatePhrases(
  active: boolean,
  intervalMs: number,
): string {
  const [order, setOrder] = useState<string[]>(() => shufflePhrases());
  const [index, setIndex] = useState(0);
  const [wasActive, setWasActive] = useState(active);

  // Cada vez que el aviso aparece, otra mezcla y otra primera frase. Se ajusta
  // durante el render (patrón de React para «estado que depende de una prop»)
  // y no en un efecto, para no pintar un fotograma con la frase anterior.
  if (active !== wasActive) {
    setWasActive(active);
    if (active) {
      setOrder(shufflePhrases());
      setIndex(0);
    }
  }

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setIndex((i) => i + 1), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);

  return order[index % order.length];
}
