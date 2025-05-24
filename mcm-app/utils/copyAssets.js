import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

async function copySongs() {
  try {
    // Obtener la lista de archivos de canciones
    const songs = [
      'ven_a_celebrar.cho',
      'dios_esta_aqui.cho',
      'lote_heredad.cho',
      'senor_pastor.cho',
      'aleluya_cantara.cho',
      'nunca_dejare.cho'
    ];

    // Crear el directorio de canciones si no existe
    const songsDir = `${FileSystem.documentDirectory}songs`;
    const dirInfo = await FileSystem.getInfoAsync(songsDir);
    if (!dirInfo.exists) {
      console.log('Creando directorio de canciones...');
      await FileSystem.makeDirectoryAsync(songsDir, { intermediates: true });
    }

    // Copiar cada archivo
    for (const song of songs) {
      try {
        const fileUri = `${songsDir}/${song}`;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        
        // Si el archivo no existe, copiarlo
        if (!fileInfo.exists) {
          console.log(`Copiando ${song}...`);
          
          // Obtener el asset
          const asset = Asset.fromModule(require(`../assets/songs/${song}`));
          await asset.downloadAsync();
          
          // Copiar el archivo
          await FileSystem.copyAsync({
            from: asset.localUri || asset.uri,
            to: fileUri
          });
          
          console.log(`${song} copiado correctamente`);
        }
      } catch (error) {
        console.error(`Error al copiar ${song}:`, error);
      }
    }
    
    console.log('Proceso de copia de canciones completado');
  } catch (error) {
    console.error('Error en copySongs:', error);
    throw error;
  }
}

export default copySongs;
