// Test completo de conectividad Firebase
require('dotenv').config({ path: '.env.local' });

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

async function testFirebaseConnectivity() {
  console.log('� === TEST DE CONECTIVIDAD FIREBASE ===\n');

  try {
    // 1. Verificar variables de entorno
    console.log('📋 1. Variables de entorno:');
    const envChecks = [
      ['API Key', process.env.EXPO_PUBLIC_FIREBASE_API_KEY],
      ['Project ID', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID],
      ['Database URL', process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL],
      ['Auth Domain', process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN],
    ];

    envChecks.forEach(([name, value]) => {
      console.log(
        `   ${value ? '✅' : '❌'} ${name}: ${value ? 'Configurada' : 'No encontrada'}`,
      );
    });

    if (!process.env.EXPO_PUBLIC_FIREBASE_API_KEY) {
      console.log('\n❌ Error: Variables de entorno no configuradas');
      return;
    }

    // 2. Inicializar Firebase
    console.log('\n🔧 2. Inicializando Firebase...');
    const app = initializeApp(config);
    const db = getDatabase(app);
    console.log('   ✅ Firebase inicializado correctamente');

    // 3. Verificar estructura de la base de datos
    console.log('\n📊 3. Verificando estructura de la base de datos...');
    const rootRef = ref(db, '/');
    const rootSnapshot = await get(rootRef);

    if (rootSnapshot.exists()) {
      const rootData = rootSnapshot.val();
      const nodes = Object.keys(rootData);
      console.log(
        `   ✅ Base de datos activa con ${nodes.length} nodos principales:`,
      );
      nodes.forEach((node) => console.log(`      - ${node}`));
    } else {
      console.log('   ❌ Base de datos vacía o sin permisos de lectura');
    }

    // 4. Test específico de Wordle
    console.log('\n🎯 4. Verificando datos de Wordle...');
    const wordsRef = ref(db, 'wordle/daily-words');
    const wordsSnapshot = await get(wordsRef);

    if (wordsSnapshot.exists()) {
      const wordsData = wordsSnapshot.val();
      const dates = Object.keys(wordsData).sort();
      console.log(
        `   ✅ Palabras de Wordle encontradas: ${dates.length} fechas`,
      );
      console.log(`   � Rango: ${dates[0]} → ${dates[dates.length - 1]}`);

      // Verificar palabra de hoy
      const today = new Date().toISOString().slice(0, 10);
      if (wordsData[today]) {
        console.log(`   🎯 Palabra de HOY (${today}):`);
        console.log(`      Mañana: ${wordsData[today][0]}`);
        console.log(`      Tarde: ${wordsData[today][1]}`);
      } else {
        console.log(`   ⚠️  No hay palabra específica para hoy (${today})`);
      }
    } else {
      console.log('   ❌ No se encontraron datos de Wordle');
    }

    // 5. Test de estadísticas (si existe)
    console.log('\n� 5. Verificando nodo de estadísticas...');
    const statsRef = ref(db, 'wordle/stats');
    const statsSnapshot = await get(statsRef);

    if (statsSnapshot.exists()) {
      const statsData = statsSnapshot.val();
      const userCount = Object.keys(statsData).length;
      console.log(
        `   ✅ Estadísticas encontradas: ${userCount} usuarios registrados`,
      );
    } else {
      console.log(
        '   📝 No hay estadísticas registradas aún (normal para nueva instalación)',
      );
    }

    console.log('\n🎉 === TEST COMPLETADO EXITOSAMENTE ===');
  } catch (error) {
    console.error('\n❌ Error durante el test:', error.message);
    console.log('\n🔍 Posibles causas:');
    console.log('   - Credenciales incorrectas');
    console.log('   - Reglas de seguridad de Firebase');
    console.log('   - Conectividad de red');
    console.log('   - Base de datos no inicializada');
  }
}

// Ejecutar test
testFirebaseConnectivity();
