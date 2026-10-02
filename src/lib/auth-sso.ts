import { SHA256 } from "crypto-js";
import Cookies from "js-cookie";
import { solucoesApi } from "@/lib/sso";

/**
 * Header Basic com o client_id:client_secret (base64), pra autenticar o FRONT-END junto ao SSO.
 * Falha explicitamente se a variável não estiver configurada — sem isso, o header sairia como
 * "Basic " vazio, e o SSO responderia 401 (parecendo senha errada do usuário, quando na
 * verdade é configuração de build faltando). Ver AUTENTICACAO.md, seção 2.1.
 */
export function basicAuthHeader(): string {
  const credencial = import.meta.env.VITE_MOBATO_AUTH_FLOW_TOKEN as string | undefined;
  if (!credencial?.trim()) {
    throw new Error(
      "VITE_MOBATO_AUTH_FLOW_TOKEN não configurado: o login no SSO precisa do base64 de " +
        "client_id:client_secret. Preencha o .env e reinicie o servidor de desenvolvimento."
    );
  }
  return `Basic ${credencial.trim()}`;
}

/** O SSO espera a senha como SHA-256 em MAIÚSCULAS — mandar em claro resulta em 401. */
export function hashPassword(password: string): string {
  return SHA256(password).toString();
}

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export type MfaRequiredError = {
  mfaRequired: true;
  mfaToken?: string;
  encodedAuth: string;
};

/**
 * Passo 1 — login com usuário e senha.
 *
 * POST /auth/oauth/token · FormData (não JSON) · grant_type=password
 * Authorization: Basic <client_id:client_secret>
 *
 * Sucesso: 200 com { access_token, expires_in, token_type }.
 * MFA exigido: 403 com { mfa_token } no corpo — NÃO é erro, é sinal de fluxo (ver signIn em
 * login-page.tsx). Aqui só propagamos os dados necessários pra tela tratar isso.
 */
export async function signIn(username: string, password: string): Promise<TokenResponse> {
  const hashedPassword = hashPassword(password).toUpperCase();

  const body = new FormData();
  body.append("username", username);
  body.append("grant_type", "password");
  body.append("password", hashedPassword);

  const response = await solucoesApi.post<TokenResponse>("/auth/oauth/token", body, {
    headers: { Authorization: basicAuthHeader() },
  });
  return response.data;
}

/**
 * Passo 2 — dispara o código de MFA por e-mail.
 *
 * PUT /auth/mfa/email · corpo vazio
 * Authorization: Basic base64(username:SENHA_SHA256_MAIUSCULA) — as credenciais do USUÁRIO,
 * não do client. É a diferença em relação aos outros dois passos.
 */
export async function sendMfaEmail(encodedAuth: string): Promise<void> {
  await solucoesApi.put(
    "/auth/mfa/email",
    {},
    { headers: { Authorization: `Basic ${encodedAuth}` } }
  );
}

/**
 * Passo 3 — valida o código recebido por e-mail e obtém o token de verdade.
 *
 * Mesma rota do passo 1, mesmo Authorization (Basic do client), mudando grant_type pra "mfa" e
 * enviando mfa_code + mfa_token.
 */
export async function validateMfa(mfaCode: string, mfaToken: string): Promise<TokenResponse> {
  const body = new FormData();
  body.append("mfa_code", mfaCode);
  body.append("grant_type", "mfa");
  body.append("mfa_token", mfaToken);

  const response = await solucoesApi.post<TokenResponse>("/auth/oauth/token", body, {
    headers: { Authorization: basicAuthHeader() },
  });
  return response.data;
}

// --- Persistência do estado intermediário do MFA -------------------------------------------
//
// O blob (username:senha-hash) vai pro sessionStorage — não localStorage — porque contém a
// senha derivada e não deve sobreviver ao fechamento da aba. É usado só pra "reenviar código".
const MFA_AUTH_KEY = "mfa_auth";

export function persistMfaAuth(encodedAuth: string): void {
  sessionStorage.setItem(MFA_AUTH_KEY, encodedAuth);
}

export function getMfaAuth(): string | null {
  return sessionStorage.getItem(MFA_AUTH_KEY);
}

export function clearMfaAuth(): void {
  sessionStorage.removeItem(MFA_AUTH_KEY);
}

export function persistMfaToken(mfaToken: string): void {
  Cookies.set("mfa_token", mfaToken);
}

export function getMfaToken(): string | undefined {
  return Cookies.get("mfa_token");
}

export function clearMfaToken(): void {
  Cookies.remove("mfa_token");
}

/** Monta o blob base64(username:senha-hash) usado no PUT /auth/mfa/email. */
export function montarEncodedAuth(username: string, senhaHashMaiuscula: string): string {
  return btoa(`${username}:${senhaHashMaiuscula}`);
}
