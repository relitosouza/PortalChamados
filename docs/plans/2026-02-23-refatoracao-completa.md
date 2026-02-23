# Refatoração Completa do Portal de Chamados — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Eliminar código duplicado, corrigir bugs funcionais e vulnerabilidades XSS, e melhorar qualidade geral do Portal de Chamados.

**Architecture:** Criar `utils.js` como módulo utilitário global compartilhado pelas 3 páginas (index, admin, detalhes). Cada página carrega `utils.js` antes do seu próprio script. Nenhum `innerHTML` recebe dado externo sem `escapeHTML()`.

**Tech Stack:** HTML5 / CSS3 / Vanilla JavaScript (sem framework, sem build tool, sem npm). Google Sheets CSV via fetch. Google Apps Script para escrita.

---

## Task 1: Criar utils.js

**Files:**
- Create: `E:\projetos\PortalChamados\utils.js`

**Step 1: Criar o arquivo utils.js com todas as utilidades compartilhadas**

O arquivo deve conter exatamente este conteúdo:

```js
// ============================================================
// utils.js — Utilitários compartilhados do Portal de Chamados
// Carregue este arquivo ANTES de script.js / detalhes.js
// ============================================================

// --- Configuração central ---
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/gviz/tq?tqx=out:csv&gid=330906161';
const API_URL   = 'https://script.google.com/macros/s/AKfycbwQF2Wo9DquQbr4pf5k7AjY0giqWB1wM6lkSam5Xju3JUAuOnhEqLI_Q5siRXSYKXCg/exec';
const ADMIN_CONFIG = {
    userEmail: 'seu.email@exemplo.com' // Substitua pelo email do administrador
};

// --- parseCSV ---
// Lê texto CSV (incluindo campos entre aspas e vírgulas escapadas)
// e retorna array de objetos com keys = cabeçalhos da primeira linha.
function parseCSV(csvText) {
    const rows = [];
    let currentRow = [];
    let currentVal = '';
    let inQuotes = false;

    const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentVal += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentVal);
            currentVal = '';
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentVal);
            if (currentRow.length > 0) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentVal = '';
        } else {
            currentVal += char;
        }
    }

    if (currentVal || currentRow.length > 0) {
        currentRow.push(currentVal);
        rows.push(currentRow);
    }

    if (rows.length === 0) return [];

    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(values => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] !== undefined ? values[index].trim() : '';
        });
        return obj;
    });
}

// --- escapeHTML ---
// Escapa caracteres especiais HTML para prevenir XSS.
// Use sempre que inserir dados externos em innerHTML.
function escapeHTML(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
```

**Step 2: Verificar o arquivo criado**

Abrir `utils.js` no editor e confirmar:
- `SHEET_URL` presente e igual ao valor original de `script.js:13`
- `API_URL` presente e igual ao valor original de `admin.html:432`
- `ADMIN_CONFIG.userEmail` presente com placeholder
- Função `parseCSV` idêntica em lógica à versão de `script.js:98-150`
- Função `escapeHTML` presente e completa

---

## Task 2: Atualizar index.html — carregar utils.js

**Files:**
- Modify: `E:\projetos\PortalChamados\index.html`

**Step 1: Adicionar tag script para utils.js antes de script.js**

No `index.html`, localizar a linha:
```html
    <script src="script.js"></script>
```

Substituir por:
```html
    <script src="utils.js"></script>
    <script src="script.js"></script>
```

**Step 2: Verificar ordem das tags no final do body**

O final do `<body>` deve ficar:
```html
    <!-- Swiper JS -->
    <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
    <script src="utils.js"></script>
    <script src="script.js"></script>

    <!-- Toast Notification -->
    ...
```

---

## Task 3: Atualizar detalhes.html — carregar utils.js

**Files:**
- Modify: `E:\projetos\PortalChamados\detalhes.html`

**Step 1: Ler o arquivo para localizar onde script é carregado**

Abrir `detalhes.html` e localizar a tag `<script src="detalhes.js">`.

**Step 2: Adicionar utils.js antes de detalhes.js**

Substituir:
```html
<script src="detalhes.js"></script>
```
Por:
```html
<script src="utils.js"></script>
<script src="detalhes.js"></script>
```

---

## Task 4: Refatorar script.js

**Files:**
- Modify: `E:\projetos\PortalChamados\script.js`

Este é o maior arquivo. Aplicar as mudanças em sub-passos:

### Step 1: Remover `const SHEET_URL` (linha 13)

Localizar e remover esta linha (a constante agora vem de `utils.js`):
```js
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/gviz/tq?tqx=out:csv&gid=330906161';
```

### Step 2: Corrigir comentário errado na linha 17

Localizar:
```js
    const rotationIntervalTime = 20000; // 5 seconds
```
Substituir por:
```js
    const rotationIntervalTime = 20000; // 20 seconds
```

### Step 3: Corrigir bug do toast no primeiro carregamento

Localizar o bloco de variáveis de auto-refresh (~linha 32–33):
```js
    let lastFetchTime = Date.now();
    const AUTO_REFRESH_INTERVAL = 10000; // 10 segundos de intervalo mínimo entre refreshes
```
Substituir por:
```js
    let isFirstLoad = true;
    let lastFetchTime = 0;
    const AUTO_REFRESH_INTERVAL = 10000; // 10 segundos de intervalo mínimo entre refreshes
```

Em seguida, dentro de `fetchTickets()`, localizar:
```js
                // Mostrar toast apenas se não for o primeiro carregamento
                if (lastFetchTime > 0) {
                    showToast('Chamados atualizados!');
                }
```
Substituir por:
```js
                // Mostrar toast apenas se não for o primeiro carregamento
                if (!isFirstLoad) {
                    showToast('Chamados atualizados!');
                }
                isFirstLoad = false;
```

E atualizar `lastFetchTime` corretamente — dentro do bloco `.then(csvText => { ... })`, ao final, adicionar:
```js
                lastFetchTime = Date.now();
```
(Remover as duas ocorrências avulsas de `lastFetchTime = Date.now()` que ficaram nos handlers de visibilidade e intervalo, pois agora o update acontece dentro do próprio fetchTickets.)

### Step 4: Remover a função `parseCSV` inteira (linhas 98–150)

Localizar e remover o bloco completo:
```js
    function parseCSV(csvText) {
        const rows = [];
        let currentRow = [];
        let currentVal = '';
        let inQuotes = false;
        ...
        return data;
    }
```
A função agora vem de `utils.js` (escopo global).

### Step 5: Corrigir bug de `updateNoResultsMessage` após Swiper

Localizar a função `renderTickets`, no final do bloco `.forEach(ticket => { ... })`:
```js
        // Show "no results" message if needed
        updateNoResultsMessage();

        // Converter para Swiper apenas no desktop
        if (!isMobile) {
            console.log('Desktop detectado - convertendo para Swiper...');
            convertToSwiper();
        } else {
            console.log('Mobile detectado - mantendo grid normal');
        }
```
Substituir por (mover `updateNoResultsMessage()` para antes do Swiper, remover console.logs):
```js
        // Show "no results" message if needed — deve ser chamado ANTES de convertToSwiper
        // pois convertToSwiper substitui .cards-container por .cards-swiper
        updateNoResultsMessage();

        // Converter para Swiper apenas no desktop
        if (!isMobile) {
            convertToSwiper();
        }
```

### Step 6: Corrigir `filteredTickets.indexOf(ticket)` → index do forEach

Localizar:
```js
            // Log para debug - mostrar todos os campos do primeiro ticket
            if (filteredTickets.indexOf(ticket) === 0) {
                console.log('=== DEBUG SOLICITANTE ===');
                console.log('Todas as colunas disponíveis:', Object.keys(ticket));
                console.log('Ticket completo:', ticket);
                console.log('Solicitante selecionado:', requester);
                console.log('========================');
            }
```
Remover esse bloco inteiro (é debug desnecessário em produção).

Localizar a linha de `.forEach`:
```js
        filteredTickets.forEach(ticket => {
```
Substituir por:
```js
        filteredTickets.forEach((ticket, _index) => {
```
(Parâmetro `_index` reservado para uso futuro se necessário; o bloco de debug acima foi removido então não é necessário usá-lo agora.)

### Step 7: Aplicar escapeHTML no `card.innerHTML` dentro de `renderTickets`

Localizar o bloco de montagem do card:
```js
            const timeDisplay = timestamp ? `Aberto em: ${timestamp}` : '';

            card.innerHTML = `
                <div class="card-header">
                    <span class="ticket-id">#${id}</span>
                    <span class="status-badge">${statusLabel}</span>
                    ${system ? `<span class="system-badge ${systemClass}">${system}</span>` : ''}
                </div>
                <h3>${title}</h3>
                <div class="card-requester">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 8C10.2091 8 12 6.20914 12 4C12 1.79086 10.2091 0 8 0C5.79086 0 4 1.79086 4 4C4 6.20914 5.79086 8 8 8Z" fill="currentColor"/>
                        <path d="M8 10C4.13401 10 1 11.567 1 13.5V16H15V13.5C15 11.566 11.866 10 8 10Z" fill="currentColor"/>
                    </svg>
                    <span>${requester}</span>
                </div>
                <p title="${description}">${truncatedDescription}</p>
                <div class="card-footer">
                    <span>${timeDisplay}</span>
                    <a href="detalhes.html?id=${encodeURIComponent(id)}" class="btn-details">Ver Detalhes</a>
                </div>
            `;
```

Substituir por (aplicando escapeHTML em todos os campos de dado externo):
```js
            const timeDisplay = timestamp ? `Aberto em: ${escapeHTML(timestamp)}` : '';

            card.innerHTML = `
                <div class="card-header">
                    <span class="ticket-id">#${escapeHTML(id)}</span>
                    <span class="status-badge">${escapeHTML(statusLabel)}</span>
                    ${system ? `<span class="system-badge ${systemClass}">${escapeHTML(system)}</span>` : ''}
                </div>
                <h3>${escapeHTML(title)}</h3>
                <div class="card-requester">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 8C10.2091 8 12 6.20914 12 4C12 1.79086 10.2091 0 8 0C5.79086 0 4 1.79086 4 4C4 6.20914 5.79086 8 8 8Z" fill="currentColor"/>
                        <path d="M8 10C4.13401 10 1 11.567 1 13.5V16H15V13.5C15 11.566 11.866 10 8 10Z" fill="currentColor"/>
                    </svg>
                    <span>${escapeHTML(requester)}</span>
                </div>
                <p title="${escapeHTML(description)}">${escapeHTML(truncatedDescription)}</p>
                <div class="card-footer">
                    <span>${timeDisplay}</span>
                    <a href="detalhes.html?id=${encodeURIComponent(id)}" class="btn-details">Ver Detalhes</a>
                </div>
            `;
```

### Step 8: Remover todos os console.log de debug restantes em script.js

Remover as seguintes linhas (ou blocos):

```js
        console.log('Fetching tickets...');
        console.log('isMobile:', isMobile);
        console.log('SHEET_URL:', SHEET_URL);
```
```js
                console.log('Response status:', response.status);
```
```js
                console.log('CSV received, length:', csvText.length);
```
```js
                console.log('Parsed tickets:', tickets.length, 'tickets');
                console.log('First ticket:', tickets[0]);
```
```js
        console.log('renderTickets called with', tickets.length, 'tickets');
```
```js
        console.log('Filtered tickets:', filteredTickets.length);
```
```js
            // Debug: log se descrição foi truncada
            if (words.length > 12) {
                console.log(`Descrição truncada: ${words.length} palavras -> 12 palavras (ID: ${id})`);
            }
```
```js
        console.log('Cards renderizados. Verificando conversão para Swiper...');
        console.log('Total de cards em #abertos:', document.querySelectorAll('#abertos .card').length);
        console.log('Total de cards em #andamento:', document.querySelectorAll('#andamento .card').length);
        console.log('Total de cards em #resolvidos:', document.querySelectorAll('#resolvidos .card').length);
```
```js
                    console.log(`Campo solicitante encontrado na coluna: "${key}" = "${requester}"`);
```
```js
                    console.log('Filter changed to:', currentFilter);
                    console.log('Available systems in data:', [...new Set(allTickets.map(t => t['Sistema']))]);
```
Manter apenas `console.error` (erros reais que ajudam a depurar problemas em produção).

**Step 9: Verificação manual no browser**

Abrir `index.html` diretamente no browser (ou via servidor local). Confirmar:
- Chamados carregam normalmente
- Toast NÃO aparece na primeira carga
- Toast aparece quando a página volta ao foco (após 10s)
- Busca e filtros funcionam
- Swiper aparece no desktop
- Mensagem "nenhum resultado" aparece quando filtro não tem matches
- Console do DevTools não tem erros nem logs de debug

---

## Task 5: Extrair CSS do admin.html para admin.css

**Files:**
- Create: `E:\projetos\PortalChamados\admin.css`
- Modify: `E:\projetos\PortalChamados\admin.html`

**Step 1: Criar admin.css com o conteúdo do bloco `<style>` de admin.html**

Copiar **todo o conteúdo** entre `<style>` e `</style>` de `admin.html` (linhas 10–328 aproximadamente, com todos os seletores CSS) para `admin.css`.

O arquivo `admin.css` deve começar diretamente com `:root {` (sem a tag `<style>`).

**Step 2: Substituir o bloco `<style>` no admin.html pelo link externo**

No `admin.html`, substituir:
```html
    <style>
        :root {
            ...toda a css...
        }
    </style>
```
Por:
```html
    <link rel="stylesheet" href="admin.css">
```

**Step 3: Verificar visual do admin.html no browser**

Abrir `admin.html` — aparência deve ser idêntica à antes da mudança.

---

## Task 6: Refatorar admin.html — JS inline

**Files:**
- Modify: `E:\projetos\PortalChamados\admin.html`

### Step 1: Adicionar script utils.js no `<head>` do admin.html

No `admin.html`, adicionar antes do bloco `<script>` inline existente:
```html
    <script src="utils.js"></script>
```

### Step 2: Remover `const API_URL` local (linha ~432)

Localizar e remover:
```js
        const API_URL = 'https://script.google.com/macros/s/AKfycbwQF2Wo9DquQbr4pf5k7AjY0giqWB1wM6lkSam5Xju3JUAuOnhEqLI_Q5siRXSYKXCg/exec';
```
(agora vem de `utils.js`)

### Step 3: Remover `const USER_EMAIL` e substituir por `ADMIN_CONFIG.userEmail`

Localizar e remover:
```js
        const USER_EMAIL = 'seu.email@exemplo.com'; // Substitua pelo seu email
```

Substituir todas as ocorrências de `USER_EMAIL` no código restante por `ADMIN_CONFIG.userEmail`:
- Em `carregarUsuario()`: `email: USER_EMAIL` → `email: ADMIN_CONFIG.userEmail`
- Em `atualizarStatus()`: `usuario: USER_EMAIL` → `usuario: ADMIN_CONFIG.userEmail`

### Step 4: Remover a função `parseCSV` local do admin.html

Localizar e remover o bloco completo da função `parseCSV` (último bloco do script inline, ~linhas 764–810). A função agora vem de `utils.js`.

### Step 5: Remover a `const SHEET_URL` local de `buscarChamado()`

Dentro da função `buscarChamado()`, localizar e remover:
```js
                // Buscar dados do chamado na planilha (via CSV)
                const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/gviz/tq?tqx=out:csv&gid=330906161';
```
(A constante global de `utils.js` é acessível automaticamente.)

### Step 6: Corrigir CORS duplo em `carregarHistorico`

Substituir a função `carregarHistorico` inteira pelo código simplificado abaixo (um único fetch sem `no-cors`):

```js
        async function carregarHistorico(chamadoId) {
            const historicoDiv = document.getElementById('historico');
            historicoDiv.innerHTML = '<div class="alert alert-info">Carregando histórico...</div>';

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'obterHistorico',
                        chamadoId: chamadoId
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();

                if (result.success) {
                    if (result.data && result.data.length > 0) {
                        renderizarHistorico(result.data);
                    } else {
                        historicoDiv.innerHTML = '<div class="alert alert-info">Nenhum histórico encontrado para este chamado.</div>';
                    }
                } else {
                    throw new Error(result.message || 'Erro ao buscar histórico');
                }
            } catch (error) {
                historicoDiv.innerHTML = `
                    <div class="alert alert-error">
                        <strong>Erro ao carregar histórico</strong><br>
                        ${escapeHTML(error.message)}<br><br>
                        <small>Verifique se:</small>
                        <ul style="margin-top: 8px; padding-left: 20px;">
                            <li>A API_URL em utils.js está configurada corretamente</li>
                            <li>O script está implantado como "Aplicativo da Web"</li>
                            <li>O acesso está configurado como "Qualquer pessoa"</li>
                            <li>O chamado existe na planilha</li>
                        </ul>
                    </div>
                `;
            }
        }
```

### Step 7: Aplicar escapeHTML em `renderizarHistorico`

Localizar a função `renderizarHistorico`:
```js
        function renderizarHistorico(historico) {
            const html = `
                <div class="timeline">
                    ${historico.map(item => `
                        <div class="timeline-item">
                            <div class="timeline-content">
                                <h4>${item.statusAnterior} → ${item.statusNovo}</h4>
                                <p>por ${item.usuario}</p>
                                ${item.observacao ? `<p><em>"${item.observacao}"</em></p>` : ''}
                                <span class="timeline-date">${formatarData(item.timestamp)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            document.getElementById('historico').innerHTML = html;
        }
```

Substituir por:
```js
        function renderizarHistorico(historico) {
            const html = `
                <div class="timeline">
                    ${historico.map(item => `
                        <div class="timeline-item">
                            <div class="timeline-content">
                                <h4>${escapeHTML(item.statusAnterior)} → ${escapeHTML(item.statusNovo)}</h4>
                                <p>por ${escapeHTML(item.usuario)}</p>
                                ${item.observacao ? `<p><em>"${escapeHTML(item.observacao)}"</em></p>` : ''}
                                <span class="timeline-date">${escapeHTML(formatarData(item.timestamp))}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            document.getElementById('historico').innerHTML = html;
        }
```

### Step 8: Aplicar escapeHTML em `mostrarAlerta`

Localizar:
```js
        function mostrarAlerta(mensagem, tipo) {
            const container = document.getElementById('alertContainer');
            container.innerHTML = `<div class="alert alert-${tipo}">${mensagem}</div>`;
        }
```

Substituir por:
```js
        function mostrarAlerta(mensagem, tipo) {
            const container = document.getElementById('alertContainer');
            container.innerHTML = `<div class="alert alert-${escapeHTML(tipo)}">${escapeHTML(mensagem)}</div>`;
        }
```

### Step 9: Remover console.log de debug do admin.html

Remover os seguintes blocos:
```js
            console.log('=== DEBUG ATUALIZAÇÃO ===');
            console.log('API_URL:', API_URL);
            console.log('Payload:', { ... });
```
```js
                console.log('Response:', response);
```
```js
                console.log('Buscando histórico para:', chamadoId);
                console.log('API URL:', API_URL);
```
```js
                console.log('Response recebida');
```
```js
                    console.log('Resultado do histórico:', result);
```

Manter apenas `console.error`.

### Step 10: Verificar admin.html no browser

Abrir `admin.html`. Confirmar:
- Layout visual idêntico ao original
- Campo usuário carrega (se API_URL estiver configurada)
- Busca de chamado funciona
- Console sem erros de "parseCSV is not defined" ou similares

---

## Task 7: Refatorar detalhes.js

**Files:**
- Modify: `E:\projetos\PortalChamados\detalhes.js`

### Step 1: Remover `const SHEET_URL` local (linha 2)

Localizar e remover:
```js
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/gviz/tq?tqx=out:csv&gid=330906161';
```

### Step 2: Remover a função `parseCSV` local (linhas 46–98)

Localizar e remover o bloco completo da função `parseCSV`.

### Step 3: Remover console.log de debug

Remover:
```js
        console.log('Buscando chamado:', id);
```

### Step 4: Aplicar escapeHTML em `displayTicket`

Localizar o bloco de preenchimento de informações principais:
```js
        document.getElementById('ticketId').textContent = `#${id}`;
        document.getElementById('ticketTitle').textContent = title;
        document.getElementById('timestamp').textContent = timestamp || 'Não informado';
        document.getElementById('statusText').textContent = statusLabel;
        document.getElementById('description').textContent = description;
```

Nota: `.textContent` já é seguro contra XSS (não interpreta HTML). Manter como está.

Localizar o bloco do `systemBadge`:
```js
            systemBadge.textContent = system;
            systemBadge.className = `system-badge ${systemClass}`;
            systemBadge.style.display = 'inline-block';

            systemText.textContent = system;
```

Nota: `.textContent` é seguro. Manter como está.

Localizar o bloco dos campos adicionais dinâmicos:
```js
                const item = document.createElement('div');
                item.className = 'info-item';
                item.innerHTML = `
                    <label>${key}</label>
                    <span>${ticket[key]}</span>
                `;
```

Substituir por (key vem das headers do CSV — dado externo):
```js
                const item = document.createElement('div');
                item.className = 'info-item';
                item.innerHTML = `
                    <label>${escapeHTML(key)}</label>
                    <span>${escapeHTML(ticket[key])}</span>
                `;
```

Localizar o bloco da timeline:
```js
                item.innerHTML = `
                    <div class="timeline-content">
                        <h4>${event.title}</h4>
                        <p>${event.description}</p>
                        <span class="timeline-date">${event.date}</span>
                    </div>
                `;
```

Os campos `event.title`, `event.description` e `event.date` são strings literais definidas no próprio código (não dados externos), então não precisam de escapeHTML. Manter como estão.

Localizar:
```js
        document.title = `Chamado #${id} - ${title} - Smarapd`;
```
Substituir por (title é dado externo — ao usar em `.title` que é textContent-like, é seguro, mas por boa prática):
```js
        document.title = `Chamado #${id} - ${title} - Smarapd`; // title é string plana, seguro em .title
```
(Manter sem alteração — `document.title` não interpreta HTML.)

### Step 5: Verificar detalhes.html no browser

Abrir `detalhes.html?id=<numero-de-chamado-valido>`. Confirmar:
- Detalhes do chamado carregam corretamente
- Timeline aparece quando status é "Em Andamento" ou "Resolvido"
- Console sem erros de "parseCSV is not defined" ou similares
- Botão Compartilhar copia link para clipboard

---

## Task 8: Verificação Final Cruzada

**Files:** Nenhum (verificação manual)

**Step 1: Verificar que parseCSV NÃO existe em script.js, admin.html, detalhes.js**

Buscar no editor/grep: se `function parseCSV` aparecer em qualquer lugar além de `utils.js`, é um erro.

**Step 2: Verificar que SHEET_URL NÃO existe em script.js nem em admin.html**

Buscar: se `const SHEET_URL` aparecer fora de `utils.js`, é um erro.

**Step 3: Verificar que não há `console.log` de debug restante**

Buscar `console.log` nos arquivos. Apenas `console.error` é permitido em produção.

**Step 4: Verificar carregamento do utils.js nas 3 páginas**

- `index.html`: deve ter `<script src="utils.js">` antes de `<script src="script.js">`
- `detalhes.html`: deve ter `<script src="utils.js">` antes de `<script src="detalhes.js">`
- `admin.html`: deve ter `<script src="utils.js">` antes do `<script>` inline

**Step 5: Cheklist final dos critérios de sucesso**

- [ ] `parseCSV` existe apenas em `utils.js`
- [ ] `SHEET_URL` e `API_URL` existem apenas em `utils.js`
- [ ] Nenhum `innerHTML` recebe valor não-escapado vindo de dados externos
- [ ] Toast não aparece no primeiro carregamento da página
- [ ] `updateNoResultsMessage` é chamado antes de `convertToSwiper`
- [ ] Nenhum `console.log` de debug em produção
- [ ] Comentário de rotação diz "20 seconds"
- [ ] `admin.css` existe e `admin.html` usa `<link rel="stylesheet" href="admin.css">`
- [ ] Todos os arquivos carregam `utils.js` antes dos demais scripts

---

## Ordem de Execução Recomendada

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8
```

Tasks 2 e 3 podem ser feitas em paralelo. Tasks 5, 6 e 7 podem ser feitas em paralelo após Task 1.
