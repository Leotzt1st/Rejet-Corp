import { supabase } from "./supabase.js";//sempre que eu coloco isso o meu html some os efeitos etc.
const modalOverlay = document.getElementById("modalOverlay");
const siteContent = document.getElementById("siteContent");
const closeModal = document.getElementById("closeModal");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const modalTitle = document.getElementById("modalTitle");
const modalSubtitle = document.getElementById("modalSubtitle");

const openLoginButtons = document.querySelectorAll(".open-login");
const openRegisterButtons = document.querySelectorAll(".open-register");

const switchToRegister = document.getElementById("switchToRegister");
const switchToLogin = document.getElementById("switchToLogin");

function openModal(mode) {
  modalOverlay.classList.add("active");
  siteContent.classList.add("is-blurred");
  document.body.style.overflow = "hidden";

  if (mode === "register") {
    showRegister();
  } else {
    showLogin();
  }
}

function closeModalBox() {
  modalOverlay.classList.remove("active");
  siteContent.classList.remove("is-blurred");
  document.body.style.overflow = "";
}

function showLogin() {
  loginForm.classList.add("active");
  registerForm.classList.remove("active");
  modalTitle.textContent = "Entrar na plataforma";
  modalSubtitle.textContent = "Use seu acesso corporativo para entrar no sistema.";
}

function showRegister() {
  registerForm.classList.add("active");
  loginForm.classList.remove("active");
  modalTitle.textContent = "Registrar empresa";
  modalSubtitle.textContent = "Cadastre sua empresa para negociar restos produtivos com segurança.";
}

openLoginButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openModal("login");
  });
});

openRegisterButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openModal("register");
  });
});

switchToRegister.addEventListener("click", (event) => {
  event.preventDefault();
  showRegister();
});

switchToLogin.addEventListener("click", (event) => {
  event.preventDefault();
  showLogin();
});

closeModal.addEventListener("click", closeModalBox);

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    closeModalBox();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalOverlay.classList.contains("active")) {
    closeModalBox();
  }
});
// ===============================
// SUPABASE (LOGIN + CADASTRO)
// ===============================

function limparCnpj(valor) {
  return valor.replace(/\D/g, "");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    alert("Preencha e-mail e senha.");
    return;
  }

  const botao = loginForm.querySelector('button[type="submit"]');
  const textoOriginal = botao.textContent;

  botao.disabled = true;
  botao.textContent = "Entrando...";

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert("Erro no login: " + error.message);
      return;
    }

    alert("Login realizado com sucesso!");
    closeModalBox();

  } catch (err) {
    console.error(err);
    alert("Erro inesperado ao fazer login.");
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const companyName = document.getElementById("registerCompanyName").value.trim();
  const cnpj = limparCnpj(document.getElementById("registerCnpj").value);
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

  if (!companyName || !cnpj || !email || !password) {
    alert("Preencha todos os campos.");
    return;
  }

  const botao = registerForm.querySelector('button[type="submit"]');
  const textoOriginal = botao.textContent;

  botao.disabled = true;
  botao.textContent = "Registrando...";

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: companyName,
          cnpj: cnpj
        }
      }
    });

    if (error) {
      alert("Erro no cadastro: " + error.message);
      return;
    }

    const user = data.user;

    if (user) {
      const { error: companyError } = await supabase.from("companies").insert([
        {
          user_id: user.id,
          company_name: companyName,
          cnpj: cnpj,
          email: email
        }
      ]);

      if (companyError) {
        alert("Erro ao salvar empresa: " + companyError.message);
        return;
      }
    }

    alert("Cadastro realizado com sucesso!");
    registerForm.reset();
    showLogin();

  } catch (err) {
    console.error(err);
    alert("Erro inesperado ao registrar.");
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});