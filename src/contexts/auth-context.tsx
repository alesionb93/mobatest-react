import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  // O `user` só muda de REFERÊNCIA quando muda a pessoa (ou o cadastro dela). O Supabase re-emite o login (SIGNED_IN /
  // TOKEN_REFRESHED) com uma sessão nova toda vez que a aba volta ao foco e a cada renovação do token (~1h). Se o `user`
  // virasse um objeto novo a cada vez, o ProjectProvider recarregaria os projetos, a tela inteira trocaria por um
  // esqueleto de "carregando" e tudo o que estava aberto (o teste em execução e o contador) sumiria. A `session` continua
  // sendo atualizada normalmente, então o token novo chega a quem precisa dele.
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const applySession = (next: Session | null) => {
      setSession(next);
      setUser((prev) => (isSameUser(prev, next?.user ?? null) ? prev : (next?.user ?? null)));
    };

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applySession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? traduzErro(error.message) : null };
  };

  const signUp: AuthContextValue["signUp"] = async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error ? traduzErro(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const requestPasswordReset: AuthContextValue["requestPasswordReset"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? traduzErro(error.message) : null };
  };

  const updatePassword: AuthContextValue["updatePassword"] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? traduzErro(error.message) : null };
  };

  const value: AuthContextValue = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

/** Mesma pessoa e mesmo cadastro (o `updated_at` só muda quando o cadastro muda, não quando o token é renovado). */
function isSameUser(a: User | null, b: User | null): boolean {
  return a?.id === b?.id && a?.updated_at === b?.updated_at;
}

function traduzErro(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "User already registered": "Já existe uma conta com este e-mail.",
    "Email not confirmed": "Confirme seu e-mail antes de entrar.",
    "Password should be at least 6 characters": "A senha precisa ter pelo menos 6 caracteres.",
  };
  return map[message] ?? message;
}
