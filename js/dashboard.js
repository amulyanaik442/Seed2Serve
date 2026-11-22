/* ============================================================
   Seed2Serve — Farmer Dashboard script
   Authenticated session check, personalised greeting, hero
   status, quick actions, product flip cards (shared with the
   home page), search, notifications, navigation.
   ============================================================ */
(function () {
  'use strict';

  /* ----------------------------------------------------------
     0. Product catalogue — single source of truth shared with
        the home page (js/data/products.js). No invented or
        extra products, levels, or categories.
     ---------------------------------------------------------- */
  var PRODUCTS = (window.SEED2SERVE_PRODUCTS || []).map(function (p) {
    return {
      slug: p.slug,
      title: p.name,
      desc: p.desc,
      info: p.info,
      img: p.img,
      alt: p.alt,
      iconFront: p.iconFront,
      iconBack: p.iconBack
    };
  });

  /* ----------------------------------------------------------
     1. Element cache
     ---------------------------------------------------------- */
  var userNameEl = document.getElementById('userName');
  var greetingInner = document.getElementById('greetingInner');
  var nameSkeleton = document.getElementById('nameSkeleton');

  var bannerSkeleton = document.getElementById('bannerSkeleton');
  var bannerContent = document.getElementById('bannerContent');
  var bannerMedia = document.getElementById('bannerMedia');

  var productSkeleton = document.getElementById('productSkeleton');
  var productWrap = document.getElementById('productWrap');
  var productList = document.getElementById('productList');
  var emptyState = document.getElementById('emptyState');
  var exploreAll = document.getElementById('exploreAll');
  var cropDemo = document.getElementById('cropDemo');
  var cropDemoClose = document.getElementById('cropDemoClose');
  var cropDemoForm = document.getElementById('cropDemoForm');
  var cropDemoError = document.getElementById('cropDemoError');
  var cropDemoResults = document.getElementById('cropDemoResults');
  var cropDemoSubmit = document.getElementById('cropDemoSubmit');

  var menuBtn = document.getElementById('menuBtn');
  var drawer = document.getElementById('drawer');
  var overlay = document.getElementById('overlay');
  var searchBtn = document.getElementById('searchBtn');
  var searchStrip = document.getElementById('searchStrip');
  var searchInput = document.getElementById('searchInput');
  var searchClear = document.getElementById('searchClear');
  var bellBtn = document.getElementById('bellBtn');
  var notifPanel = document.getElementById('notifPanel');
  var logoutBtn = document.getElementById('logoutBtn');

  var state = {
    query: ''
  };

  /* No red notification badge — the plain bell opens notifications. */
  if (greetingInner) {
    greetingInner.hidden = true;
  }

  /* Show the skeleton first; content renders once ready. */
  if (productWrap) {
    productWrap.hidden = true;
  }

  /* ----------------------------------------------------------
     2. Session check + personalised greeting (auth guard)
     ---------------------------------------------------------- */
  fetch('/api/me', { credentials: 'same-origin' })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.authenticated || !data.user) {
        window.location.replace('login.html');
        return;
      }
      renderGreeting(data.user);
      revealReady();
    })
    .catch(function () {
      window.location.replace('login.html');
    });

  function renderGreeting(user) {
    if (!userNameEl || !greetingInner) {
      return;
    }
    var raw = String(user.fullName || user.username || 'Farmer').trim();
    var name = raw.split(/\s+/)[0];
    userNameEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    if (nameSkeleton) {
      nameSkeleton.hidden = true;
    }
    greetingInner.hidden = false;
  }

  function requireAuth(next) {
    fetch('/api/me', { credentials: 'same-origin' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.authenticated) {
          next();
        } else {
          window.location.href = 'login.html';
        }
      })
      .catch(function () {
        window.location.href = 'login.html';
      });
  }

  function showCropDemo() {
    if (cropDemo) {
      cropDemo.hidden = false;
      try {
        window.dispatchEvent(new CustomEvent('seed2serve_open_crop_demo'));
      } catch (e) {}
    }
  }

  function closeCropDemo() {
    if (cropDemo) {
      cropDemo.hidden = true;
    }
  }

  function showCropDemoError(message) {
    if (!cropDemoError) {
      return;
    }
    cropDemoError.textContent = message || '';
    cropDemoError.hidden = !message;
  }

  function renderCropResults(data) {
    if (!cropDemoResults) {
      return;
    }
    var crops = Array.isArray(data.top_crops) ? data.top_crops : [];
    cropDemoResults.innerHTML = '<h3>Recommended crops</h3>';
    if (!crops.length) {
      cropDemoResults.insertAdjacentHTML('beforeend', '<p>No recommendations were returned.</p>');
    } else {
      var list = document.createElement('ol');
      crops.forEach(function (crop) {
        var item = document.createElement('li');
        item.textContent = String(crop.crop_name || 'Unnamed crop');
        var details = document.createElement('span');
        details.textContent = 'Score: ' + String(crop.score_pct ?? crop.total_score ?? 'n/a') + '%';
        item.appendChild(details);
        list.appendChild(item);
      });
      cropDemoResults.appendChild(list);
    }
    cropDemoResults.hidden = false;
  }

  function submitCropDemo(e) {
    e.preventDefault();
    if (!cropDemoForm) {
      return;
    }
    var formData = new FormData(cropDemoForm);
    var payload = {};
    formData.forEach(function (value, key) {
      if (String(value).trim() !== '') {
        payload[key] = key === 'state_name' ? String(value).trim() : Number(value);
      }
    });
    if (payload.ph === undefined) {
      showCropDemoError('Enter a soil pH value.');
      return;
    }
    if (!((payload.lat !== undefined && payload.lon !== undefined) || payload.state_name)) {
      showCropDemoError('Enter both latitude and longitude, or enter an Indian state.');
      return;
    }
    showCropDemoError('');
    if (cropDemoResults) {
      cropDemoResults.hidden = true;
    }
    if (cropDemoSubmit) {
      cropDemoSubmit.disabled = true;
      cropDemoSubmit.textContent = 'Loading recommendations...';
    }
    fetch('/api/agrozone/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            throw new Error(data.message || data.error || 'Recommendation request failed.');
          }
          return data;
        });
      })
      .then(renderCropResults)
      .catch(function (err) {
        showCropDemoError(err.message || 'Unable to load recommendations.');
      })
      .finally(function () {
        if (cropDemoSubmit) {
          cropDemoSubmit.disabled = false;
          cropDemoSubmit.textContent = 'Get recommendations';
        }
      });
  }

  if (cropDemoClose) {
    cropDemoClose.addEventListener('click', closeCropDemo);
  }
  if (cropDemo) {
    cropDemo.addEventListener('click', function (e) {
      if (e.target === cropDemo) {
        closeCropDemo();
      }
    });
  }
  if (cropDemoForm) {
    cropDemoForm.addEventListener('submit', submitCropDemo);
  }

  function revealReady() {
    if (bannerSkeleton) {
      bannerSkeleton.hidden = true;
    }
    if (bannerContent) {
      bannerContent.hidden = false;
    }
    if (bannerMedia) {
      bannerMedia.hidden = false;
    }
    window.setTimeout(function () {
      renderProducts();
      if (productSkeleton) {
        productSkeleton.hidden = true;
      }
      if (productWrap) {
        productWrap.hidden = false;
      }
    }, 320);
  }

  /* ----------------------------------------------------------
     3. Product rendering — dashboard hero cards fed by the
        shared data (js/data/products.js).
     ---------------------------------------------------------- */
  function visibleProducts() {
    var q = state.query.trim().toLowerCase();
    return PRODUCTS.filter(function (p) {
      return !q || (p.title + ' ' + p.desc + ' ' + p.info).toLowerCase().indexOf(q) !== -1;
    });
  }

  function productCardHTML(p, index) {
    return (
      '<article class="dash-card" data-index="' + index + '" data-slug="' + p.slug + '">' +
        '<div class="dash-card__inner">' +
          '<div class="dash-card__face dash-card__front">' +
            '<img class="dash-card__img" src="' + p.img + '" alt="' + p.alt + '" loading="lazy" />' +
            '<span class="dash-card__shade" aria-hidden="true"></span>' +
            '<span class="dash-card__icon" aria-hidden="true">' + p.iconFront + '</span>' +
            '<div class="dash-card__body">' +
              '<h3 class="dash-card__name">' + p.title + '</h3>' +
              '<p class="dash-card__desc">' + p.desc + '</p>' +
              '<span class="dash-card__accent" aria-hidden="true"></span>' +
            '</div>' +
          '</div>' +
          '<div class="dash-card__face dash-card__back">' +
            '<button class="dash-card__close" type="button" aria-label="Close details">' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>' +
            '</button>' +
            '<span class="dash-card__back-icon" aria-hidden="true">' + p.iconBack + '</span>' +
            '<h3 class="dash-card__back-name">' + p.title + '</h3>' +
            '<p class="dash-card__back-desc">' + p.info + '</p>' +
            '<button class="btn btn--primary dash-card__demo" type="button" data-product="' + p.slug + '">Get Started</button>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderProducts() {
    var items = visibleProducts();

    if (emptyState) {
      emptyState.hidden = items.length > 0;
    }
    if (productList) {
      productList.hidden = items.length === 0;
    }

    if (items.length === 0) {
      return;
    }

    productList.innerHTML = items.map(productCardHTML).join('');
    bindCards(productList);
  }

  function bindCards(scope) {
    scope.querySelectorAll('.dash-card').forEach(function (card) {
      var front = card.querySelector('.dash-card__front');
      var back = card.querySelector('.dash-card__back');
      var closeBtn = card.querySelector('.dash-card__close');
      var demoBtn = card.querySelector('.dash-card__demo');

      if (front) {
        front.addEventListener('click', function () {
          card.classList.add('is-flipped');
        });
      }

      if (back) {
        back.addEventListener('click', function (e) {
          if (!e.target.closest('button')) {
            card.classList.remove('is-flipped');
          }
        });
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          card.classList.remove('is-flipped');
        });
      }

      if (demoBtn) {
        demoBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (card.getAttribute('data-slug') === 'crop-recommendation') {
            window.location.href = 'http://127.0.0.1:8000/recommend/';
          } else if (card.getAttribute('data-slug') === 'leaf-disease-detection') {
            window.location.href = 'http://127.0.0.1:8001/api/';
          } else if (card.getAttribute('data-slug') === 'yield-estimation-prediction') {
            window.location.href = 'http://127.0.0.1:8002/';
          } else if (card.getAttribute('data-slug') === 'fertilizer-recommendation') {
            window.location.href = 'http://127.0.0.1:8003/';
          }
        });
      }
    });
  }

  /* ----------------------------------------------------------
     6. Search
     ---------------------------------------------------------- */
  searchBtn.addEventListener('click', function () {
    var show = searchStrip.hidden;
    searchStrip.hidden = !show;
    if (show) {
      searchInput.focus();
    }
  });

  searchInput.addEventListener('input', function () {
    state.query = searchInput.value;
    renderProducts();
  });

  searchClear.addEventListener('click', function () {
    searchInput.value = '';
    state.query = '';
    renderProducts();
    searchInput.focus();
  });

  /* ----------------------------------------------------------
     7. Empty state - explore all
     ---------------------------------------------------------- */
  exploreAll.addEventListener('click', function () {
    state.query = '';
    if (searchInput) {
      searchInput.value = '';
    }
    renderProducts();
  });

  /* ----------------------------------------------------------
     8. Drawer + notifications
     ---------------------------------------------------------- */
  function openDrawer(open) {
    drawer.classList.toggle('is-open', open);
    overlay.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  menuBtn.addEventListener('click', function () {
    openDrawer(!drawer.classList.contains('is-open'));
  });

  overlay.addEventListener('click', function () {
    openDrawer(false);
  });

  // Close when the user presses Escape.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      openDrawer(false);
    }
  });

  bellBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    notifPanel.hidden = !notifPanel.hidden;
  });

  document.addEventListener('click', function (e) {
    if (!notifPanel.hidden && !e.target.closest('.dash-notif') && e.target !== bellBtn && !bellBtn.contains(e.target)) {
      notifPanel.hidden = true;
    }
  });

  /* ----------------------------------------------------------
     9. Navigation (hamburger sidebar)
     ---------------------------------------------------------- */
  function goProducts() {
    var section = document.getElementById('products');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function goHome() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeDrawer() {
    openDrawer(false);
  }

  document.querySelectorAll('[data-nav]').forEach(function (item) {
    item.addEventListener('click', function () {
      var target = item.getAttribute('data-nav');
      if (target === 'products') {
        closeDrawer();
        window.setTimeout(goProducts, 280);
      } else if (target === 'profile') {
        closeDrawer();
        window.setTimeout(function () {
          window.location.href = 'profile.html';
        }, 200);
      } else {
        closeDrawer();
        window.setTimeout(goHome, 280);
      }
    });
  });

  // "Back to site" in the sidebar also closes the drawer.
  drawer.querySelectorAll('a[href="index.html#home"]').forEach(function (link) {
    link.addEventListener('click', function () {
      closeDrawer();
    });
  });

  /* Active state: Home ↔ Products as you scroll */
  var productsSection = document.getElementById('products');
  var sideHome = drawer.querySelector('.dash-side-item[data-nav="home"]');
  var sideProducts = drawer.querySelector('.dash-side-item[data-nav="products"]');

  function setActive(which) {
    [sideHome, sideProducts].forEach(function (el) {
      if (el) {
        el.classList.toggle('is-active', el === which);
      }
    });
  }

  if (productsSection && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          setActive(entry.isIntersecting ? sideProducts : sideHome);
        });
      },
      { threshold: 0.15 }
    );
    obs.observe(productsSection);
  }

  /* ----------------------------------------------------------
     10. Log out
     ---------------------------------------------------------- */
  function doLogout() {
    if (logoutBtn) {
      logoutBtn.disabled = true;
    }
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
      .then(function () {
        window.location.href = 'login.html';
      })
      .catch(function () {
        window.location.href = 'login.html';
      });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', doLogout);
  }
})();