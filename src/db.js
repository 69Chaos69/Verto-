// ============================================================
// src/db.js — Leitura e escrita de dados via Supabase
// ============================================================
// Substitui as chamadas fetch() ao servidor SQLite caseiro.
// Todos os dados ficam na tabela `user_data` do Supabase,
// protegida por Row Level Security — cada usuário só acessa
// os seus próprios dados.
// ============================================================

import { supabaseClient } from './supabase.js';

/** Estrutura padrão de dados vazia */
const EMPTY_DATA = {
  products: [],
  sales: [],
  rentalProducts: [],
  rentals: [],
  loans: []
};

/**
 * Busca todos os dados do usuário autenticado no Supabase.
 * @returns {Promise<object>} dados do usuário ou estrutura vazia
 */
export async function fetchData() {
  const { data, error } = await supabaseClient
    .from('user_data')
    .select('data_json, updated_at')
    .single();

  if (error) {
    // PGRST116 = nenhuma linha encontrada (usuário sem dados ainda)
    if (error.code === 'PGRST116') {
      return { ...EMPTY_DATA };
    }
    console.warn('[db] Erro ao buscar dados:', error.message);
    return { ...EMPTY_DATA };
  }

  return {
    ...EMPTY_DATA,
    ...data.data_json,
    serverUpdatedAt: data.updated_at
  };
}

/**
 * Salva/sincroniza todos os dados do usuário autenticado no Supabase.
 * Usa UPSERT para criar ou atualizar a linha.
 * @param {string} userId - UUID do usuário autenticado
 * @param {object} payload - { products, sales, rentalProducts, rentals, loans }
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function syncData(userId, payload) {
  const dataToSave = {
    products:       Array.isArray(payload.products)       ? payload.products       : [],
    sales:          Array.isArray(payload.sales)          ? payload.sales          : [],
    rentalProducts: Array.isArray(payload.rentalProducts) ? payload.rentalProducts : [],
    rentals:        Array.isArray(payload.rentals)        ? payload.rentals        : [],
    loans:          Array.isArray(payload.loans)          ? payload.loans          : []
  };

  const { error } = await supabaseClient
    .from('user_data')
    .upsert({
      user_id:    userId,
      data_json:  dataToSave,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) {
    console.warn('[db] Erro ao sincronizar dados:', error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}
