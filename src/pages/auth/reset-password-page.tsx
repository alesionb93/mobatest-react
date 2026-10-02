import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthShell } from "@/pages/auth/auth-shell";
import { PasswordInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    toast.success("Senha atualizada com sucesso.");
    navigate("/", { replace: true });
  }

  return (
    <AuthShell title="Definir nova senha" subtitle="Escolha uma nova senha para sua conta">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordInput
          label="Nova senha"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
        />
        <PasswordInput
          label="Confirmar nova senha"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repita a senha"
        />
        {error && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </AuthShell>
  );
}

export { ResetPasswordPage };
