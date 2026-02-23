const fetch = require('node-fetch');

const API_URL = 'https://script.google.com/macros/s/AKfycbwQF2Wo9DquQbr4pf5k7AjY0giqWB1wM6lkSam5Xju3JUAuOnhEqLI_Q5siRXSYKXCg/exec';
const ADMIN_EMAIL = 'ricardo.elito@gmail.com';

async function testFetch() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'atualizarStatus',
                chamadoId: '123',
                novoStatus: 'Em Andamento',
                usuario: ADMIN_EMAIL,
                observacao: 'teste nodejs'
            })
        });

        console.log('Status:', response.status);
        console.log('Headers:', response.headers.raw());

        const text = await response.text();
        console.log('Body:', text);
    } catch (e) {
        console.error('Error:', e);
    }
}

testFetch();
