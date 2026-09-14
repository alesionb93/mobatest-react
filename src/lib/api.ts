import axios from "axios";
import Cookies from "js-cookie";

const BASE_URL = import.meta.env.VITE_BASE_URL as string;

/**
 * Cliente pra NOSSA API (Spring Boot) — diferente do `solucoesApi`, que só existe pra falar com
 * o SSO. Envia o token guardado no cookie como Bearer em toda chamada.
 */
export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * 401 → sessão inválida/expirada, desloga.
 * 403 → sessão válida, só faltou permissão pra ESSA ação específica — nunca desloga aqui
 * (deslogar em 403 tiraria da aplicação alguém que só clicou onde não podia).
 * O tratamento de fato (navegar pro /login, mostrar toast) fica a cargo de quem importa isso,
 * pra não criar dependência circular com o router/toast library aqui.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const evento = new CustomEvent("api-auth-error", { detail: { status: error.response.status } });
      window.dispatchEvent(evento);
    }
    return Promise.reject(error);
  }
);
