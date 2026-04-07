import { supabase } from './lib/supabase.js';

async function testConnection() {
  try {
    const { data, error } = await supabase.from('companies').select('count').limit(1);
    if (error) {
      console.error('Erro de conexão:', error);
      return false;
    }
    console.log('Conexão bem-sucedida! Dados:', data);
    return true;
  } catch (err) {
    console.error('Erro:', err);
    return false;
  }
}

testConnection();