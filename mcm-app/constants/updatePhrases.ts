// constants/updatePhrases.ts
//
// Frases del aviso «un momentín» que sale mientras la app se actualiza sola
// (`components/OTAUpdatingOverlay.tsx`). Una al azar cada vez, y otra si la
// pantalla se alarga. Tono: cercano, con guiños de grupo (pañuelos, COM, el
// autobús del campamento) y de la propia app. Cortas: caben en dos líneas.
//
// Reglas (las vigila `__tests__/updatePhrases.test.ts`): entre 100 y 200, sin
// repetidas, máx. 80 caracteres, sin exclamaciones (el aviso ya es amable por
// sí solo) y sin texto vacío. Si añades, mantén el humor de andar por casa:
// de cristiano, lo justo.

export const UPDATE_PHRASES: readonly string[] = [
  // — El aviso en sí —
  'Un momentín, que tenemos una cosa nueva',
  'Un momentito, que estamos poniendo la app más bonita',
  'Tranqui, no vas a perder nada: esta app siempre se actualiza',
  'Un segundín… ya casi estamos',
  'STOP: un momento antes de empezar',
  'Que no cunda el pánico, es solo una novedad',
  'Dos segundos y seguimos a lo nuestro',
  'Aquí no se pierde nada, solo se gana',
  'Esto es rápido, palabra de grupo',
  'Ya mismo lo tienes, de verdad',
  'Un momento, que le estamos dando un repaso a todo',
  'No te muevas, que ya casi está',
  'Estrenando versión. Huele a nuevo',
  'Las mejores apps se actualizan solas. Esta es una de ellas',
  'Cargando novedades recién salidas del horno',
  'Descargando las novedades con mucho cariño',
  'Sin prisa, pero con un poquito de prisa',

  // — Guiños de grupo (los de casa) —
  'Estamos pasando al pañuelo amarillo',
  'Esta actualización es como pasar del COM de incorporación a crecimiento',
  'Imprimiendo nuevos libros de vida',
  'Pasando de MIC a COM, sin que se note',
  'Incorporando un nuevo LC al equipo',
  'Preparando el autobús del campamento',
  'Programando las actividades de la fiesta inicial',
  'Planchando los pañuelos para el próximo encuentro',
  'Contando las plazas del autobús, otra vez',
  'Repasando la lista de material del campamento',
  'Buscando el micro que siempre desaparece antes de empezar',
  'Montando la gymkhana: hay más pruebas de las que caben',
  'Ensayando el baile de la fiesta inicial',
  'Preparando los bocatas de tortilla para el viaje',
  'Buscando a quien tiene la llave del almacén',
  'Pasando lista por tercera vez, que siempre falta alguien',
  'Esperando a los últimos del grupo, como siempre',
  'Repartiendo las chapas del encuentro',
  'Colocando las sillas en círculo para la dinámica',
  'Inventando el nombre de los equipos de la gymkhana',
  'Reservando el pabellón. Otra vez',
  'Haciendo la reunión de monitores. Esta vez, corta',
  'Preparando la dinámica del círculo, cada uno con su silla',
  'Llevando las mochilas al autobús. Todas',
  'Buscando el pañuelo que se quedó en la última convivencia',
  'Cosiendo parches en los pañuelos viejos',
  'Subiendo de COM I a COM II sin hacer ruido',
  'Estrenando libro de vida, página en blanco incluida',
  'Montando el escenario de la fiesta inicial',
  'Apuntando las alergias de todo el campamento',
  'Colgando el cartel de bienvenida, ya recto',
  'Haciendo la foto de grupo. A la tercera sale',
  'Recontando los bocatas de la excursión',
  'Poniendo música para el viaje en autobús',
  'Escribiendo la hoja de ruta del próximo encuentro',
  'Recogiendo los trastos de la última actividad',
  'Preparando el juego de las presentaciones',
  'Contando las camas del albergue. Siempre sobra una',
  'Repartiendo los grupos de la dinámica sin que nadie proteste',
  'Dibujando el mapa de la gymkhana, con tesoro y todo',
  'Buscando el silbato, que lo tiene quien menos esperas',
  'Colocando las mesas para la merienda de bienvenida',
  'Ordenando el armario de los materiales, por fin',
  'Haciendo hueco en el horario para la siesta',
  'Afinando el himno del campamento',
  'Imprimiendo las listas de grupos, con tres erratas',
  'Montando la tienda de campaña a la primera. Casi',
  'Pasando a limpio las notas de la última reunión',
  'Dando la bienvenida a quien llega nuevo al grupo',
  'Preparando la fiesta de fin de curso con antelación',
  'Esperando a que alguien traiga el altavoz',
  'Haciendo hueco en la furgoneta, que no cabe un alfiler',
  'Escribiendo el guion del teatro de la fiesta',
  'Preparando las pruebas de la noche de juegos',
  'Pegando gomets en las tarjetas de los equipos',
  'Calentando motores para el próximo curso',
  'Buscando voluntarios para llevar el altavoz. Todos miran al suelo',
  'Haciendo la lista de la compra del campamento',

  // — Música y cantoral —
  'Afinando el cantoral para que suene mejor',
  'Cargando las guitarras (y las cejillas)',
  'Transponiendo la app dos tonos arriba',
  'Cambiando de tono sin que se note',
  'Buscando la cejilla, que siempre está en el último bolsillo',
  'Poniendo los acordes en su sitio',
  'Repasando el estribillo una vez más',
  'Subiendo el volumen de las novedades, pero con cariño',
  'Pasando las páginas del cantoral, ya sin ruido',
  'Haciendo que todos empiecen a la vez la primera estrofa',
  'Afinando la guitarra, que siempre cuesta más de lo que parece',
  'Buscando quien sepa el segundo verso',
  'Cantando bajito para no despertar al servidor',
  'Pasando la letra al papel, por si acaso',
  'Probando el sonido, uno, dos, uno, dos',
  'Dejando el cantoral más ordenado que mi mochila',
  'Poniéndole cejilla al cantoral para que suene a gloria',

  // — La app, por dentro —
  'Quitando el polvo a los píxeles',
  'Sacándole brillo al calendario',
  'Puliendo botones para que brillen más',
  'Dándole cuerda a las notificaciones',
  'Ordenando las fotos, las movidas al final',
  'Haciendo que la app esté más guapa que ayer',
  'Un cambio pequeño para ti, una app mejor para todos',
  'Barriendo bugs bajo la alfombra. Perdón, quería decir arreglándolos',
  'Poniéndole una capa de pintura nueva a la pantalla de inicio',
  'Colocando cada cosa en su sitio',
  'Echándole un vistazo a lo de siempre, por si algo se movió',
  'Haciendo la app un poco más rápida, para que no te enfades',
  'Pasándole un paño a cada pantalla',
  'Revisando que cada botón haga lo que promete',
  'Metiendo novedades en la mochila de la app',
  'Ajustando tornillos que nadie ve, pero que se notan',
  'Hablando con el servidor. Le hemos pedido un favor',
  'Alisando las arrugas del modo oscuro',
  'Dándole un baño al calendario, que lo necesitaba',
  'Cambiando bombillas en la pantalla de inicio',
  'Repasando las notificaciones para que lleguen a su hora',
  'Doblando las novedades para que quepan en el móvil',
  'Escondiendo los andamios, que ya casi está la obra',
  'Dejando el cuarto de la app recogido',
  'Ordenando por tamaños los iconos, que se ve más bonito',
  'Probando la app a oscuras, por si acaso',
  'Poniendo cada pestaña en su lugar',
  'Cepillando los bordes de las tarjetas',
  'Cambiando el aceite a la app',
  'Quitando migas de debajo del teclado',

  // — Comparaciones de tiempo —
  'Menos de lo que se tarda en afinar una guitarra',
  'Más rápido que montar una tienda de campaña',
  'En lo que tardas en pedir el micro, ya estamos',
  'Más corto que los avisos del final de la misa. O casi',
  'Menos que una reunión de monitores, seguro',
  'Más rápido que repartir los grupos de la dinámica',
  'En lo que tardan en traer los bocatas, ya está',
  'Menos de lo que tarda el autobús en arrancar',
  'Más rápido que encontrar el pañuelo propio',
  'Tarda menos que ponerse en fila para entrar',
  'Dura menos que un rato de silencio en el autobús',
  'Menos que una ronda de presentaciones',
  'Más rápido que decidir dónde se sienta cada uno',
  'Esto va más rápido que la cola del bocata',
  'Menos de lo que tarda el grupo en callarse',
  'Dura lo que un estribillo. Dos, como mucho',
  'Antes de que acabe el café ya está listo',
  'Más rápido que decir «¿cuánto queda?» desde el asiento de atrás',

  // — Cariño y tranquilidad —
  'Tus cosas siguen donde las dejaste',
  'Todo sigue en su sitio, solo que más bonito',
  'Tus canciones y tus ajustes están a salvo',
  'Nadie se queda atrás: esta actualización va para todos',
  'Es solo un empujoncito para mejorar',
  'Lo hacemos para que cada vez sea más fácil',
  'Gracias por la paciencia, de corazón',
  'Se nota que sabes esperar. Eso es de grupo bueno',
  'Respira hondo. Ya está casi',
  'Para ti, con cariño y recién hecho',
  'Esto es lo que pasa cuando un grupo no deja de mejorar',
  'Porque siempre se puede hacer un poquito mejor',
  'La paciencia es una virtud, y tú la tienes',
  'Un momento de pausa, como en la oración. Pero de dos segundos',
  'Los buenos momentos se preparan con calma',
  'Mientras esperas, estira un poco los hombros',
  'Un pequeño paso para la app, un gran salto para el grupo',
  'Si lees esto, es que la actualización va bien',
  'A veces toca parar un momentín para ir mejor',
  'Cada actualización es como un curso nuevo: más ganas',
];

/**
 * Mezcla Fisher-Yates de una copia: el orden en que se van enseñando durante
 * una misma pantalla de actualización, sin repetir hasta agotarlas. `rand` se
 * inyecta para poder testearlo (`Math.random` por defecto).
 */
export function shufflePhrases(
  phrases: readonly string[] = UPDATE_PHRASES,
  rand: () => number = Math.random,
): string[] {
  const out = [...phrases];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
