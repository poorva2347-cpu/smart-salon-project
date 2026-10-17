window.addEventListener('scroll', function () {
    const nav = document.querySelector('.nav');
    if (window.scrollY > 100) { // adjust scroll threshold
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});