const SUPABASE_URL = 'https://SEU_PROJETO_ID.supabase.co';
const SUPABASE_ANON_KEY = 'SEU_ANON_KEY';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatCEP(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function formatQuantityFromDigits(rawDigits) {
  if (!rawDigits) return '';
  const n = Number(rawDigits);
  return (n / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
}

function formatPriceFromDigits(rawDigits) {
  if (!rawDigits) return '';
  const n = Number(rawDigits);
  return (n / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('productForm');
  const cepField = document.getElementById('cep');
  const quantitiesField = document.getElementById('quantities');
  const priceField = document.getElementById('Pricep');

  cepField.addEventListener('input', (event) => {
    event.target.value = formatCEP(event.target.value);
  });

  quantitiesField.addEventListener('input', (event) => {
    const raw = event.target.value.replace(/\D/g, '').slice(0, 12);
    quantitiesField.dataset.raw = raw;
    event.target.value = raw;
  });

  quantitiesField.addEventListener('blur', (event) => {
    const raw = event.target.dataset.raw || '';
    event.target.value = formatQuantityFromDigits(raw);
  });

  quantitiesField.addEventListener('focus', (event) => {
    const raw = event.target.dataset.raw || '';
    event.target.value = raw;
  });

  priceField.addEventListener('input', (event) => {
    const raw = event.target.value.replace(/\D/g, '').slice(0, 15);
    priceField.dataset.raw = raw;
    event.target.value = raw;
  });

  priceField.addEventListener('blur', (event) => {
    const raw = event.target.dataset.raw || '';
    event.target.value = formatPriceFromDigits(raw);
  });

  priceField.addEventListener('focus', (event) => {
    const raw = event.target.dataset.raw || '';
    event.target.value = raw;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const session = (await client.auth.getSession()).data.session;
    if (!session) {
      alert('Faça login antes de cadastrar produtos.');
      return;
    }

    const product = document.getElementById('Product').value.trim();
    if (!product) {
      alert('Informe o nome do produto.');
      return;
    }

    const cep = cepField.value.replace(/\D/g, '');
    const quantitiesRawValue = quantitiesField.dataset.raw || '';
    const priceRawValue = priceField.dataset.raw || '';

    const quantities = quantitiesRawValue ? parseInt(quantitiesRawValue, 10) / 1000 : null;
    const price = priceRawValue ? parseInt(priceRawValue, 10) / 100 : null;

    if (!cep || quantities === null || price === null || isNaN(quantities) || isNaN(price)) {
      alert('Preencha CEP, quantidade e valor corretamente.');
      return;
    }

    const payload = {
      product,
      description: document.getElementById('description').value.trim(),
      quantities,
      cep,
      locationc: document.getElementById('locationc').value.trim(),
      price,
      image_name: document.getElementById('Imagep').files[0]?.name || null,
      created_by: session.user.id
    };

    const res = await fetch('produto_insert.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (!res.ok) {
      console.error('Erro no backend:', json);
      alert('Falha no cadastro: ' + (json.message || 'erro desconhecido'));
      return;
    }

    alert('Produto cadastrado com sucesso!');

    form.reset();

    cepField.value = '';

    quantitiesField.value = '';
    quantitiesField.dataset.raw = '';

    priceField.value = '';
    priceField.dataset.raw = '';

    cepField.dispatchEvent(new Event('input'));
    quantitiesField.dispatchEvent(new Event('blur'));
    priceField.dispatchEvent(new Event('blur'));
  });
});