import { createClient } from '@supabase/supabase-js'


const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Création d'une instance Supabase avec les paramètres de connexion
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
