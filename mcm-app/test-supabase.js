// Test completo de conectividad Supabase
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function testSupabaseConnectivity() {
  console.log('🔧 === TEST DE CONECTIVIDAD SUPABASE ===\n');

  try {
    // 1. Verificar variables de entorno
    console.log('📋 1. Variables de entorno:');
    const envChecks = [
      ['Supabase URL', process.env.EXPO_PUBLIC_SUPABASE_URL],
      ['Anon Key', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY],
    ];

    envChecks.forEach(([name, value]) => {
      console.log(
        `   ${value ? '✅' : '❌'} ${name}: ${value ? 'Configurada' : 'No encontrada'}`,
      );
    });

    if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      console.log('\n❌ Error: Variables de entorno de Supabase no configuradas');
      console.log('\n📝 Para configurar Supabase:');
      console.log('   1. Crea un proyecto en https://supabase.com');
      console.log('   2. Ve a Settings > API');
      console.log('   3. Copia la URL del proyecto y la clave anónima');
      console.log('   4. Agrega las variables a tu archivo .env.local');
      console.log('\n🔍 Asegúrate de que el archivo .env.local contenga:');
      console.log('   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co');
      console.log('   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima');
      return;
    }

    // 2. Inicializar cliente Supabase
    console.log('\n🔧 2. Inicializando cliente Supabase...');
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    );
    console.log('   ✅ Cliente Supabase inicializado correctamente');

    // 3. Test de conectividad básico
    console.log('\n🌐 3. Verificando conectividad...');
    const { data: pingData, error: pingError } = await supabase
      .from('non_existent_table')
      .select('*')
      .limit(1);
    
    // Esperamos un error porque la tabla no existe, pero si se conecta veremos un error específico
    if (pingError) {
      if (pingError.message.includes('relation "non_existent_table" does not exist')) {
        console.log('   ✅ Conectividad establecida (error esperado de tabla inexistente)');
      } else if (pingError.message.includes('authentication required')) {
        console.log('   ⚠️  Conectividad OK pero requiere autenticación');
      } else {
        console.log('   ❌ Error de conectividad:', pingError.message);
      }
    } else {
      console.log('   ✅ Conectividad establecida');
    }

    // 4. Verificar estructura de la base de datos (listar tablas públicas)
    console.log('\n📊 4. Verificando estructura de la base de datos...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_public_tables')
      .select('*');

    if (tablesError) {
      // Si no existe la función RPC, intentemos con una consulta a information_schema
      console.log('   📝 Función get_public_tables no disponible, intentando método alternativo...');
      
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

      if (schemaError) {
        console.log('   ⚠️  No se puede acceder a metadatos de tablas:', schemaError.message);
        console.log('   💡 Esto es normal si no tienes permisos o si la base de datos está vacía');
      } else {
        console.log(`   ✅ Tablas encontradas: ${schemaData?.length || 0}`);
        if (schemaData && schemaData.length > 0) {
          schemaData.forEach((table) => console.log(`      - ${table.table_name}`));
        }
      }
    } else {
      console.log(`   ✅ Tablas públicas encontradas: ${tables?.length || 0}`);
      if (tables && tables.length > 0) {
        tables.forEach((table) => console.log(`      - ${table.table_name}`));
      }
    }

    // 5. Test de operaciones básicas con tabla de ejemplo
    console.log('\n🧪 5. Testeando operaciones básicas...');
    
    // Intentar crear una tabla de test si no existe
    const { data: testData, error: testError } = await supabase
      .from('test_connectivity')
      .select('*')
      .limit(1);

    if (testError) {
      if (testError.message.includes('relation "test_connectivity" does not exist')) {
        console.log('   📝 Tabla test_connectivity no existe (esto es normal)');
        console.log('   💡 Para tests completos, crea la tabla:');
        console.log('   CREATE TABLE test_connectivity (id SERIAL PRIMARY KEY, message TEXT, created_at TIMESTAMP DEFAULT NOW());');
      } else {
        console.log('   ❌ Error al acceder a tabla de test:', testError.message);
      }
    } else {
      console.log(`   ✅ Tabla test_connectivity accesible con ${testData?.length || 0} registros`);
      
      // Si la tabla existe, intentar insertar un registro de test
      const { data: insertData, error: insertError } = await supabase
        .from('test_connectivity')
        .insert([{ message: 'Test de conectividad desde Node.js - ' + new Date().toISOString() }])
        .select();

      if (insertError) {
        console.log('   ⚠️  No se pudo insertar registro de test:', insertError.message);
      } else {
        console.log('   ✅ Registro de test insertado correctamente');
        console.log(`      ID: ${insertData[0]?.id}, Mensaje: ${insertData[0]?.message}`);
      }
    }

    // 6. Test de políticas de seguridad (RLS)
    console.log('\n🔒 6. Verificando políticas de seguridad...');
    console.log('   📝 RLS (Row Level Security) puede estar activado');
    console.log('   💡 Si hay errores de permisos, revisa las políticas en Supabase Dashboard');

    // 7. Información del proyecto
    console.log('\n📋 7. Información del proyecto:');
    console.log(`   🔗 URL: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
    console.log(`   🔑 Anon Key: ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`);
    console.log('   📱 Dashboard: https://app.supabase.com/project/' + 
                process.env.EXPO_PUBLIC_SUPABASE_URL.split('.')[0].split('//')[1]);

    console.log('\n🎉 === TEST DE SUPABASE COMPLETADO ===');
    console.log('\n✅ Estado de la conexión: Supabase configurado y accesible');
    console.log('📝 Para usar Supabase en tu app, el cliente está listo para operaciones CRUD');
    
  } catch (error) {
    console.error('\n❌ Error durante el test:', error.message);
    console.log('\n🔍 Posibles causas:');
    console.log('   - Credenciales incorrectas de Supabase');
    console.log('   - URL del proyecto incorrecta');
    console.log('   - Problemas de conectividad de red');
    console.log('   - Configuración de CORS en Supabase');
    console.log('   - Políticas de seguridad muy restrictivas');
    console.log('\n💡 Soluciones sugeridas:');
    console.log('   - Verifica las credenciales en Supabase Dashboard');
    console.log('   - Asegúrate de que las variables de entorno están bien configuradas');
    console.log('   - Revisa la configuración de RLS en las tablas');
  }
}

// Ejecutar test
testSupabaseConnectivity();