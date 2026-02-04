// Script para verificar qué buckets de Storage existen
import admin from 'firebase-admin';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('❌ Falta la variable de entorno GOOGLE_APPLICATION_CREDENTIALS');
  console.error('   Configura GOOGLE_APPLICATION_CREDENTIALS con el JSON completo de las credenciales');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

async function checkBuckets() {
  console.log('🔍 Verificando buckets disponibles...\n');
  
  const projectId = serviceAccount.project_id;
  console.log(`📦 Proyecto Firebase: ${projectId}`);
  
  // Nombres comunes de buckets
  const possibleBuckets = [
    `${projectId}.appspot.com`,
    `${projectId}.firebasestorage.app`,
    `gs://${projectId}.appspot.com`,
    `gs://${projectId}.firebasestorage.app`,
  ];
  
  console.log('\n🔄 Probando buckets posibles:\n');
  
  for (const bucketName of possibleBuckets) {
    try {
      const bucket = admin.storage().bucket(bucketName);
      const [exists] = await bucket.exists();
      
      if (exists) {
        console.log(`✅ ${bucketName} - EXISTE`);
        
        // Intentar listar archivos para confirmar acceso
        try {
          const [files] = await bucket.getFiles({ maxResults: 1 });
          console.log(`   └─ Acceso confirmado (${files.length} archivos de muestra)`);
        } catch (listError) {
          console.log(`   └─ ⚠️  Existe pero sin permisos de lectura: ${listError.message}`);
        }
      } else {
        console.log(`❌ ${bucketName} - NO EXISTE`);
      }
    } catch (error) {
      console.log(`❌ ${bucketName} - ERROR: ${error.message}`);
    }
  }
  
  console.log('\n💡 SOLUCIÓN:');
  console.log('1. Si ningún bucket existe, habilita Firebase Storage en la consola:');
  console.log('   https://console.firebase.google.com/project/paysatv2/storage');
  console.log('\n2. Una vez habilitado, agrega a tu .env o variables de entorno:');
  console.log('   FIREBASE_STORAGE_BUCKET=paysatv2.appspot.com');
  console.log('   (o el nombre del bucket que aparezca como ✅)');
}

checkBuckets()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
