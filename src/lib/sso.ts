import axios from "axios";

const BASE_URL_WA_SOLUCOES = import.meta.env.VITE_WA_AUTH_BASE_URL_SOLUCOES as string;

/**
 * Instância axios SEPARADA da usada pra falar com nossa própria API — bases e esquemas de
 * autorização diferentes (esta usa Basic auth com credenciais do client/usuário, nossa API usa
 * Bearer token). Ver AUTENTICACAO.md, seção 2.2.
 */
export const solucoesApi = axios.create({ baseURL: BASE_URL_WA_SOLUCOES });

// Reavalia a base a cada requisição: permite sobrescrita por localStorage em ambiente de teste
// (útil se algum dia precisarmos apontar pra um SSO de homologação sem rebuild).
solucoesApi.interceptors.request.use((config) => {
  config.baseURL = localStorage.getItem("api_solucoes_url") || BASE_URL_WA_SOLUCOES;
  return config;
});
