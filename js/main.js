/* ============================================================
   Seed2Serve — Main script
   Navbar + Hero behaviour (mobile menu, placeholder actions,
   active-link highlighting, smooth scrolling).
   ============================================================ */

(function () {
  'use strict';

  var menu = document.getElementById('navMenu');
  var toggle = document.getElementById('navToggle');
  var header = document.querySelector('.navbar-wrapper');
  var navHashLinks = document.querySelectorAll('.navbar__link[href^="#"]');

  /* ----------------------------------------------------------
     1. Mobile menu toggle
     ---------------------------------------------------------- */
  var menuOpen = false;

  function setMenu(open) {
    menuOpen = open;
    if (menu) {
      menu.classList.toggle('is-open', open);
    }
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(open));
    }
  }

  function closeMenu() {
    setMenu(false);
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      setMenu(!menuOpen);
    });
  }

  // Close on outside click or Escape.
  document.addEventListener('click', function (e) {
    if (
      menuOpen &&
      menu &&
      !menu.contains(e.target) &&
      toggle &&
      !toggle.contains(e.target)
    ) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeMenu();
    }
  });

  // Close the menu when the viewport crosses back to desktop.
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(closeMenu, 150);
  });

  /* ----------------------------------------------------------
     2. Nav links — smooth scroll to (future) sections.
        Home targets the hero. Missing sections no-op gracefully.
     ---------------------------------------------------------- */
  function scrollToHash(hash) {
    var target =
      hash && hash !== '#'
        ? document.querySelector(hash)
        : document.querySelector('#hero');

    if (!target) {
      return; // Section not built yet — placeholder.
    }

    var headerOffset = header ? header.offsetHeight : 0;
    var top =
      target.getBoundingClientRect().top +
      window.pageYOffset -
      headerOffset +
      8;

    window.scrollTo({ top: top > 0 ? top : 0, behavior: 'smooth' });
  }

  navHashLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var hash = link.getAttribute('href');
      e.preventDefault(); // We control scrolling ourselves.
      closeMenu();
      setActiveLink(link);
      scrollToHash(hash);
      try {
        history.pushState(null, '', hash);
      } catch (err) {
        /* ignore */
      }
    });
  });

  /* ----------------------------------------------------------
     3. Placeholder handling for non-navigational buttons
        (Get Started -> hero, Login / Explore Solutions later).
     ---------------------------------------------------------- */
  document.querySelectorAll('[data-placeholder]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      closeMenu();
      // Future: wire Login / Explore Solutions to their flows.
    });
  });

  document.querySelectorAll('.navbar__cta').forEach(function (el) {
    el.addEventListener('click', function () {
      closeMenu();
    });
  });

  /* ----------------------------------------------------------
     3b. In-page anchors outside the navbar (e.g. Hero buttons).
         Smooth-scroll to the target section like nav links.
     ---------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    if (link.classList.contains('navbar__link')) {
      return; // already handled by the nav logic above
    }
    var hash = link.getAttribute('href');
    if (!hash || hash === '#') {
      return;
    }
    link.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToHash(hash);
      try {
        history.pushState(null, '', hash);
      } catch (err) {
        /* ignore */
      }
    });
  });

  /* ----------------------------------------------------------
     4. Active link highlighting on scroll
     ---------------------------------------------------------- */
  var sectionIds = Array.from(navHashLinks)
    .map(function (l) {
      var h = l.getAttribute('href');
      var id = h && h !== '#' ? h.slice(1) : 'home';
      return id;
    })
    .filter(Boolean);

  function setActiveLink(activeLink) {
    navHashLinks.forEach(function (l) {
      l.classList.toggle('is-active', l === activeLink);
    });
  }

  function onScroll() {
    var scrolled = window.pageYOffset;
    var headerOffset = header ? header.offsetHeight : 0;
    var current = null;

    // At the top -> Home.
    if (scrolled < headerOffset + 40) {
      current = 'home';
    } else {
      // Otherwise the active section is the last one to scroll past
      // the sticky header (classic scroll-spy). Skip the sticky header.
      for (var i = 0; i < sectionIds.length; i++) {
        if (sectionIds[i] === 'home') {
          continue;
        }
        var sec = document.getElementById(sectionIds[i]);
        if (!sec) {
          continue;
        }
        var rect = sec.getBoundingClientRect();
        if (rect.top - headerOffset <= 0) {
          current = sectionIds[i];
        }
      }
      // If nothing has scrolled past yet, stay on Home.
      if (!current) {
        current = 'home';
      }
    }

    navHashLinks.forEach(function (l) {
      var id =
        l.getAttribute('href') === '#'
          ? 'home'
          : l.getAttribute('href').slice(1);
      l.classList.toggle('is-active', id === current);
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* ----------------------------------------------------------
     5. Hero carousel — 5 slides, fade transitions, arrows + dots
     ---------------------------------------------------------- */
  var stage = document.getElementById('heroCarousel');
  var slides = stage
    ? Array.prototype.slice.call(stage.querySelectorAll('.hero__slide'))
    : [];
  var dots = stage
    ? Array.prototype.slice.call(stage.querySelectorAll('.hero__dot'))
    : [];
  var prevBtn = document.getElementById('heroPrev');
  var nextBtn = document.getElementById('heroNext');

  var currentSlide = 0;
  var AUTO_INTERVAL = 7000; // 7 seconds
  var timer = null;

  function goToSlide(index) {
    if (!slides.length) {
      return;
    }
    var last = slides.length - 1;
    var clamped = (index + slides.length) % slides.length;
    currentSlide = clamped;

    slides.forEach(function (slide, i) {
      slide.classList.toggle('is-active', i === currentSlide);
    });
    dots.forEach(function (dot, i) {
      var active = i === currentSlide;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', String(active));
    });
  }

  function nextSlide() {
    goToSlide(currentSlide + 1);
  }

  function prevSlide() {
    goToSlide(currentSlide - 1);
  }

  // Restart the auto-rotation counter.
  function resetTimer() {
    if (timer) {
      clearInterval(timer);
    }
    timer = setInterval(nextSlide, AUTO_INTERVAL);
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      prevSlide();
      resetTimer(); // manual navigation resets the timer
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      nextSlide();
      resetTimer();
    });
  }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      var target = parseInt(dot.getAttribute('data-slide-to'), 10);
      if (!isNaN(target)) {
        goToSlide(target);
        resetTimer();
      }
    });
  });

  // Keyboard: left/right arrows navigate the carousel.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') {
      nextSlide();
      resetTimer();
    } else if (e.key === 'ArrowLeft') {
      prevSlide();
      resetTimer();
    }
  });

  // Start the carousel.
  goToSlide(currentSlide);
  if (slides.length > 1) {
    resetTimer();
  }

  /* ----------------------------------------------------------
     6. Products — rendered from SEED2SERVE_PRODUCTS data
        3D card flip + carousel (arrows / dots)
     ---------------------------------------------------------- */
  var PRODUCTS = window.SEED2SERVE_PRODUCTS || [];
  var ICONS = window.SEED2SERVE_ICONS || {};
  var track = document.getElementById('productTrack');
  var dotsContainer = document.getElementById('productDots');
  var productPrev = document.getElementById('productPrev');
  var productNext = document.getElementById('productNext');
  var activeProduct = 0;

  function buildCardHTML(product, index) {
    return (
      '<article class="product-card" data-index="' + index + '">' +
        '<div class="product-card__inner">' +
          '<div class="product-card__face product-card__front">' +
            '<img class="product-card__img" src="' + product.img + '" alt="' + product.alt + '" />' +
            '<div class="product-card__shade"></div>' +
            '<div class="product-card__front-content">' +
              '<span class="product-card__icon" aria-hidden="true">' + product.iconFront + '</span>' +
              '<h3 class="product-card__name">' + product.name + '</h3>' +
              '<p class="product-card__desc">' + product.desc + '</p>' +
              '<span class="product-card__accent" aria-hidden="true"></span>' +
            '</div>' +
          '</div>' +
          '<div class="product-card__face product-card__back">' +
            '<button class="product-card__close" type="button" aria-label="Close details">' + ICONS.close + '</button>' +
            '<span class="product-card__icon" aria-hidden="true">' + product.iconBack + '</span>' +
            '<h3 class="product-card__bname">' + product.name + '</h3>' +
            '<p class="product-card__bdesc">' + product.info + '</p>' +
            '<a href="login.html" class="btn btn--primary product-card__demo" data-product="' + product.slug + '">' +
              'Get Demo ' + ICONS.arrow +
            '</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderProducts() {
    if (!track || !PRODUCTS.length) {
      return;
    }
    track.innerHTML = PRODUCTS.map(buildCardHTML).join('');

    if (dotsContainer) {
      dotsContainer.innerHTML = PRODUCTS.map(function (_, i) {
        var active = i === 0 ? ' is-active' : '';
        return '<button class="products__dot' + active + '" data-dot="' + i + '" aria-label="Go to product ' + (i + 1) + '" aria-selected="' + (i === 0) + '"></button>';
      }).join('');
    }
  }

  renderProducts();

  var flipCards = track
    ? Array.prototype.slice.call(track.querySelectorAll('.product-card'))
    : [];
  var productDots = dotsContainer
    ? Array.prototype.slice.call(dotsContainer.querySelectorAll('.products__dot'))
    : [];

  // Flip the card when its front is clicked; un-flip when its back is clicked.
  flipCards.forEach(function (card) {
    var front = card.querySelector('.product-card__front');
    var back = card.querySelector('.product-card__back');
    var closeBtn = card.querySelector('.product-card__close');
    var demoBtn = card.querySelector('.product-card__demo');

    if (front) {
      front.addEventListener('click', function () {
        card.classList.add('flipped');
      });
    }

    if (back) {
      back.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) {
          return;
        }
        card.classList.remove('flipped');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        card.classList.remove('flipped');
      });
    }

    if (demoBtn) {
      demoBtn.addEventListener('click', function (e) {
        if (!card.classList.contains('flipped')) {
          e.preventDefault();
          return;
        }
        var product = demoBtn.getAttribute('data-product') || '';
        try {
          sessionStorage.setItem('seed2serve.selectedProduct', product);
          localStorage.setItem('seed2serve.selectedProduct', product);
        } catch (err) {
          /* ignore */
        }
        e.preventDefault();
        e.stopPropagation();
        window.location.href = 'login.html';
      });
    }
  });

  // Update the active pagination dot based on the card in view.
  function updateProductDots() {
    if (!track) {
      return;
    }
    var step = track.clientWidth;
    var index = Math.round(track.scrollLeft / step);
    if (index >= flipCards.length) {
      index = flipCards.length - 1;
    }
    activeProduct = index;
    productDots.forEach(function (dot, i) {
      var active = i === activeProduct;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', String(active));
    });
  }

  function scrollToCard(index, immediate) {
    if (!track || !flipCards.length) {
      return;
    }
    var clamped = Math.max(0, Math.min(index, flipCards.length - 1));
    var card = flipCards[clamped];
    var left = card.offsetLeft - track.offsetLeft;
    track.scrollTo({
      left: left > 0 ? left : 0,
      behavior: immediate ? 'auto' : 'smooth'
    });
    updateProductDots();
  }

  productDots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      var idx = parseInt(dot.getAttribute('data-dot'), 10);
      if (!isNaN(idx)) {
        scrollToCard(idx, false);
      }
    });
  });

  if (productPrev) {
    productPrev.addEventListener('click', function () {
      scrollToCard(activeProduct - 1, false);
    });
  }
  if (productNext) {
    productNext.addEventListener('click', function () {
      scrollToCard(activeProduct + 1, false);
    });
  }

  if (track) {
    track.addEventListener('scroll', function () {
      updateProductDots();
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.product-card__demo, .footer__product-link');
    if (!btn) {
      return;
    }
    var product = btn.getAttribute('data-product') || '';
    try {
      sessionStorage.setItem('seed2serve.selectedProduct', product);
      localStorage.setItem('seed2serve.selectedProduct', product);
    } catch (err) {
      /* ignore */
    }
    e.preventDefault();
    e.stopPropagation();
    var href = btn.getAttribute('href') || 'login.html';
    window.location.href = href;
  });

  /* ----------------------------------------------------------
     7b. Return from authentication (?demo=<product>)
         Scroll to the Products section and indicate the chosen one.
     ---------------------------------------------------------- */
  (function handleReturningDemo() {
    var match = window.location.search.match(/[?&]demo=([^&]+)/);
    if (!match) {
      return;
    }
    var slug = decodeURIComponent(match[1]);
    var productsSection = document.getElementById('products');

    var matches = flipCards.filter(function (card) {
      var btn = card.querySelector('.product-card__demo');
      return btn && btn.getAttribute('data-product') === slug;
    });
    if (matches.length) {
      matches[0].classList.add('demo-highlight');
      setTimeout(function () {
        matches[0].classList.remove('demo-highlight');
      }, 2200);
    }

    setTimeout(function () {
      if (productsSection) {
        scrollToHash('#products');
      }
    }, 300);
  })();

  updateProductDots();
  
  /* ----------------------------------------------------------
     7. FAQ accordion
     ---------------------------------------------------------- */
  var faqItems = document.querySelectorAll('.faq__item');

  function closeOtherFaq(exceptItem) {
    faqItems.forEach(function (item) {
      if (item === exceptItem) {
        return;
      }
      var q = item.querySelector('.faq__question');
      var a = item.querySelector('.faq__answer');
      if (q) {
        q.setAttribute('aria-expanded', 'false');
      }
      if (a) {
        a.classList.remove('is-open');
      }
    });
  }

  faqItems.forEach(function (item) {
    var question = item.querySelector('.faq__question');
    var answer = item.querySelector('.faq__answer');
    if (!question || !answer) {
      return;
    }

    question.addEventListener('click', function () {
      var isOpen = answer.classList.contains('is-open');

      // Close all others so only one panel is open at a time.
      closeOtherFaq(item);

      var willOpen = !isOpen;
      answer.classList.toggle('is-open', willOpen);
      question.setAttribute('aria-expanded', String(willOpen));

      // Move the item into view if it just opened.
      if (willOpen) {
        setTimeout(function () {
          var headerOffset = header ? header.offsetHeight : 0;
          var itemTop = item.getBoundingClientRect().top + window.pageYOffset;
          var answerHeight = answer.getBoundingClientRect().height;
          var viewportCenter =
            itemTop + answerHeight / 2 - window.innerHeight / 2;
          window.scrollTo({
            top: Math.max(0, viewportCenter - headerOffset),
            behavior: 'smooth'
          });
        }, 300);
      }
    });
  });
})();
