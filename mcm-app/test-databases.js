// Test comparativo de conectividad Firebase vs Supabase
require('dotenv').config({ path: '.env.local' });

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
const { createClient } = require('@supabase/supabase-js');

async function testBothDatabases() {
  console.log('🔥 === COMPARATIVA: FIREBASE vs SUPABASE ===\n');

  // Test Firebase
  console.log('🔥 FIREBASE TEST:');
  console.log('================');
  
  const firebaseConfigured = process.env.EXPO_PUBLIC_FIREBASE_API_KEY && 
                            process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  
  if (firebaseConfigured) {
    try {
      const firebaseConfig = {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      };

      const app = initializeApp(firebaseConfig);
      const db = getDatabase(app);
      console.log('✅ Firebase: Cliente inicializado');
      
      const rootRef = ref(db, '/');
      const rootSnapshot = await get(rootRef);
      
      if (rootSnapshot.exists()) {
        const rootData = rootSnapshot.val();
        const nodes = Object.keys(rootData);
        console.log(`✅ Firebase: Conectado - ${nodes.length} nodos encontrados`);
      } else {
        console.log('⚠️  Firebase: Conectado pero base de datos vacía');
      }
    } catch (error) {
      console.log('❌ Firebase: Error de conexión -', error.message);
    }
  } else {
    console.log('❌ Firebase: No configurado (variables de entorno faltantes)');
  }

  console.log('\n🔧 SUPABASE TEST:');
  console.log('=================');
  
  const supabaseConfigured = process.env.EXPO_PUBLIC_SUPABASE_URL && 
                            process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
  if (supabaseConfigured) {
    try {
      const supabase = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
      );
      console.log('✅ Supabase: Cliente inicializado');
      
      // Test simple de conectividad
      const { error } = await supabase
        .from('ping_test')
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.message.includes('relation "ping_test" does not exist')) {
          console.log('✅ Supabase: Conectado (error esperado de tabla inexistente)');
        } else if (error.message.includes('authentication required')) {
          console.log('✅ Supabase: Conectado (requiere autenticación)');
        } else if (error.message.includes('fetch failed')) {
          console.log('❌ Supabase: Error de red o credenciales incorrectas');
        } else {
          console.log('⚠️  Supabase: Conectado con restricciones -', error.message);
        }
      } else {
        console.log('✅ Supabase: Conectado completamente');
      }
    } catch (error) {
      console.log('❌ Supabase: Error de conexión -', error.message);
    }
  } else {
    console.log('❌ Supabase: No configurado (variables de entorno faltantes)');
  }

  // Resumen
  console.log('\n📊 RESUMEN:');
  console.log('===========');
  console.log(`🔥 Firebase: ${firebaseConfigured ? 'Configurado' : 'No configurado'}`);
  console.log(`🔧 Supabase: ${supabaseConfigured ? 'Configurado' : 'No configurado'}`);
  
  if (!firebaseConfigured && !supabaseConfigured) {
    console.log('\n❌ Ninguna base de datos está configurada');
    console.log('📝 Configura al menos una en tu archivo .env.local');
  } else if (firebaseConfigured && supabaseConfigured) {
    console.log('\n✅ Ambas bases de datos están configuradas');
    console.log('🎯 Puedes elegir cuál usar para tu aplicación');
  } else {
    const configured = firebaseConfigured ? 'Firebase' : 'Supabase';
    console.log(`\n⚠️  Solo ${configured} está configurado`);
  }

  console.log('\n🎉 === TEST COMPLETADO ===');
}

// Ejecutar test
testBothDatabases();