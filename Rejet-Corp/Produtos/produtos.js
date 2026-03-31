const SUPABASE_URL = 'https://SEU_PROJETO_ID.supabase.co';
const SUPABASE_ANON_KEY = 'SEU_ANON_KEY';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getSession() {
  const stored = localStorage.getItem('supabase_session');
  if (!stored) return null;
  try {
    const session = JSON.parse(stored);
    return session;
  } catch {
    return null;
  }
}

async function requireAuth() {
  const session = await getSession();
  if (!session || !session.access_token) {
    window.location.href = '../Login/login.html';
    return null;
  }
  return session;
}

async function fetchProducts(query = '') {
  const session = await requireAuth();
  if (!session) return;

  const params = new URLSearchParams();
  if (query) {
    params.append('q', query);
  }

  const response = await fetch('../CadastroProduto/produto_list.php' + (query ? '?q=' + encodeURIComponent(query) : ''), {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + session.access_token,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.error('Erro ao buscar produtos', await response.text());
    return;
  }

  const data = await response.json();
  return data;
}

function renderProducts(items) {
  const container = document.getElementById('productList');
  container.innerHTML = '';

  if (!items || items.length === 0) {
    container.innerHTML = '<p>Nenhum produto encontrado.</p>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'col-md-6 col-lg-4';

    const imgUrl = item.image_name ? item.image_name : 'https://via.placeholder.com/400x250?text=Sem+imagem';

    card.innerHTML = `
      <div class="card h-100">
        <img src="${imgUrl}" class="card-img-top" alt="${item.product}" />
        <div class="card-body">
          <h5 class="card-title">${item.product}</h5>
          <p class="card-text">${item.description || 'Sem descrição'}</p>
          <p class="card-text"><strong>Quantidade:</strong> ${item.quantities}</p>
          <p class="card-text"><strong>Preço:</strong> R$ ${item.price}</p>
          <p class="card-text"><strong>CEP:</strong> ${item.cep}</p>
          <p class="card-text"><strong>Local entrada:</strong> ${item.locationc}</p>
          <div class="d-flex justify-content-between">
            <button class="btn btn-sm btn-danger" onclick="removeProduct('${item.id}')">Excluir</button>
            <button class="btn btn-sm btn-primary" onclick="editProduct('${item.id}')">Editar</button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

async function loadProducts() {
  const q = document.getElementById('searchInput').value.trim();
  const products = await fetchProducts(q);
  renderProducts(products);
}

async function removeProduct(id) {
  if (!confirm('Tem certeza que deseja excluir este produto?')) return;
  const session = await requireAuth(); if (!session) return;

  const response = await fetch(`../CadastroProduto/produto_delete.php?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + session.access_token,
    },
  });

  if (!response.ok) {
    const err = await response.json();
    alert('Erro ao excluir: ' + (err.message || response.statusText));
    return;
  }

  loadProducts();
}

function editProduct(id) {
  localStorage.setItem('edit_product_id', id);
  window.location.href = '../CadastroProduto/cadastrarP.html?edit=' + encodeURIComponent(id);
}

document.getElementById('searchInput').addEventListener('input', () => {
  loadProducts();
});

window.addEventListener('DOMContentLoaded', () => {
  loadProducts();
});
