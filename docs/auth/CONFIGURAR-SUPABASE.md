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
Visual no padrão dos e-mails da Escola (fundo branco, verde oficial `#27D337`). Assunto só em português (decisão do Filipe em 17/nov/2026); o corpo sai no idioma em que a pessoa criou a conta (`user_metadata.idioma`). O botão aponta para `/api/auth/confirmar` do próprio site — NÃO trocar por `{{ .ConfirmationURL }}`.

### Confirm signup
**Assunto:** `Raio-X · Confirme seu e-mail`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
  <div style="border-bottom:3px solid #27D337;padding-bottom:20px;margin-bottom:28px;">
    <p style="font-size:11px;letter-spacing:3px;color:#999;margin:0 0 4px;">OBSERVATÓRIO CLASSE CREATOR</p>
    <h1 style="font-size:22px;font-weight:bold;color:#111;margin:0;letter-spacing:1px;">RAIO-X</h1>
  </div>
{{ if eq .Data.idioma "en" }}
  <h2 style="font-size:18px;font-weight:bold;color:#111;margin:0 0 12px;">Confirm your email</h2>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">You are one step away from your Raio-X researcher account: organized research projects and twice the daily analysis limit. Click the button below to confirm your email address.</p>
  <a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=en"
    style="display:inline-block;background:#27D337;color:#0a0a0a;font-weight:bold;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
    CONFIRM EMAIL
  </a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;line-height:1.6;">If you did not create a Raio-X account, ignore this email.<br>This link expires in 1 hour and works only once.</p>
{{ else if eq .Data.idioma "es" }}
  <h2 style="font-size:18px;font-weight:bold;color:#111;margin:0 0 12px;">Confirma tu e-mail</h2>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">Estás a un paso de tener tu cuenta de investigador en Raio-X: proyectos de investigación organizados y el doble del límite diario de análisis. Haz clic en el botón de abajo para confirmar tu dirección de e-mail.</p>
  <a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=es"
    style="display:inline-block;background:#27D337;color:#0a0a0a;font-weight:bold;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
    CONFIRMAR E-MAIL
  </a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;line-height:1.6;">Si no creaste una cuenta en Raio-X, ignora este e-mail.<br>Este enlace expira en 1 hora y funciona una sola vez.</p>
{{ else }}
  <h2 style="font-size:18px;font-weight:bold;color:#111;margin:0 0 12px;">Confirme seu e-mail</h2>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">Você está a um passo de ter sua conta de pesquisador no Raio-X: projetos de pesquisa organizados e o dobro do limite diário de análises. Clique no botão abaixo para confirmar seu endereço de e-mail.</p>
  <a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=pt"
    style="display:inline-block;background:#27D337;color:#0a0a0a;font-weight:bold;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
    CONFIRMAR E-MAIL
  </a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;line-height:1.6;">Se você não criou uma conta no Raio-X, ignore este e-mail.<br>Este link expira em 1 hora e funciona uma vez só.</p>
{{ end }}
  <p style="font-size:12px;color:#bbb;margin:16px 0 0;">— Raio-X · Observatório Classe Creator</p>
</div>
```

### Magic Link
**Assunto:** `Raio-X · Seu link de acesso`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
  <div style="border-bottom:3px solid #27D337;padding-bottom:20px;margin-bottom:28px;">
    <p style="font-size:11px;letter-spacing:3px;color:#999;margin:0 0 4px;">OBSERVATÓRIO CLASSE CREATOR</p>
    <h1 style="font-size:22px;font-weight:bold;color:#111;margin:0;letter-spacing:1px;">RAIO-X</h1>
  </div>
{{ if eq .Data.idioma "en" }}
  <h2 style="font-size:18px;font-weight:bold;color:#111;margin:0 0 12px;">Your sign-in link</h2>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">Click the button below to sign in to your Raio-X account. No password needed.</p>
  <a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=en"
    style="display:inline-block;background:#27D337;color:#0a0a0a;font-weight:bold;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
    SIGN IN TO RAIO-X
  </a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;line-height:1.6;">If you did not ask for this link, ignore this email: nobody can sign in to your account without it.<br>This link expires in 1 hour and works only once.</p>
{{ else if eq .Data.idioma "es" }}
  <h2 style="font-size:18px;font-weight:bold;color:#111;margin:0 0 12px;">Tu enlace de acceso</h2>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">Haz clic en el botón de abajo para entrar en tu cuenta de Raio-X. No necesitas contraseña.</p>
  <a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=es"
    style="display:inline-block;background:#27D337;color:#0a0a0a;font-weight:bold;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
    ENTRAR EN RAIO-X
  </a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;line-height:1.6;">Si no pediste este enlace, ignora este e-mail: nadie entra en tu cuenta sin él.<br>Este enlace expira en 1 hora y funciona una sola vez.</p>
{{ else }}
  <h2 style="font-size:18px;font-weight:bold;color:#111;margin:0 0 12px;">Seu link de acesso</h2>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">Clique no botão abaixo para entrar na sua conta do Raio-X. Não precisa de senha.</p>
  <a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=email&idioma=pt"
    style="display:inline-block;background:#27D337;color:#0a0a0a;font-weight:bold;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
    ENTRAR NO RAIO-X
  </a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;line-height:1.6;">Se você não pediu este link, ignore este e-mail: ninguém entra na sua conta sem ele.<br>Este link expira em 1 hora e funciona uma vez só.</p>
{{ end }}
  <p style="font-size:12px;color:#bbb;margin:16px 0 0;">— Raio-X · Observatório Classe Creator</p>
</div>
```

### Reset Password
**Assunto:** `Raio-X · Crie uma nova senha`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
  <div style="border-bottom:3px solid #27D337;padding-bottom:20px;margin-bottom:28px;">
    <p style="font-size:11px;letter-spacing:3px;color:#999;margin:0 0 4px;">OBSERVATÓRIO CLASSE CREATOR</p>
    <h1 style="font-size:22px;font-weight:bold;color:#111;margin:0;letter-spacing:1px;">RAIO-X</h1>
  </div>
{{ if eq .Data.idioma "en" }}
  <h2 style="font-size:18px;font-weight:bold;color:#111;margin:0 0 12px;">Set a new password</h2>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">We received a request to change the password of your Raio-X account. Click the button below to set your new password.</p>
  <a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&idioma=en"
    style="display:inline-block;background:#27D337;color:#0a0a0a;font-weight:bold;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
    SET NEW PASSWORD
  </a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;line-height:1.6;">If you did not ask for this, ignore this email: your password stays the same.<br>This link expires in 1 hour and works only once.</p>
{{ else if eq .Data.idioma "es" }}
  <h2 style="font-size:18px;font-weight:bold;color:#111;margin:0 0 12px;">Crea una nueva contraseña</h2>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">Recibimos un pedido para cambiar la contraseña de tu cuenta de Raio-X. Haz clic en el botón de abajo para crear la nueva contraseña.</p>
  <a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&idioma=es"
    style="display:inline-block;background:#27D337;color:#0a0a0a;font-weight:bold;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
    CREAR NUEVA CONTRASEÑA
  </a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;line-height:1.6;">Si no lo pediste, ignora este e-mail: tu contraseña sigue igual.<br>Este enlace expira en 1 hora y funciona una sola vez.</p>
{{ else }}
  <h2 style="font-size:18px;font-weight:bold;color:#111;margin:0 0 12px;">Crie uma nova senha</h2>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">Recebemos um pedido para trocar a senha da sua conta do Raio-X. Clique no botão abaixo para criar a nova senha.</p>
  <a href="{{ .SiteURL }}/api/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&idioma=pt"
    style="display:inline-block;background:#27D337;color:#0a0a0a;font-weight:bold;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
    CRIAR NOVA SENHA
  </a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;line-height:1.6;">Se você não pediu isso, ignore este e-mail: sua senha continua a mesma.<br>Este link expira em 1 hora e funciona uma vez só.</p>
{{ end }}
  <p style="font-size:12px;color:#bbb;margin:16px 0 0;">— Raio-X · Observatório Classe Creator</p>
</div>
```

## 6. Já feito
- SMTP com a Resend (`smtp.resend.com`, porta 465, remetente `nao-responda@classecreator.com`) — feito pelo Filipe em 17/nov/2026.
- Vercel Analytics ligado — feito pelo Filipe em 17/nov/2026.
