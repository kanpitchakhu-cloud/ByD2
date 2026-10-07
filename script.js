/* ==========================================================================
   Body Scent — shared script (product / order / admin)
   Each page runs only the functions whose elements exist on that page.
   ========================================================================== */

(function () {
  'use strict';

  var ORDERS_KEY = 'bodyScentOrders';

  var MOODS = [
    { key: 'all',       label: 'ทั้งหมด' },
    { key: 'fresh',     label: 'Fresh' },
    { key: 'sweet',     label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance',   label: 'Romance' }
  ];

  var MOOD_LABELS = {
    fresh: 'Fresh',
    sweet: 'Sweet',
    confident: 'Confident',
    romance: 'Romance'
  };

  /* ---------- Helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function isFormField(node) {
    var tag = node.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function setFieldValue(node, value) {
    if (isFormField(node)) {
      node.value = value;
    } else {
      node.textContent = value;
    }
  }

  function getFieldValue(node) {
    return isFormField(node) ? node.value : node.textContent;
  }

  function formatPrice(n) {
    return Number(n).toLocaleString('th-TH');
  }

  function readOrders() {
    try {
      var raw = localStorage.getItem(ORDERS_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Cannot read orders:', err);
      return [];
    }
  }

  /* ======================================================================
     product.html
     ====================================================================== */

  function initProductPage(listEl) {
    var filterBar = document.getElementById('filter-bar');
    var products = [];
    var currentMood = 'all';

    function validMood(mood) {
      return MOODS.some(function (m) { return m.key === mood; }) ? mood : 'all';
    }

    function buildCard(p) {
      var card = el('article', 'product-card');
      card.setAttribute('data-mood', p.mood);

      var media = el('div', 'product-card__media');
      var img = document.createElement('img');
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';
      media.appendChild(img);

      var body = el('div', 'product-card__body');

      var moodRow = el('div', 'product-card__mood');
      moodRow.appendChild(el('span', 'mood-dot'));
      moodRow.appendChild(el('span', '', MOOD_LABELS[p.mood] || p.mood));

      var name = el('h3', 'product-card__name', p.name);
      var desc = el('p', 'product-card__desc', p.description);

      var foot = el('div', 'product-card__foot');
      var price = el('span', 'price', formatPrice(p.price));
      price.appendChild(el('small', '', 'บาท'));
      foot.appendChild(price);
      if (p.size) foot.appendChild(el('span', 'size', p.size));

      var buy = el('a', 'btn btn--ghost btn--block', 'สั่งซื้อ');
      buy.href =
        'order.html?item=' + encodeURIComponent(p.name) +
        '&price=' + encodeURIComponent(p.price);
      buy.style.marginTop = '1.5rem';

      body.appendChild(moodRow);
      body.appendChild(name);
      body.appendChild(desc);
      body.appendChild(foot);
      body.appendChild(buy);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function render() {
      var shown = products.filter(function (p) {
        return currentMood === 'all' || p.mood === currentMood;
      });

      listEl.innerHTML = '';
      if (shown.length === 0) {
        listEl.appendChild(el('p', 'muted', 'ไม่พบสินค้าในหมวดนี้'));
        return;
      }
      shown.forEach(function (p) { listEl.appendChild(buildCard(p)); });
    }

    function updateButtons() {
      if (!filterBar) return;
      var buttons = filterBar.querySelectorAll('[data-mood]');
      Array.prototype.forEach.call(buttons, function (btn) {
        var active = btn.getAttribute('data-mood') === currentMood;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.classList.toggle('is-active', active);
      });
    }

    function setMood(mood) {
      currentMood = validMood(mood);
      updateButtons();
      render();

      // keep the URL in sync so the filtered view can be shared
      try {
        var url = new URL(window.location.href);
        if (currentMood === 'all') {
          url.searchParams.delete('mood');
        } else {
          url.searchParams.set('mood', currentMood);
        }
        window.history.replaceState(null, '', url);
      } catch (err) { /* non-critical */ }
    }

    function setupFilterBar() {
      if (!filterBar) return;

      // create buttons only if the page doesn't already provide them
      if (!filterBar.querySelector('[data-mood]')) {
        MOODS.forEach(function (m) {
          var btn = el('button', 'filter', m.label);
          btn.type = 'button';
          btn.setAttribute('data-mood', m.key);
          filterBar.appendChild(btn);
        });
      }

      filterBar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-mood]');
        if (btn && filterBar.contains(btn)) setMood(btn.getAttribute('data-mood'));
      });
    }

    setupFilterBar();
    currentMood = validMood(new URLSearchParams(window.location.search).get('mood'));
    updateButtons();

    fetch('products.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        render();
      })
      .catch(function (err) {
        console.error('Cannot load products.json:', err);
        listEl.innerHTML = '';
        listEl.appendChild(
          el('p', 'muted', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
        );
      });
  }

  /* ======================================================================
     order.html
     ====================================================================== */

  function initOrderPage(form) {
    var itemsEl = document.getElementById('items');
    var totalEl = document.getElementById('total');
    var params = new URLSearchParams(window.location.search);

    var item = params.get('item');
    var price = params.get('price');
    var priceNum = Number(price);

    // always fill both fields, even if a parameter is missing
    if (itemsEl) setFieldValue(itemsEl, item ? item : 'ไม่ระบุสินค้า');
    if (totalEl) {
      var validPrice = price !== null && price !== '' && isFinite(priceNum);
      setFieldValue(totalEl, String(validPrice ? priceNum : 0));
    }

    function field(name) {
      var f = form.elements[name];
      return f && f.value !== undefined ? f.value.trim() : '';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

      var totalText = totalEl ? getFieldValue(totalEl) : '0';
      var total = Number(String(totalText).replace(/[^\d.]/g, ''));

      var payload = {
        customerName: field('customerName'),
        contact: field('contact'),
        items: itemsEl ? getFieldValue(itemsEl).trim() : '',
        total: isFinite(total) ? total : 0,
        note: field('note'),
        timestamp: new Date().toISOString()
      };

      try {
        var orders = readOrders();
        orders.push(payload);
        localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      } catch (err) {
        console.error('Cannot save order:', err);
        alert('บันทึกคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      window.location.href = 'thankyou.html';
    });
  }

  /* ======================================================================
     admin.html
     ====================================================================== */

  function initAdminPage(table) {
    var tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
    var columnCount = table.querySelectorAll('thead th').length || 6;

    var orders = readOrders().slice().sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp); // newest first
    });

    tbody.innerHTML = '';

    if (orders.length === 0) {
      var emptyRow = document.createElement('tr');
      var emptyCell = el('td', '', 'ยังไม่มีคำสั่งซื้อ');
      emptyCell.colSpan = columnCount;
      emptyCell.style.textAlign = 'center';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    orders.forEach(function (o) {
      var date = new Date(o.timestamp);
      var dateText = isNaN(date.getTime()) ? '-' : date.toLocaleString('th-TH');
      var totalText = isFinite(Number(o.total)) ? formatPrice(o.total) + ' บาท' : '-';

      var row = document.createElement('tr');
      [dateText, o.customerName, o.contact, o.items, totalText, o.note].forEach(function (v) {
        row.appendChild(el('td', '', v ? v : '-'));
      });
      tbody.appendChild(row);
    });
  }

  /* ---------- Boot: run only what this page has ---------- */

  function init() {
    var productList = document.getElementById('product-list');
    var orderForm = document.getElementById('orderForm');
    var ordersTable = document.getElementById('ordersTable');

    if (productList) initProductPage(productList);
    if (orderForm) initOrderPage(orderForm);
    if (ordersTable) initAdminPage(ordersTable);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
