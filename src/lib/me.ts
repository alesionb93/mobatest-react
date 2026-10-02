import { api } from "@/lib/api";

/** Espelha o enum Perfil do backend (AUTENTICACAO.md, seção 5.2) — ordem importa lá, não aqui. */
export type Perfil = "GESTOR" | "ADMIN";

const TODOS_OS_PERFIS: Perfil[] = ["GESTOR", "ADMIN"];

/**
 * `perfil` nulo é estado LEGÍTIMO, não erro: quem autentica no SSO corporativo inteiro não
 * necessariamente tem acesso a ESTA aplicação (ainda não foi cadastrado, ou foi desativado).
 */
export type MeDto = {
  login: string;
  nome: string | null;
  email: string | null;
  perfil: Perfil | null;
};

/** GET /v1/me — identidade + perfil ativo. Exige token válido, não exige perfil específico. */
export async function fetchUserIdentity(): Promise<MeDto> {
  const response = await api.get<MeDto>("/v1/me");
  return response.data;
}

/** Autorizado quando o /me devolve um perfil conhecido — fail-closed, sem perfil = sem acesso. */
export function isUserAuthorized(identity: MeDto | null | undefined): boolean {
  const perfil = identity?.perfil;
  if (!perfil) return false;
  return TODOS_OS_PERFIS.includes(perfil);
}
