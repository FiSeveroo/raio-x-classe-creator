# Contas do Raio-X — configuração no Supabase e na Vercel

Feito uma vez, pelo Filipe, nos painéis (o Claude não tem acesso). Decisões de 17/nov/2026.

## 1. Banco
SQL Editor → colar e rodar `docs/sql/contas.sql`. Deve terminar em "Success".

## 2. Chave secreta (servidor)
O site passa a usar a **secret key** do Supabase, só no servidor, para: somar o uso diário de cada conta, limites personalizados, apagar conta, abrir o link de leitura e o painel "Contas".

- Supabase → Project Settings → API Keys → copiar a **secret key** (`sb_secret_…`).
- Vercel → projeto `raio-x-classe-creator-v2` → Settings → Environment Variables → nova variável `SUPABASE_SECRET_KEY`, ambientes **Production** e **Preview**. Nunca marcar como pública, nunca colar no chat.
- Para testar no computador: acrescentar a mesma linha no `.env.local`.

Sem essa chave, o site continua funcionando e simplesmente não mostra "Entrar".

## 3. Authentication → URL Configuration
- **Site URL:** `https://raiox.classecreator.com`
- **Redirect URLs:** `https://raiox.classecreator.com/**` e `http://localhost:3000/**`

## 4. Authentication → Providers → Email
- **Enable Email provider:** ligado
- **Confirm email:** ligado
- **Minimum password length:** 10
- **Secure email change:** ligado

## 5. Authentication → Emails → Templates
Os links apontam para `/api/auth/confirmar` do próprio site (não para o Supabase), com o idioma em que a pessoa usava o site. Copiar assunto e corpo de cada um:

### Confirm signup
**Assunto:** `Raio-X · confirme seu e-mail / confirm your email / confirma tu e-mail`

```html
{{ if eq .Data.idioma "en" }}
<h2>Confirm your email</h2>
<p>Click to confirm your Raio-X researcher account:</p>
<p><a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=en">Confirm my email</a></p>
<p>If you didn't ask for this, just ignore this message.</p>
{{ else if eq .Data.idioma "es" }}
<h2>Confirma tu e-mail</h2>
<p>Haz clic para confirmar tu cuenta de investigador en Raio-X:</p>
<p><a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=es">Confirmar mi e-mail</a></p>
<p>Si no lo pediste, ignora este mensaje.</p>
{{ else }}
<h2>Confirme seu e-mail</h2>
<p>Clique para confirmar sua conta de pesquisador no Raio-X:</p>
<p><a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=pt">Confirmar meu e-mail</a></p>
<p>Se você não pediu isso, é só ignorar esta mensagem.</p>
{{ end }}
<p>— Raio-X · Observatório Classe Creator</p>
```

### Magic Link
**Assunto:** `Raio-X · seu link de acesso / your sign-in link / tu enlace de acceso`

```html
{{ if eq .Data.idioma "en" }}
<h2>Your sign-in link</h2>
<p><a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=en">Sign in to Raio-X</a></p>
<p>The link is valid for 1 hour and works only once. If you didn't ask for it, ignore this message.</p>
{{ else if eq .Data.idioma "es" }}
<h2>Tu enlace de acceso</h2>
<p><a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=es">Entrar en Raio-X</a></p>
<p>El enlace vale por 1 hora y funciona una sola vez. Si no lo pediste, ignora este mensaje.</p>
{{ else }}
<h2>Seu link de acesso</h2>
<p><a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=pt">Entrar no Raio-X</a></p>
<p>O link vale por 1 hora e funciona uma vez só. Se você não pediu, ignore esta mensagem.</p>
{{ end }}
<p>— Raio-X · Observatório Classe Creator</p>
```

### Reset Password
**Assunto:** `Raio-X · nova senha / new password / nueva contraseña`

```html
{{ if eq .Data.idioma "en" }}
<h2>Set a new password</h2>
<p><a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&idioma=en">Set my new password</a></p>
<p>If you didn't ask for this, ignore this message: your password stays the same.</p>
{{ else if eq .Data.idioma "es" }}
<h2>Crea una nueva contraseña</h2>
<p><a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&idioma=es">Crear mi nueva contraseña</a></p>
<p>Si no lo pediste, ignora este mensaje: tu contraseña sigue igual.</p>
{{ else }}
<h2>Crie uma nova senha</h2>
<p><a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&idioma=pt">Criar minha nova senha</a></p>
<p>Se você não pediu isso, ignore esta mensagem: sua senha continua a mesma.</p>
{{ end }}
<p>— Raio-X · Observatório Classe Creator</p>
```

## 6. Já feito
- SMTP com a Resend (`smtp.resend.com`, porta 465, remetente `nao-responda@classecreator.com`) — feito pelo Filipe em 17/nov/2026.
- Vercel Analytics ligado — feito pelo Filipe em 17/nov/2026.
