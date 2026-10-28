# FOZ Finance

Controle mensal de despesas com rateio Otávio/Giu, status individual, histórico e edição. SPA sem bibliotecas e API privada Cloudflare Workers + D1.

## Privacidade

- O **repositório GitHub pode ser privado**. A interface HTML/CSS/JS é pública na web, mas **não contém dados financeiros**.
- Os dados financeiros ficam no **Cloudflare D1** e só podem ser acessados por uma sessão válida, com cookie `HttpOnly`, `Secure` e `SameSite=Strict`.
- O acesso é por uma senha única configurada em **APP_PIN** no servidor (não aparece no repositório). O PIN `1001` é fraco, apesar do bloqueio de tentativas por IP. Para uso real, prefira senha longa.
- **Nunca envie `GASTOS_FOZ_importacao_privada.json` nem seu Excel ao GitHub.** Importe o JSON no painel, depois de publicado e de fazer login.
- Alterações são sincronizadas no mesmo banco entre celular e computador. Para evitar sobrescritas simultâneas, o backend usa uma revisão do documento e rejeita gravações concorrentes (409).
- A interface não incorpora rastreadores ou CDNs externas.

## Deploy pelo Cloudflare (GitHub opcional)

1. Instale Node.js. Entre nesta pasta e execute `npm install`.
2. Autentique na Cloudflare com `npx wrangler login`.
3. Crie seu banco com `npx wrangler d1 create foz-finance`.
4. Copie o `database_id` retornado para `wrangler.jsonc` no lugar de `COLOQUE_AQUI_ID_DO_D1`.
5. Crie as tabelas com `npm run db:remote`.
6. Execute `npx wrangler secret put APP_PIN` e informe sua senha (por exemplo `1001`). **Não escreva essa senha no código nem no GitHub.**
7. Publique com `npm run deploy`. O comando devolve uma URL `*.workers.dev`.
8. Acesse, entre com a senha, vá em **Dados e backup → Importar dados** e escolha o arquivo privado JSON fornecido separadamente.
9. Opcional: crie um **repositório privado GitHub** e conecte-o no painel Cloudflare em **Workers & Pages → Worker → Settings → Builds → Connect** para deploy automático de novos commits. Os segredos e o banco continuam na Cloudflare.

## Rodar localmente com backend

Após criar banco D1 e editar o ID no `wrangler.jsonc`:

- Crie um arquivo `.dev.vars` na raiz com `APP_PIN=1001` (arquivo ignorado pelo Git).
- `npm run db:local`
- `npm run dev`

## Backup

O aplicativo exporta JSON completo e CSV do mês. Mantenha cópias do JSON em local privado. Caso altere a senha, use `npx wrangler secret put APP_PIN` novamente. As sessões anteriores permanecem válidas até expirar; para invalidá-las antes, remova as linhas da tabela `sessions` no D1.

## Modelo de dados

Cada ano-mês (ex.: `2026-10`) tem lançamentos com vencimento, descrição, total, Otávio, status Otávio, Giu, status Giu, observação e recorrência. Edição do total preserva a proporção; edição da parcela de uma pessoa ajusta a da outra. Definir 0 atribui todo o valor à outra pessoa.

## Atenções

- A proteção é suficiente para um painel pessoal de baixo risco com uma senha forte. Um PIN de quatro dígitos, mesmo com limite de tentativas, **não equivale a autenticação robusta**.
- O histórico Excel contém discrepâncias antigas (parcelas que não somam o total). O importador preserva os registros e destaca divergências. Ao editar e salvar um lançamento, o rateio passa a somar exatamente o total.
- Importar um JSON substitui todos os meses existentes. Faça exportação prévia se já estiver utilizando o sistema.
