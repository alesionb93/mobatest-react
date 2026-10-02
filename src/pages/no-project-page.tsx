import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

function NoProjectPage() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <EmptyState
          icon={FolderKanban}
          message="Você ainda não faz parte de nenhum projeto. Peça para um admin te convidar, ou crie um novo projeto."
        />
        <Button variant="secondary" className="w-full mt-2" onClick={() => signOut()}>
          Sair
        </Button>
      </div>
    </div>
  );
}

export { NoProjectPage };
