/* ============================================================
   Seed2Serve — Products data
   Single source of truth for the products shown on the public
   Products section and (after login) the Farmer Dashboard.

   The product names, descriptions, images, and SVG icons below
   mirror the original product cards exactly — do not invent or
   replace products here without updating every consumer.
   The dashboard renders its own hero cards from this data.

   Category is OPTIONAL. If a product has a `category` value the
   dashboard generates its filter chips from these values. (The
   original site defines no categories, so none are set.)
   ============================================================ */
(function () {
  'use strict';

  var ICON_ATTRS_FRONT =
    'viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var ICON_ATTRS_BACK =
    'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

  window.SEED2SERVE_PRODUCTS = [
    {
      slug: 'crop-recommendation',
      name: 'Crop Recommendation & Planning',
      desc: 'Plan the right crop with AI-driven insights and recommendations.',
      info: 'AI-powered recommendations to help farmers choose the right crops and plan better.',
      img: 'assets/products/crop-planting.jpg',
      alt: 'Young crop seedling growing in soil',
      iconFront:
        '<svg ' + ICON_ATTRS_FRONT + '><path d="M12 4v16M4 12h16" /><circle cx="12" cy="12" r="9" /><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /><circle cx="5.5" cy="12" r="1.6" /><circle cx="18.5" cy="12" r="1.6" /></svg>',
      iconBack:
        '<svg ' + ICON_ATTRS_BACK + '><path d="M12 3c1.6 2.8 2.2 5 2.2 7.2 0 2.6-1 4.8-2.2 6.3-1.2-1.5-2.2-3.7-2.2-6.3C9.8 8 10.4 5.8 12 3Z" /><path d="M5 3c3 .8 5 3 5 6 0 2-.6 3.6-1.6 4.6A6 6 0 0 1 5 3Z" /><path d="M19 3c-3 .8-5 3-5 6 0 2 .6 3.6 1.6 4.6A6 6 0 0 1 19 3Z" /><path d="M12 16.5V21M8 21h8" /></svg>'
    },
    {
      slug: 'fertilizer-recommendation',
      name: 'Fertilizer Recommendation',
      desc: 'Get the right fertilizer suggestions for better soil health.',
      info: 'Get smart fertilizer recommendations based on crop needs for healthier and better growth.',
      img: 'assets/products/fertilizer.jpg',
      alt: 'Hands planting in soil with fertilizer',
      iconFront:
        '<svg ' + ICON_ATTRS_FRONT + '><path d="M4 7h16l-1.5 12a1 1 0 0 1-1 .8h-11a1 1 0 0 1-1-.8L4 7Z" /><path d="M8 7a4 4 0 0 1 8 0" /><path d="M9 12h.01M15 12h.01" /></svg>',
      iconBack:
        '<svg ' + ICON_ATTRS_BACK + '><path d="M4 7h16l-1.5 12a1 1 0 0 1-1 .8h-11a1 1 0 0 1-1-.8L4 7Z" /><path d="M8 7a4 4 0 0 1 8 0" /><path d="M14 14c1.5-2.2-1-4.2-3-2.5-.5 1.2 0 2.5 1 3.5l2-1Z" /></svg>'
    },
    {
      slug: 'leaf-disease-detection',
      name: 'Leaf Disease Detection',
      desc: 'Detect diseases early using AI and protect your crops.',
      info: 'Detect crop diseases quickly using AI-powered leaf image analysis and protect your harvest.',
      img: 'assets/products/disease-detection.jpg',
      alt: 'Close-up of a crop leaf',
      iconFront:
        '<svg ' + ICON_ATTRS_FRONT + '><path d="M12 3l8 3v5c0 4.5-3.2 8.4-8 10-4.8-1.6-8-5.5-8-10V6l8-3Z" /><path d="M12 8v4M12 15.5h.01" /></svg>',
      iconBack:
        '<svg ' + ICON_ATTRS_BACK + '><path d="M9 16c-2.2-1.6-3-3.6-2.4-5.7C7.4 7.6 9 6 11 5.5c2-.5 3.4.6 4 2.6.5 1.9-.4 4-2.4 5.3-.4 1.6-1.2 2.6-3.6 2.6Z" /><path d="M10.5 10.5 19 19" /><circle cx="9" cy="10" r="4.5" /></svg>'
    },
    {
      slug: 'yield-estimation-prediction',
      name: 'Yield Estimation & Prediction',
      desc: 'Predict the best harvest time and maximize crop value.',
      info: 'Predict expected crop yield using intelligent data analysis for better planning.',
      img: 'assets/products/harvest.jpg',
      alt: 'Ripe crops ready for harvesting',
      iconFront:
        '<svg ' + ICON_ATTRS_FRONT + '><path d="M4 20h16" /><path d="M6 16l4-6 3 3 5-8" /><path d="M18 5h-2M18 5v2" /></svg>',
      iconBack:
        '<svg ' + ICON_ATTRS_BACK + '><path d="M4 20h16" /><path d="M7 16l3.5-5 2.5 3 4-6" /><path d="M5 3v6" /><path d="M4 9h2" /><path d="M7 3v3.5M5.5 6.5H8.5" /></svg>'
    },
    {
      slug: 'fruit-vegetable-grading',
      name: 'Fruit & Vegetable Grading System',
      desc: 'Grade fruits and vegetables by quality for fast, fair market value.',
      info: 'AI-powered grading to assess produce quality quickly, accurately, and consistently.',
      img: 'assets/products/water-management.jpg',
      alt: 'Irrigation water flowing onto crops',
      iconFront:
        '<svg ' + ICON_ATTRS_FRONT + '><path d="M12 3c4 4.3 6 7.1 6 10a6 6 0 0 1-12 0c0-2.9 2-5.7 6-10Z" /><path d="M10 13a2.5 2.5 0 0 0 2 2.5" /></svg>',
      iconBack:
        '<svg ' + ICON_ATTRS_BACK + '><path d="M12 6c-3 0-5 2.2-5 5.2C7 14.9 9.2 17 12 17s5-2.1 5-5.8C17 8.2 15 6 12 6Z" /><path d="M12 6c1-1.8 2.6-2.6 4.8-2.5-.2 2.2-1 3.8-2.8 4.6" /><path d="M20.5 18.5l-3 3-1.5-1.5" /></svg>'
    }
  ];

  window.SEED2SERVE_ICONS = {
    close:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>',
    arrow:
      '<svg class="product-card__arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>'
  };
})();