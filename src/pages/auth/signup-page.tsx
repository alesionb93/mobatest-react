import * as React from "react";
import { Link } from "react-router-dom";
import { Mail, User } from "lucide-react";
import { AuthShell } from "@/pages/auth/auth-shell";
import { Input, PasswordInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

function SignupPage() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signUp(email, password, fullName);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell title="Confira seu e-mail" subtitle="Falta pouco para começar">
        <p className="text-sm text-muted-foreground text-center">
          Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>.
          Depois de confirmar, você já pode entrar normalmente.
        </p>
        <Link to="/login">
          <Button variant="secondary" className="w-full mt-4">
            Voltar para o login
          </Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Gestão de testes de QA"
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="text-brand font-medium hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome completo"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          leftIcon={<User size={16} />}
          placeholder="Seu nome"
        />
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail size={16} />}
          placeholder="voce@empresa.com"
        />
        <PasswordInput
          label="Senha"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
        />
        {error && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
    </AuthShell>
  );
}

export { SignupPage };
