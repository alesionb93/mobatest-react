import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MailCheck, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/pages/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  sendMfaEmail,
  validateMfa,
  getMfaAuth,
  getMfaToken,
  clearMfaAuth,
  clearMfaToken,
} from "@/lib/auth-sso";

type LocationState = {
  username?: string;
  /** Pra onde voltar depois de completar o login (mesma convenção do login-page.tsx). */
  from?: string;
};

/**
 * Tela real de verificação por e-mail (MFA) — segunda etapa do login pelo SSO Soluções.
 * Espera chegar aqui via `navigate("/multifactor", { state: { username } })`, depois de um
 * `403` no login (ver AUTENTICACAO.md, seção 2.4). O blob de autenticação e o `mfa_token` já
 * foram persistidos nesse momento (sessionStorage / cookie) — esta tela só usa o que já existe.
 */
function MultifactorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) ?? {};

  const [codigo, setCodigo] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [reenviando, setReenviando] = React.useState(false);
  const [reenviado, setReenviado] = React.useState(false);
  const [tokenConfirmado, setTokenConfirmado] = React.useState<string | null>(null);

  // Sem sessão de MFA pendente (ex: usuário chegou aqui direto pela URL) — volta pro login.
  React.useEffect(() => {
    if (!tokenConfirmado && (!getMfaAuth() || !getMfaToken())) {
      navigate("/login", { replace: true });
    }
  }, [navigate, tokenConfirmado]);

  async function handleConfirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const mfaToken = getMfaToken();
    if (!mfaToken) {
      setErro("Sessão de verificação expirada. Volte e faça login novamente.");
      return;
    }

    setEnviando(true);
    try {
      const tokenData = await validateMfa(codigo, mfaToken);
      clearMfaAuth();
      clearMfaToken();

      // TODO(religação real): quando auth-context.tsx passar a usar o SSO de verdade, troca o
      // estado de sucesso abaixo por completeLogin(tokenData.access_token) — ela persiste o
      // token, busca /v1/me, e navega de acordo com o perfil, sem precisar dessa tela intermediária.
      setTokenConfirmado(tokenData.access_token);
    } catch {
      setErro("Código inválido ou expirado. Confira o e-mail e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleReenviar() {
    const encodedAuth = getMfaAuth();
    if (!encodedAuth) {
      setErro("Sessão de verificação expirada. Volte e faça login novamente.");
      return;
    }
    setErro(null);
    setReenviando(true);
    try {
      await sendMfaEmail(encodedAuth);
      setReenviado(true);
      setTimeout(() => setReenviado(false), 4000);
    } catch {
      setErro("Não consegui reenviar o código. Tente novamente em instantes.");
    } finally {
      setReenviando(false);
    }
  }

  if (tokenConfirmado) {
    return (
      <AuthShell title="Verificado com sucesso" subtitle="O token do SSO foi recebido de verdade">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={22} />
          </div>
        </div>
        <div className="bg-muted rounded-lg p-3 text-xs font-mono break-all max-h-40 overflow-y-auto">
          {tokenConfirmado}
        </div>
        <Button
          className="w-full mt-4"
          onClick={() => navigate(state.from ?? "/", { replace: true })}
        >
          Continuar
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verifique seu e-mail"
      subtitle={
        state.username
          ? `Enviamos um código de 6 dígitos para o e-mail de ${state.username}`
          : "Enviamos um código de 6 dígitos para o seu e-mail"
      }
    >
      <div className="mb-4 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <MailCheck size={22} />
        </div>
      </div>

      <form onSubmit={handleConfirmar} className="flex flex-col gap-4">
        <Input
          id="input-codigo-mfa"
          label="Código de verificação"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="text-center text-lg tracking-[0.5em]"
        />

        {erro && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}
        {reenviado && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Código reenviado — confira seu e-mail.
          </p>
        )}

        <Button id="btn-confirmar-mfa" type="submit" disabled={enviando || codigo.length !== 6} className="w-full">
          {enviando ? "Verificando..." : "Confirmar código"}
        </Button>

        <button
          id="btn-reenviar-mfa"
          type="button"
          disabled={reenviando}
          onClick={handleReenviar}
          className="text-xs text-muted-foreground hover:text-brand disabled:opacity-50 self-center"
        >
          {reenviando ? "Reenviando..." : "Não recebeu? Reenviar código"}
        </button>
      </form>
    </AuthShell>
  );
}

export { MultifactorPage };
