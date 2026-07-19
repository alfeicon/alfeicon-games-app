const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const envUrl = envFile.split('\n').find(line => line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')).split('=')[1].trim();
const envKey = envFile.split('\n').find(line => line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')).split('=')[1].trim();

const supabase = createClient(envUrl, envKey);

async function checkConnection() {
  console.log("🔍 Intentando conectar con Supabase desde el servidor...");
  console.log("URL:", envUrl);
  
  const startTime = Date.now();
  try {
    const { data, error, status } = await supabase.from('games').select('id').limit(1);
    
    const timeTaken = Date.now() - startTime;

    if (error) {
      console.error("\n❌ Error al conectar a la base de datos:");
      console.error("Status HTTP:", status || "Desconocido");
      console.error("Mensaje:", error.message);
      console.error("\nEsto confirma que el servicio de Supabase tiene problemas actualmente.");
    } else {
      console.log(`\n✅ ¡Conexión exitosa! (Tiempo de respuesta: ${timeTaken}ms)`);
      console.log("Supabase ya está respondiendo correctamente de nuevo.");
    }
  } catch (err) {
    const timeTaken = Date.now() - startTime;
    console.error(`\n❌ Error crítico de red (después de ${timeTaken}ms):`, err.message);
  }
}

checkConnection();
