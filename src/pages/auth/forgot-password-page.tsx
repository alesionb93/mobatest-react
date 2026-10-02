import * as React from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { AuthShell } from "@/pages/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await requestPasswordReset(email);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title="Link enviado" subtitle="Confira seu e-mail">
        <p className="text-sm text-muted-foreground text-center">
          Se houver uma conta com o e-mail <strong className="text-foreground">{email}</strong>,
          enviamos um link para redefinir a senha.
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
    <AuthShell title="Esqueceu a senha?" subtitle="Enviaremos um link de redefinição por e-mail">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        {error && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Enviando..." : "Enviar link"}
        </Button>
        <Link to="/login" className="text-center text-sm text-muted-foreground hover:text-foreground">
          Voltar para o login
        </Link>
      </form>
    </AuthShell>
  );
}

export { ForgotPasswordPage };
