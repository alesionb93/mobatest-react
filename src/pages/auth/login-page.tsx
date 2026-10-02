import * as React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";
import { AuthShell } from "@/pages/auth/auth-shell";
import { Input, PasswordInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    const from = (location.state as { from?: string })?.from ?? "/";
    navigate(from, { replace: true });
  }

  return (
    <AuthShell
      title="Bem-vindo(a)"
      subtitle="Gestão de testes de QA"
      footer={
        <>
          Não tem conta?{" "}
          <Link id="link-criar-conta" to="/signup" className="text-brand font-medium hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="input-email"
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail size={16} />}
          placeholder="voce@empresa.com"
        />
        <div className="flex flex-col gap-1.5">
          <PasswordInput
            id="input-senha"
            label="Senha"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Link id="link-esqueceu-senha" to="/forgot-password" className="self-end text-xs text-brand hover:underline">
            Esqueceu a senha?
          </Link>
        </div>
        {error && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Button id="btn-entrar" type="submit" disabled={submitting} className="w-full">
          {submitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}

export { LoginPage };
