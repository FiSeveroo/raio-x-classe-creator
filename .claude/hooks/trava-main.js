// Trava do branch main (Raio-X): impede qualquer chat de dar push ou merge no
// `main` do repo, onde rodam o coletor e os workflows agendados. Mudança no
// main entra só por PR, com merge feito pelo Filipe.
// Hook PreToolUse (Bash e PowerShell) configurado em .claude/settings.json.

const { execFileSync } = require("node:child_process");

let entrada = "";
process.stdin.on("data", (c) => (entrada += c));
process.stdin.on("end", () => {
  let dados;
  try {
    dados = JSON.parse(entrada);
  } catch {
    return; // entrada inesperada: não bloqueia
  }
  const comando = String(dados?.tool_input?.command ?? "");
  const motivo = avaliar(comando, dados?.cwd);
  if (!motivo) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `Trava do main: ${motivo}. No Raio-X, mudança no main entra só por PR ` +
          "(branch próprio + gh pr create), e o merge é do Filipe. " +
          "Se ele pedir explicitamente, ele mesmo faz o merge pelo GitHub.",
      },
    }),
  );
});

function avaliar(comando, cwd) {
  // Avalia cada trecho separado por ; && || | e quebras de linha.
  for (const trecho of comando.split(/;|&&|\|\||\||\r?\n/)) {
    const t = trecho.trim();

    if (/\bgh\s+pr\s+merge\b/.test(t)) return "merge de PR pelo gh";
    if (/\bgh\s+api\b.*\/pulls\/\d+\/merge\b/.test(t)) return "merge de PR pela API";
    if (/\bgh\s+api\b.*\/merges\b/.test(t)) return "merge pela API";

    const push = t.match(/\bgit\b(?:\s+-[cC]\s+\S+)*\s+push\b(.*)$/);
    if (!push) continue;
    const resto = push[1];
    if (/--(all|mirror)\b/.test(resto)) return "push de todos os branches";
    // refspec que termina em main: "main", "HEAD:main", "x:refs/heads/main", "+main"
    if (/(^|\s|:|\+|refs\/heads\/)main(\s|$)/.test(resto)) return "push para o main";
    // "git push" sem refspec explícito: depende do branch atual
    const args = resto.split(/\s+/).filter((a) => a && !a.startsWith("-"));
    if (args.length <= 1 && branchAtual(cwd) === "main") {
      return "push a partir de um checkout no main";
    }
  }
  return null;
}

function branchAtual(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: cwd || process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
