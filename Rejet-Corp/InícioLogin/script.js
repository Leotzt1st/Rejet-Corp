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