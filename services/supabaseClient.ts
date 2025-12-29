import { createClient } from '@supabase/supabase-js';

/**
 * Configuración oficial para el proyecto STA1: Project
 * Project ID: smfzyfxxjgckzceaoqkx
 */
const supabaseUrl = 'https://smfzyfxxjgckzceaoqkx.supabase.co';
const supabaseKey = 'sb_publishable_lvzsgj3gP80_josdafPpuw_2u86JeBZ';

// Inicialización del cliente real de Supabase
export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;