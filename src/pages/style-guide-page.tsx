import { useEffect, useState } from "react";
import { Search, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, PasswordInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox, Switch } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { Skeleton, EmptyState } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type ConnectionStatus = "checking" | "ok" | "error";

function SupabaseConnectionCheck() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      // Leitura somente-diagnóstico: não afeta nenhum dado.
      const { error, count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (cancelled) return;
      if (error) {
        setStatus("error");
        setDetail(error.message);
      } else {
        setStatus("ok");
        setDetail(
          count !== null
            ? `Consulta respondeu (${count} linha(s) visível(is) para este usuário/RLS).`
            : "Consulta respondeu com sucesso."
        );
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexão com Supabase</CardTitle>
        <CardDescription>
          Teste somente-leitura na tabela <code>profiles</code> — confirma URL/chave, não altera nada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        {status === "checking" && <Badge variant="neutral" dot>Verificando...</Badge>}
        {status === "ok" && <Badge variant="success" dot>Conectado</Badge>}
        {status === "error" && <Badge variant="danger" dot>Erro</Badge>}
        <span className="text-sm text-muted-foreground">{detail}</span>
      </CardContent>
    </Card>
  );
}

function StyleGuidePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [checked, setChecked] = useState<boolean | "indeterminate">(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [env, setEnv] = useState("staging");

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-3xl flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mobatest — Style Guide</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vitrine dos tokens e componentes base do design system Veiser Dados.
          </p>
        </div>

        <SupabaseConnectionCheck />

        <Card>
          <CardHeader>
            <CardTitle>Botões</CardTitle>
            <CardDescription>Variantes primary / secondary / danger / ghost</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => toast.success("Ação concluída")}>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="danger">Excluir</Button>
            <Button variant="ghost">Ghost</Button>
            <Button size="sm" variant="primary">Pequeno</Button>
            <Button size="lg" variant="primary">Grande</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badges de status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="success" dot>Ativo</Badge>
            <Badge variant="danger" dot>Falhou</Badge>
            <Badge variant="info" dot>Homologação</Badge>
            <Badge variant="warning" dot>Pendente</Badge>
            <Badge variant="neutral">Neutro</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Formulário</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 max-w-sm">
            <Input label="E-mail" placeholder="voce@empresa.com" leftIcon={<Mail size={16} />} />
            <PasswordInput label="Senha" placeholder="••••••••" />
            <Select
              label="Ambiente"
              value={env}
              onChange={setEnv}
              options={[
                { value: "staging", label: "Homologação" },
                { value: "prod", label: "Produção" },
                { value: "other", label: "Outro" },
              ]}
            />
            <Textarea label="Descrição" placeholder="Passos para reproduzir..." />
            <div className="flex items-center gap-2">
              <Checkbox checked={checked} onCheckedChange={setChecked} aria-label="Selecionar caso" />
              <span className="text-sm">Selecionar todos os casos</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={switchOn} onCheckedChange={setSwitchOn} aria-label="Membro ativo" />
              <span className="text-sm">Membro ativo</span>
            </div>
            <Input placeholder="Buscar caso de teste" leftIcon={<Search size={16} />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loading / Empty state</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
            <EmptyState message="Nenhum caso de teste encontrado nesta suíte." />
          </CardContent>
        </Card>

        <div>
          <Button onClick={() => setModalOpen(true)}>Abrir modal de exemplo</Button>
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Cancelar execução"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Voltar</Button>
              <Button variant="danger" onClick={() => setModalOpen(false)}>Confirmar cancelamento</Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">
            Este é um modal de exemplo, com fechamento ao clicar fora habilitado (padrão).
          </p>
        </Modal>
      </div>
    </div>
  );
}

export { StyleGuidePage };
