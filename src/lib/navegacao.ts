import {
  BookOpen,
  FileSearch,
  Home,
  Info,
  MessagesSquare,
  Search,
  Swords,
  Thermometer,
  type LucideIcon,
} from "lucide-react";

export type ChaveModulo = "lupa" | "termometro" | "disputa" | "dossie" | "voz";

export type ItemNav = {
  chave: ChaveModulo | "home" | "biblioteca" | "sobre";
  href: string;
  icone: LucideIcon;
  /** Código ?m= do Streamlit — usado para linkar a versão atual. */
  codigoLegado: string;
};

export const MODULOS: (ItemNav & { chave: ChaveModulo })[] = [
  { chave: "lupa", href: "/lupa", icone: Search, codigoLegado: "lupa" },
  { chave: "termometro", href: "/termometro", icone: Thermometer, codigoLegado: "term" },
  { chave: "disputa", href: "/disputa", icone: Swords, codigoLegado: "disp" },
  { chave: "dossie", href: "/dossie", icone: FileSearch, codigoLegado: "doss" },
  { chave: "voz", href: "/voz", icone: MessagesSquare, codigoLegado: "voz" },
];

export const PROJETO: ItemNav[] = [
  { chave: "home", href: "/", icone: Home, codigoLegado: "home" },
  { chave: "biblioteca", href: "/biblioteca", icone: BookOpen, codigoLegado: "bib" },
  { chave: "sobre", href: "/sobre", icone: Info, codigoLegado: "sobre" },
];

