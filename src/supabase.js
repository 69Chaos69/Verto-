// ============================================================
// src/supabase.js — Inicialização do cliente Supabase
// ============================================================
// Usa o SDK do Supabase carregado via CDN no index.html.
// O objeto `supabase` global é exposto pelo CDN como
// window.supabase (do pacote @supabase/supabase-js).
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const { createClient } = window.supabase;

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persiste a sessão no localStorage automaticamente
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});
