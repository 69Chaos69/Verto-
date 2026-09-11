// ============================================================
// src/auth.js — Autenticação via Supabase Auth
// ============================================================
// Estratégia: o usuário digita apenas um "nome de usuário".
// Internamente, convertemos para email: {username}@verto.local
// O Supabase Auth exige um email, mas o usuário nunca precisa
// saber disso — para ele é apenas um nome de usuário + senha.
// ============================================================

import { supabaseClient } from './supabase.js';

/**
 * Converte um nome de usuário em um email fictício para o Supabase.
 * @param {string} username
 * @returns {string}
 */
function toEmail(username) {
  return `${username.trim().toLowerCase()}@verto.local`;
}

/**
 * Retorna a sessão atual (ou null se não autenticado).
 * @returns {Promise<import('@supabase/supabase-js').Session|null>}
 */
export async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

/**
 * Registra um novo usuário.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ user: object, error: string|null }>}
 */
export async function signUp(username, password) {
  const email = toEmail(username);

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      // Armazena o username real nos metadados do usuário
      data: { username: username.trim().toLowerCase() }
    }
  });

  if (error) {
    // Traduz erros comuns para PT-BR
    if (error.message.includes('already registered')) {
      return { user: null, error: 'Este nome de usuário já está em uso.' };
    }
    if (error.message.includes('Password should be')) {
      return { user: null, error: 'A senha deve ter pelo menos 6 caracteres.' };
    }
    return { user: null, error: error.message };
  }

  // Extrai o username dos metadados para expor ao app
  const user = {
    id: data.user.id,
    username: data.user.user_metadata?.username || username.trim().toLowerCase()
  };

  return { user, error: null };
}

/**
 * Autentica um usuário existente.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ user: object, error: string|null }>}
 */
export async function signIn(username, password) {
  const email = toEmail(username);

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { user: null, error: 'Usuário ou senha incorretos.' };
    }
    return { user: null, error: error.message };
  }

  const user = {
    id: data.user.id,
    username: data.user.user_metadata?.username || username.trim().toLowerCase()
  };

  return { user, error: null };
}

/**
 * Encerra a sessão do usuário atual.
 * @returns {Promise<void>}
 */
export async function signOut() {
  await supabaseClient.auth.signOut();
}

/**
 * Retorna o usuário atual da sessão ativa, ou null.
 * @returns {Promise<{ id: string, username: string }|null>}
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return {
    id: session.user.id,
    username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'usuário'
  };
}
