# Design: Refatoração Completa do Portal de Chamados

**Data:** 2026-02-23
**Autor:** Claude Code
**Status:** Aprovado pelo usuário

---

## Sumário Executivo

Refatoração completa do Portal de Chamados para corrigir bugs funcionais, vulnerabilidades XSS, código duplicado (DRY) e problemas de qualidade. O projeto é um frontend estático puro (HTML/CSS/JS vanilla) que consome dados do Google Sheets via CSV e interage com um Google Apps Script para atualizações de status.

---

## 1. Arquitetura

### Estado atual
```
index.html       → script.js + styles.css
admin.html       → (CSS inline + JS inline)
detalhes.html    → detalhes.js + detalhes.css
```
Cada arquivo tem sua própria cópia de `parseCSV`, `SHEET_URL` hardcoded, e sem sanitização HTML.

### Estado alvo
```
index.html       → utils.js + script.js + styles.css
admin.html       → utils.js + admin.css   (JS inline refatorado)
detalhes.html    → utils.js + detalhes.js + detalhes.css
utils.js         → parseCSV, escapeHTML, SHEET_URL, API_URL, ADMIN_CONFIG
admin.css        → CSS extraído do admin.html
```

---

## 2. Arquivo utils.js (novo)

Centraliza tudo que é compartilhado entre as páginas:

```js
// Constantes de configuração
const SHEET_URL = '...';
const API_URL   = '...';
const ADMIN_CONFIG = { userEmail: 'admin@smarapd.gov.br' };

// parseCSV — implementação única, usada pelas 3 páginas
function parseCSV(csvText) { ... }

// escapeHTML — sanitização para prevenir XSS
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

---

## 3. Correções de Bugs

### Bug 1 — Toast no primeiro carregamento (script.js)
- **Causa:** `lastFetchTime = Date.now()` na inicialização faz `lastFetchTime > 0` ser sempre `true`
- **Fix:** Usar flag booleana `let isFirstLoad = true` e resetar após primeira carga

### Bug 2 — `updateNoResultsMessage` quebra após Swiper
- **Causa:** `convertToSwiper()` substitui `.cards-container` por `.cards-swiper`; a função busca `.cards-container` que não existe mais
- **Fix:** Mover a chamada de `updateNoResultsMessage()` para **antes** de `convertToSwiper()` em `renderTickets()`

### Bug 3 — CORS duplo no admin (`carregarHistorico`)
- **Causa:** Código faz 2 fetches para contornar CORS — lógica confusa e instável
- **Fix:** Usar apenas o fetch sem `no-cors` (o Apps Script deve estar configurado com CORS headers). Tratar erro de CORS com mensagem clara e única.

---

## 4. Segurança / Prevenção de XSS

Todos os valores vindos do Google Sheets que são inseridos via `innerHTML` devem ser escapados com `escapeHTML()`:

### script.js — `renderTickets`
```js
// Antes (vulnerável)
card.innerHTML = `<h3>${title}</h3>`;

// Depois (seguro)
card.innerHTML = `<h3>${escapeHTML(title)}</h3>`;
```
Campos afetados: `id`, `title`, `truncatedDescription`, `requester`, `timeDisplay`, `system`, `statusLabel`

### admin.html — `renderizarHistorico`
Campos afetados: `item.statusAnterior`, `item.statusNovo`, `item.usuario`, `item.observacao`

### admin.html — `mostrarAlerta`
O parâmetro `mensagem` deve ser escapado antes de inserir no `innerHTML`.

### detalhes.js — `displayTicket`
Campos afetados: `id`, `title`, `description`, `statusLabel`, `system`, campos adicionais dinâmicos (chave e valor)

---

## 5. Refatoração DRY

### parseCSV
- Remover de `script.js`, `admin.html`, `detalhes.js`
- Manter única cópia em `utils.js`
- Cada arquivo passa a usar a versão global

### SHEET_URL e API_URL
- Remover de `script.js:13` e `admin.html:505`
- Centralizar em `utils.js`

### ADMIN_CONFIG
- Remover `USER_EMAIL` hardcoded de `admin.html`
- Mover para `utils.js` como `ADMIN_CONFIG.userEmail`

---

## 6. Qualidade / Limpeza

### console.log de debug
Remover ou converter para comentários os seguintes logs desnecessários em produção:
- `script.js`: logs de `isMobile`, `SHEET_URL`, contagens de cards, debug de solicitante, filtros
- `admin.html`: logs de payload, API_URL, response
- `detalhes.js`: log de "Buscando chamado"

### Comentário errado
- `script.js:17`: `// 5 seconds` → `// 20 seconds`

### Performance: indexOf para debug
- `script.js:211`: `filteredTickets.indexOf(ticket) === 0` → usar `index` do `forEach`

### admin.html — CSS externo
- Extrair `<style>...</style>` do `admin.html` para `admin.css`
- Adicionar `<link rel="stylesheet" href="admin.css">` no head

---

## 7. Componentes e Arquivos Afetados

| Arquivo | Ação | Tarefas |
|---------|------|---------|
| `utils.js` | **Criar** | parseCSV, escapeHTML, SHEET_URL, API_URL, ADMIN_CONFIG |
| `script.js` | **Editar** | Remover parseCSV, SHEET_URL; corrigir bug toast; corrigir bug Swiper+noResults; escapeHTML; limpar logs; corrigir comentário; corrigir indexOf |
| `admin.html` | **Editar** | Remover parseCSV, SHEET_URL, USER_EMAIL; usar ADMIN_CONFIG; corrigir CORS duplo; escapeHTML; limpar logs; mover CSS para admin.css |
| `admin.css` | **Criar** | CSS extraído do admin.html |
| `detalhes.js` | **Editar** | Remover parseCSV, SHEET_URL; escapeHTML em displayTicket; limpar logs |
| `index.html` | **Editar** | Adicionar `<script src="utils.js">` |
| `detalhes.html` | **Editar** | Adicionar `<script src="utils.js">` |

---

## 8. Fluxo de Dados (sem alteração)

O fluxo de dados não muda:
1. Página carrega → fetch CSV do Google Sheets
2. `parseCSV` (agora em utils.js) processa o texto
3. Dados renderizados no DOM com `escapeHTML` aplicado
4. Admin: POST para Google Apps Script (via fetch sem no-cors)

---

## 9. Critérios de Sucesso

- [ ] `parseCSV` existe apenas em `utils.js`
- [ ] `SHEET_URL` e `API_URL` existem apenas em `utils.js`
- [ ] Nenhum `innerHTML` recebe valor não-escapado vindo de dados externos
- [ ] Toast não aparece no primeiro carregamento
- [ ] `updateNoResultsMessage` funciona corretamente (antes do Swiper)
- [ ] Nenhum `console.log` de debug permanece em produção
- [ ] Comentário de rotação corrigido para "20 seconds"
- [ ] `admin.css` existe e `admin.html` não tem `<style>` inline
- [ ] Todos os arquivos carregam `utils.js` antes dos demais scripts

---

## IDs de Tarefas

- Task #1: Explorar contexto do projeto (concluído)
- Task #2: Fazer perguntas de clarificação (concluído)
- Task #3: Apresentar design (em andamento)
- Tasks #4–#10: Implementação (a criar via writing-plans)
