import * as React from "react";
import { supabase } from "@/lib/supabase";

export interface DevOption {
  id: string;
  name: string;
  inactive?: boolean;
}

/**
 * Os devs cadastrados (contatos ativos do tipo dev) pra escolher o dev responsável. O dev que já está escolhido
 * continua aparecendo mesmo que tenha sido inativado depois, pra não perdê-lo ao editar.
 */
export function useDevOptions(open: boolean, currentDevId: string | null): DevOption[] {
  const [devs, setDevs] = React.useState<DevOption[]>([]);
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.from("contacts").select("id, name").eq("kind", "dev").eq("is_active", true).order("name");
      const list = [...((data ?? []) as DevOption[])];
      if (currentDevId && !list.some((d) => d.id === currentDevId)) {
        const { data: current } = await supabase.from("contacts").select("id, name").eq("id", currentDevId).maybeSingle();
        if (current) list.push({ ...(current as DevOption), inactive: true });
      }
      if (alive) setDevs(list);
    })();
    return () => {
      alive = false;
    };
  }, [open, currentDevId]);
  return devs;
}
