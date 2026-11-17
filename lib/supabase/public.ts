// Configuración PÚBLICA de Supabase (no es secreta).
// La URL y la clave anónima viajan a todo navegador que abre la página; la seguridad la
// imponen las reglas RLS de la base de datos (solo el administrador puede escribir).
// Las variables de entorno, si existen, tienen prioridad.
export const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ftmyzrioambzlnxmrjlw.supabase.co";
export const PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_MUoE1PcES5x4DjG1g5rzoQ_7KgjvR9I";
