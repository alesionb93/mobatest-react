import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Classes para qualquer bloco que renderize HTML rico via
 * dangerouslySetInnerHTML (cards de defeito, descrição do Jira, campos
 * de caso de teste). O preflight do Tailwind zera margin de <p>/<ul>/etc,
 * então sem isso o texto injetado fica "colado" — precisa reintroduzir
 * espaçamento entre blocos manualmente.
 */
export const richTextClasses =
  "[&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:mb-3 [&_hr]:border-border [&_hr]:my-4 [&_strong]:font-semibold [&_h1]:font-semibold [&_h1]:mb-2 [&_h1]:mt-3 [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-2.5 [&_pre]:mb-3 [&_pre]:max-h-72 [&_pre]:overflow-auto [&_details]:mb-3 [&_details]:rounded-md [&_details]:border [&_details]:border-border [&_details]:p-2 [&_summary]:cursor-pointer [&_summary]:text-xs [&_summary]:text-muted-foreground [&_details_pre]:mt-2 [&_details_pre]:mb-0";
