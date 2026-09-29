import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt", "en", "es"],
  defaultLocale: "pt",
  // PT fica sem prefixo (/lupa), EN e ES ganham prefixo (/en/lupa, /es/lupa).
  // Mantém as URLs em português limpas no domínio principal.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
