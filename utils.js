// ============================================================
// utils.js — Utilitários compartilhados do Portal de Chamados
// Carregue este arquivo ANTES de script.js / detalhes.js
// ============================================================

// --- Configuração central ---
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/gviz/tq?tqx=out:csv&gid=330906161';
const API_URL = 'https://script.google.com/macros/s/AKfycbwQF2Wo9DquQbr4pf5k7AjY0giqWB1wM6lkSam5Xju3JUAuOnhEqLI_Q5siRXSYKXCg/exec';
const ADMIN_CONFIG = {
    userEmail: 'ricardo.elito@gmail.com' // Substitua pelo email do administrador
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
