document.addEventListener("DOMContentLoaded", () => {

  const images = document.querySelectorAll(".carousel img");
  const dots = document.querySelectorAll(".dot");
  const nextBtn = document.querySelector(".next");
  const prevBtn = document.querySelector(".prev");
  const carousel = document.getElementById("carousel");

  let index = 0;
  let interval;

  function showSlide(i){
    images.forEach(img => img.classList.remove("active"));
    dots.forEach(dot => dot.classList.remove("active"));

    images[i].classList.add("active");
    dots[i].classList.add("active");
  }

  function nextSlide(){
    index = (index + 1) % images.length;
    showSlide(index);
  }

  function prevSlide(){
    index = (index - 1 + images.length) % images.length;
    showSlide(index);
  }

  function startAuto(){
    interval = setInterval(nextSlide, 3000);
  }

  function stopAuto(){
    clearInterval(interval);
  }

  nextBtn.addEventListener("click", nextSlide);
  prevBtn.addEventListener("click", prevSlide);

  dots.forEach((dot, i)=>{
    dot.addEventListener("click", () => {
      index = i;
      showSlide(index);
    });
  });

  carousel.addEventListener("mouseenter", stopAuto);
  carousel.addEventListener("mouseleave", startAuto);

  startAuto();
});

function handleNavSearch(){
  var query = document.getElementById('nav-search-input').value.trim();
  if (!query){
    alert('Digite algo para pesquisar.');
    return;
  }
  console.log('Pesquisa realizada:', query);
  alert('Você pesquisou por: ' + query);
}
