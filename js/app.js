/**
 * GeoShelf - Main Page Logic
 */
(function () {
  'use strict';

  let allBooks = [];
  let currentLevel = 'all';
  let currentContent = 'all';
  let searchQuery = '';
  let showNewOnly = false;
  let currentProject = 'all';
  let currentPage = 1;
  let pageSize = 20;

  // 내용별 위계 구조
  const CONTENT_HIERARCHY = {
    '자연지리': ['기후', '지형'],
    '인문지리': ['문화', '역사', '도시', '촌락', '인구', '경제', '정치']
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initFilters();
    initSearch();
    initPageSize();
    initModal();
    loadBooks();
    trackView();
  });

  // ---- Mobile Menu ----
  function initMobileMenu() {
    const btn = $('#mobileMenuBtn');
    const nav = $('#mobileNav');
    if (btn && nav) {
      btn.addEventListener('click', () => nav.classList.toggle('open'));
    }
  }

  // ---- 신간 판별 (출판일 기준 60일 이내 또는 미래 출간) ----
  function isNewBook(book) {
    const pubDate = book['출판일'];
    if (!pubDate) return false;
    const pub = new Date(pubDate).getTime();
    if (isNaN(pub)) return false;
    const diff = Date.now() - pub;
    return diff <= 90 * 24 * 60 * 60 * 1000;
  }

  // ---- Filters ----
  function initFilters() {
    // Level filter (수준별)
    $$('#levelFilters .chip:not(.chip-new)').forEach((chip) => {
      chip.addEventListener('click', () => {
        $$('#levelFilters .chip:not(.chip-new)').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        currentLevel = chip.dataset.value;
        // 신간 토글 해제
        showNewOnly = false;
        $('#newBookFilter').classList.remove('active');
        currentPage = 1;
        renderBooks();
      });
    });

    // 신간 필터 (독립 토글)
    const newBtn = $('#newBookFilter');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        showNewOnly = !showNewOnly;
        newBtn.classList.toggle('active', showNewOnly);
        currentPage = 1;
        renderBooks();
      });
    }

    // Content filter (hierarchical)
    $$('#contentFilters .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        // Deactivate all main chips
        $$('#contentFilters .chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');

        const value = chip.dataset.value;
        const subPanel = $('#contentSubFilters');

        if (chip.classList.contains('chip-parent') && CONTENT_HIERARCHY[value]) {
          // Show sub-chips for parent category
          const children = CONTENT_HIERARCHY[value];
          subPanel.innerHTML =
            `<button class="chip active" data-value="${value}">전체</button>` +
            children.map((c) => `<button class="chip" data-value="${c}">${c}</button>`).join('');
          subPanel.style.display = '';

          // Set filter to parent (includes all children)
          currentContent = value;

          // Bind sub-chip clicks
          subPanel.querySelectorAll('.chip').forEach((sub) => {
            sub.addEventListener('click', () => {
              subPanel.querySelectorAll('.chip').forEach((s) => s.classList.remove('active'));
              sub.classList.add('active');
              currentContent = sub.dataset.value;
              currentPage = 1;
              renderBooks();
            });
          });
        } else {
          // Hide sub-chips for non-parent
          subPanel.style.display = 'none';
          subPanel.innerHTML = '';
          currentContent = value;
        }

        currentPage = 1;
        renderBooks();
      });
    });
  }

  // ---- Search ----
  function initSearch() {
    const input = $('#searchInput');
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        searchQuery = input.value.trim().toLowerCase();
        currentPage = 1;
        renderBooks();
      }, 300);
    });
  }

  // ---- Load Books ----
  async function loadBooks() {
    const loading = $('#loading');
    loading.style.display = '';

    if (CONFIG.DEMO_MODE) {
      await delay(400);
      allBooks = DEMO_BOOKS;
    } else {
      try {
        const res = await fetch(CONFIG.API_URL + '?action=getBooks');
        const data = await res.json();
        if (data.success) {
          allBooks = data.books;
        }
      } catch (err) {
        console.error('Failed to load books:', err);
        allBooks = [];
      }
    }

    loading.style.display = 'none';
    buildProjectFilter();
    renderBooks();
    loadStats();
  }

  // ---- Content filter matching (with hierarchy) ----
  function matchesContentFilter(bookContent) {
    if (currentContent === 'all') return true;

    // If current filter is a parent category, match parent + all children
    if (CONTENT_HIERARCHY[currentContent]) {
      const group = [currentContent, ...CONTENT_HIERARCHY[currentContent]];
      return group.includes(bookContent);
    }

    // Direct match for specific sub-category or standalone
    return bookContent === currentContent;
  }

  // ---- Page Size ----
  function initPageSize() {
    const select = $('#pageSize');
    select.addEventListener('change', () => {
      pageSize = Number(select.value);
      currentPage = 1;
      renderBooks();
    });
  }

  // ---- Project Filter ----
  function getBookProjects(book) {
    const projects = [];
    for (let i = 1; i <= 5; i++) {
      const val = book['지정도서목록' + i];
      if (val && String(val).trim()) projects.push(String(val).trim());
    }
    return projects;
  }

  function buildProjectFilter() {
    const select = $('#projectFilter');
    const group = $('#projectFilterGroup');
    if (!select || !group) return;

    const projectSet = new Set();
    allBooks.forEach((book) => {
      getBookProjects(book).forEach((p) => projectSet.add(p));
    });

    if (projectSet.size === 0) {
      group.style.display = 'none';
      return;
    }

    const sorted = [...projectSet].sort();
    select.innerHTML = '<option value="all">전체 도서</option>' +
      sorted.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');

    group.style.display = '';

    select.addEventListener('change', () => {
      currentProject = select.value;
      currentPage = 1;
      renderBooks();
    });
  }

  // ---- Render Books ----
  function renderBooks() {
    const grid = $('#bookGrid');
    const empty = $('#emptyState');
    const count = $('#resultCount');

    const filtered = allBooks.filter((book) => {
      if (showNewOnly && !isNewBook(book)) return false;
      if (currentLevel !== 'all' && book['수준별'] !== currentLevel) return false;
      if (!matchesContentFilter(book['내용별'])) return false;
      if (currentProject !== 'all' && !getBookProjects(book).includes(currentProject)) return false;
      if (searchQuery) {
        const hay = [
          book['도서명'], book['부제'], book['저자'], book['출판사'], book['ISBN']
        ].join(' ').toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      const da = a['출판일'] || '';
      const db = b['출판일'] || '';
      if (da !== db) return da > db ? -1 : 1;
      return (a['도서명'] || '').localeCompare(b['도서명'] || '', 'ko');
    });

    count.textContent = filtered.length;
    const paginationEl = $('#pagination');

    if (filtered.length === 0) {
      grid.innerHTML = '';
      empty.style.display = '';
      paginationEl.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(filtered.length / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    empty.style.display = 'none';
    grid.innerHTML = paged.map((book) => cardHTML(book)).join('');

    grid.querySelectorAll('.book-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const book = allBooks.find((b) => b.ID === id);
        if (book) openModal(book);
      });
    });

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const el = $('#pagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = startPage + maxVisible - 1;
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    let html = '';
    html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="1">&laquo;</button>`;
    html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">&lsaquo;</button>`;

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="page-btn${i === currentPage ? ' active' : ''}" data-page="${i}">${i}</button>`;
    }

    html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">&rsaquo;</button>`;
    html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${totalPages}">&raquo;</button>`;

    el.innerHTML = html;
    el.querySelectorAll('.page-btn:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentPage = Number(btn.dataset.page);
        renderBooks();
        window.scrollTo({ top: $('#bookGrid').offsetTop - 80, behavior: 'smooth' });
      });
    });
  }

  function cardHTML(book) {
    const coverContent = book['표지URL']
      ? `<img src="${escapeHtml(book['표지URL'])}" alt="${escapeHtml(book['도서명'])}" loading="lazy">`
      : `<div class="cover-placeholder">
           <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#ccc" stroke-width="1.5">
             <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
             <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
           </svg>
           <span>${escapeHtml(book['내용별'])}</span>
         </div>`;

    const newBadge = isNewBook(book) ? '<span class="new-badge">N</span>' : '';

    return `
      <div class="book-card" data-id="${book.ID}">
        ${newBadge}
        <div class="cover-wrap">${coverContent}</div>
        <div class="info">
          <div class="book-title">${escapeHtml(book['도서명'])}</div>
          ${book['부제'] ? `<div class="book-subtitle">${escapeHtml(book['부제'])}</div>` : ''}
          <div class="book-author">${escapeHtml(book['저자'])}</div>
          <div class="book-publisher">${escapeHtml(book['출판사'])}</div>
          <div class="badges">
            <span class="badge badge--level">${escapeHtml(book['수준별'])}</span>
            <span class="badge badge--content">${escapeHtml(book['내용별'])}</span>
          </div>
        </div>
      </div>`;
  }

  // ---- Modal ----
  function initModal() {
    const overlay = $('#bookModal');
    const closeBtn = $('#modalClose');

    closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') overlay.classList.remove('open');
    });
  }

  function buildBuyLinks(book) {
    const stores = [
      { name: '교보문고', cls: 'kyobo', key: '교보문고' },
      { name: 'Yes24', cls: 'yes24', key: 'Yes24' },
      { name: '알라딘', cls: 'aladin', key: '알라딘' },
      { name: '기타', cls: 'etc', key: '기타' }
    ];

    const buttons = stores
      .filter((s) => book[s.key])
      .map((s) =>
        `<a href="${escapeHtml(book[s.key])}" target="_blank" rel="noopener" class="buy-btn buy-btn--${s.cls}">${s.name}</a>`
      );

    if (buttons.length === 0) return '';
    return `<div class="buy-links">${buttons.join('')}</div>`;
  }

  function openModal(book) {
    const body = $('#modalBody');
    const overlay = $('#bookModal');

    const coverContent = book['표지URL']
      ? `<img src="${escapeHtml(book['표지URL'])}" alt="">`
      : `<div class="cover-placeholder">
           <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#ccc" stroke-width="1.5">
             <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
             <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
           </svg>
         </div>`;

    body.innerHTML = `
      <div class="modal-detail">
        <div class="modal-cover">${coverContent}</div>
        <div class="modal-info">
          <h2>${escapeHtml(book['도서명'])}</h2>
          ${book['부제'] ? `<p class="modal-subtitle">${escapeHtml(book['부제'])}</p>` : ''}
          <div class="detail-row"><span class="detail-label">저자</span><span class="detail-value">${escapeHtml(book['저자'])}</span></div>
          <div class="detail-row"><span class="detail-label">출판사</span><span class="detail-value">${escapeHtml(book['출판사'])}</span></div>
          <div class="detail-row"><span class="detail-label">출판일</span><span class="detail-value">${escapeHtml(formatDate(book['출판일']))}</span></div>
          <div class="detail-row"><span class="detail-label">ISBN</span><span class="detail-value">${escapeHtml(book['ISBN'] || '-')}</span></div>
          <div class="modal-badges">
            <span class="badge badge--level">${escapeHtml(book['수준별'])}</span>
            <span class="badge badge--content">${escapeHtml(book['내용별'])}</span>
          </div>
          ${buildBuyLinks(book)}
        </div>
      </div>`;

    overlay.classList.add('open');
  }

  // ---- Viewership ----
  async function trackView() {
    if (CONFIG.DEMO_MODE) return;
    try {
      await fetch(CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'addView' }),
        headers: { 'Content-Type': 'text/plain' }
      });
    } catch (err) {
      console.error('View tracking failed:', err);
    }
  }

  async function loadStats() {
    const todayEl = $('#todayCount');
    const totalEl = $('#totalCount');

    if (CONFIG.DEMO_MODE) {
      todayEl.textContent = '42';
      totalEl.textContent = '1,580';
      return;
    }

    try {
      const res = await fetch(CONFIG.API_URL + '?action=getStats');
      const data = await res.json();
      if (data.success) {
        todayEl.textContent = data.today.toLocaleString();
        totalEl.textContent = data.total.toLocaleString();
      }
    } catch (err) {
      console.error('Stats load failed:', err);
    }
  }

  // ---- Utilities ----
  function formatDate(val) {
    if (!val) return '-';
    return String(val).slice(0, 10);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
})();
