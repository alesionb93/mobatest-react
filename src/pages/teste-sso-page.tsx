import * as React from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { AuthShell } from "@/pages/auth/auth-shell";
import { Input, PasswordInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  signIn,
  sendMfaEmail,
  hashPassword,
  montarEncodedAuth,
  persistMfaAuth,
  persistMfaToken,
} from "@/lib/auth-sso";

/**
 * Tela de teste do fluxo SSO — passo 1 (usuário e senha). Não está ligada ao `auth-context.tsx`
 * nem a nenhuma outra parte do app de propósito (ver decisão registrada na conversa: religar o
 * login real depende de religar as telas de dado juntas, pra não quebrar o RLS do Supabase).
 *
 * Sem MFA: mostra o token aqui mesmo. Com MFA: navega pra `/multifactor` — a tela REAL, a
 * mesma que vai ser usada no fluxo de produção quando essa religação acontecer de verdade.
 *
 * Sem link em nenhum menu — acessar direto pela URL: /teste-sso
 */
function TesteSsoPage() {
  const navigate = useNavigate();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [carregando, setCarregando] = React.useState(false);
  const [tokenSemMfa, setTokenSemMfa] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const resposta = await signIn(username, password);
      // Esse usuário não passou por MFA (ex: bypass) — mostra aqui mesmo, não precisa navegar.
      setTokenSemMfa(resposta.access_token);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        const hashedPassword = hashPassword(password).toUpperCase();
        const encodedAuth = montarEncodedAuth(username, hashedPassword);
        const mfaToken = (error.response.data as { mfa_token?: string })?.mfa_token;

        persistMfaAuth(encodedAuth);
        if (mfaToken) persistMfaToken(mfaToken);

        try {
          await sendMfaEmail(encodedAuth);
          navigate("/multifactor", { state: { username, from: "/teste-sso" } });
        } catch {
          setErro("Não consegui enviar o código de verificação. Tente novamente.");
        }
      } else if (!axios.isAxiosError(error)) {
        setErro(error instanceof Error ? error.message : "Erro desconhecido.");
      } else {
        const description = (error.response?.data as { error_description?: string })?.error_description;
        setErro(description ?? "E-mail ou senha incorretos.");
      }
    } finally {
      setCarregando(false);
    }
  }

  if (tokenSemMfa) {
    return (
      <AuthShell title="Token recebido" subtitle="Login sem MFA (bypass nesse usuário)">
        <div className="bg-muted rounded-lg p-3 text-xs font-mono break-all max-h-40 overflow-y-auto">
          {tokenSemMfa}
        </div>
        <Button className="w-full mt-4" onClick={() => setTokenSemMfa(null)}>
          Testar de novo
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Teste do SSO Soluções"
      subtitle="Página isolada de teste — não afeta login nem dados do app"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="teste-sso-username"
          label="Usuário (login do SSO)"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          leftIcon={<Mail size={16} />}
          placeholder="nome.sobrenome"
        />
        <PasswordInput
          id="teste-sso-password"
          label="Senha"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {erro && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}
        <Button id="teste-sso-btn-login" type="submit" disabled={carregando} className="w-full">
          {carregando ? "Entrando..." : "Testar login"}
        </Button>
      </form>
    </AuthShell>
  );
}

export { TesteSsoPage };
