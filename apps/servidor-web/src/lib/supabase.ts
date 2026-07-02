import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Aviso: Variaveis NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY nao definidas.');
}

export const supabase = createClient(
  supabaseUrl || 'https://sua-url-do-supabase.supabase.co',
  supabaseAnonKey || 'public-anon-key'
);
