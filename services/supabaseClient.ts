import { createClient } from '@supabase/supabase-js';
import { getConfig } from './configService';

// Obtenemos la configuración de forma dinámica
const { supabaseUrl, supabaseAnonKey } = getConfig();

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

// Creamos un Proxy handler que responde con promesas de error a cualquier consulta
// para evitar que la aplicación falle en tiempo de carga si no hay claves válidas.
const dummyHandler = {
  get: function(target: any, prop: string) {
    if (prop === 'from') {
      return () => ({
        select: () => ({
          limit: () => Promise.resolve({ data: [], error: { message: 'Supabase no configurado', code: 'CONFIG_MISSING' } }),
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado', code: 'CONFIG_MISSING' } }),
            single: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado', code: 'CONFIG_MISSING' } }),
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: { message: 'Supabase no configurado', code: 'CONFIG_MISSING' } })
            })
          }),
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: { message: 'Supabase no configurado', code: 'CONFIG_MISSING' } })
          })
        }),
        select_count: () => Promise.resolve({ count: 0, error: { message: 'Supabase no configurado', code: 'CONFIG_MISSING' } }),
        insert: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado', code: 'CONFIG_MISSING' } }),
        update: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado', code: 'CONFIG_MISSING' } }),
        delete: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado', code: 'CONFIG_MISSING' } })
      });
    }
    // Para otros métodos, retornamos una función que retorna una promesa rechazada/vacía con error
    return () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado', code: 'CONFIG_MISSING' } });
  }
};

// Si Supabase está configurado correctamente, inicializamos el cliente real.
// De lo contrario, usamos el Proxy simulado.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({}, dummyHandler) as any;

export default supabase;