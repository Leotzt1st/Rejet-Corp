const SUPABASE_URL = 'https://SEU_PROJETO_ID.supabase.co';
const SUPABASE_ANON_KEY = 'SEU_ANON_KEY';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const showLoginBtn = document.getElementById('showLoginBtn');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const loginCard = document.getElementById('loginCard');
const registerCard = document.getElementById('registerCard');

function showLogin() {
  showLoginBtn.classList.add('active');
  showRegisterBtn.classList.remove('active');
  loginCard.classList.remove('hidden');
  registerCard.classList.add('hidden');
}

function showRegister() {
  showLoginBtn.classList.remove('active');
  showRegisterBtn.classList.add('active');
  loginCard.classList.add('hidden');
  registerCard.classList.remove('hidden');
}

showLoginBtn.addEventListener('click', showLogin);
showRegisterBtn.addEventListener('click', showRegister);

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

async function handleLogin(event) {
  event.preventDefault();

  const cnpj = document.getElementById('loginCnpj').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!cnpj || !password) {
    alert('Preencha CNPJ e senha');
    return;
  }

  // use email as cnpj@rejec.local to adaptar Supabase Auth
  const email = `${cnpj.replace(/\D/g, '')}@rejec.local`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Login falhou', error);
    alert('Erro no login: ' + error.message);
    return;
  }

  localStorage.setItem('supabase_session', JSON.stringify(data.session));
  alert('Login realizado com sucesso');
  window.location.href = '../Produtos/produtos.html';
}

async function handleRegister(event) {
  event.preventDefault();

  const responsavelEmail = document.getElementById('responsavelEmail').value.trim();
  const responsavelSenha = document.getElementById('responsavelSenha').value;
  const empresaCnpj = document.getElementById('empresaCnpj').value.trim();

  if (!responsavelEmail || !responsavelSenha || !empresaCnpj) {
    alert('Preencha email, senha e CNPJ da empresa');
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email: responsavelEmail,
    password: responsavelSenha,
    options: {
      data: {
        cnpj: empresaCnpj.replace(/\D/g, ''),
        nome: document.getElementById('responsavelNome').value.trim(),
        empresa: document.getElementById('empresaFantasia').value.trim(),
      },
    },
  });

  if (error) {
    console.error('Cadastro falhou', error);
    alert('Erro no cadastro: ' + error.message);
    return;
  }

  alert('Cadastro realizado. Verifique seu email para confirmação.');
  showLogin();
}

loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);

// Verificar sessão existente
window.addEventListener('DOMContentLoaded', async () => {
  const existing = localStorage.getItem('supabase_session');
  if (existing) {
    const session = JSON.parse(existing);
    if (session?.access_token) {
      const { data, error } = await supabase.auth.getUser(session.access_token);
      if (!error && data?.user) {
        window.location.href = '../Produtos/produtos.html';
      }
    }
  }
});
