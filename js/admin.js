/**
 * GeoBooks - Admin Page Logic
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  let adminPassword = '';
  let pendingBooks = [];
  let approvedBooks = [];
  let adminSearchQuery = '';
  let confirmCallback = null;

  document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initConfirmModal();
    initEditModal();
  });

  // ---- Login ----
  function initLogin() {
    const loginBtn = $('#loginBtn');
    const passwordInput = $('#adminPassword');
    const errorEl = $('#loginError');

    const doLogin = () => {
      const pw = passwordInput.value.trim();
      if (!pw) {
        showError('비밀번호를 입력하세요.');
        return;
      }

      if (CONFIG.DEMO_MODE) {
        if (pw === CONFIG.ADMIN_PASSWORD) {
          adminPassword = pw;
          showAdminPanel();
          loadAll();
        } else {
          showError('비밀번호가 올바르지 않습니다.');
        }
        return;
      }

      adminPassword = pw;
      loadPending().then((success) => {
        if (success) {
          showAdminPanel();
          loadApproved();
        } else {
          showError('비밀번호가 올바르지 않습니다.');
          adminPassword = '';
        }
      });
    };

    loginBtn.addEventListener('click', doLogin);
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.style.display = '';
    }
  }

  function showAdminPanel() {
    $('#loginSection').style.display = 'none';
    $('#adminPanel').style.display = '';

    $('#refreshBtn').addEventListener('click', () => loadAll());
    $('#logoutBtn').addEventListener('click', () => {
      adminPassword = '';
      $('#loginSection').style.display = '';
      $('#adminPanel').style.display = 'none';
      $('#adminPassword').value = '';
      $('#loginError').style.display = 'none';
    });

    const searchInput = $('#adminSearchInput');
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        adminSearchQuery = searchInput.value.trim().toLowerCase();
        renderApproved();
      }, 300);
    });
  }

  function loadAll() {
    loadPending();
    loadApproved();
  }

  // ---- Load Pending Books ----
  async function loadPending() {
    const loading = $('#adminLoading');
    const empty = $('#adminEmpty');
    const list = $('#pendingList');

    loading.style.display = '';
    empty.style.display = 'none';
    list.innerHTML = '';

    if (CONFIG.DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 400));
      pendingBooks = [...DEMO_PENDING];
      loading.style.display = 'none';
      renderPending();
      return true;
    }

    try {
      const res = await fetch(
        CONFIG.API_URL + '?action=getPending&password=' + encodeURIComponent(adminPassword)
      );
      const data = await res.json();
      loading.style.display = 'none';

      if (data.success) {
        pendingBooks = data.books || [];
        renderPending();
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.error('Load pending failed:', err);
      loading.style.display = 'none';
      showToast('서버 오류가 발생했습니다.', 'error');
      return false;
    }
  }

  // ---- Load Approved Books ----
  async function loadApproved() {
    const loading = $('#booksLoading');
    const list = $('#booksList');

    loading.style.display = '';
    list.innerHTML = '';

    if (CONFIG.DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 300));
      approvedBooks = [...DEMO_BOOKS];
      loading.style.display = 'none';
      renderApproved();
      return;
    }

    try {
      const res = await fetch(CONFIG.API_URL + '?action=getBooks');
      const data = await res.json();
      loading.style.display = 'none';

      if (data.success) {
        approvedBooks = data.books || [];
        renderApproved();
      }
    } catch (err) {
      console.error('Load books failed:', err);
      loading.style.display = 'none';
      showToast('도서 목록을 불러올 수 없습니다.', 'error');
    }
  }

  // ---- Render Pending ----
  function renderPending() {
    const list = $('#pendingList');
    const empty = $('#adminEmpty');
    const countEl = $('#pendingCount');

    countEl.textContent = pendingBooks.length + '건 대기 중';

    if (pendingBooks.length === 0) {
      list.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = pendingBooks.map((book) => bookCardHTML(book, 'pending')).join('');
    bindCardActions(list, 'pending');
  }

  // ---- Render Approved ----
  function renderApproved() {
    const list = $('#booksList');
    const empty = $('#booksEmpty');
    const countEl = $('#booksCount');

    const filtered = approvedBooks.filter((book) => {
      if (!adminSearchQuery) return true;
      const hay = [book['도서명'], book['저자']].join(' ').toLowerCase();
      return hay.includes(adminSearchQuery);
    });

    countEl.textContent = filtered.length + '권';

    if (filtered.length === 0) {
      list.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = filtered.map((book) => bookCardHTML(book, 'approved')).join('');
    bindCardActions(list, 'approved');
  }

  // ---- Bind Card Action Buttons ----
  function bindCardActions(list, mode) {
    const source = mode === 'pending' ? pendingBooks : approvedBooks;

    // 수정 버튼
    list.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const book = source.find((b) => b.ID === id);
        if (book) openEditModal(book, mode === 'pending' ? 'pending' : 'books');
      });
    });

    if (mode === 'pending') {
      list.querySelectorAll('.approve-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const book = pendingBooks.find((b) => b.ID === id);
          showConfirm(
            `"${book['도서명']}"을(를) 승인하시겠습니까?`,
            () => handleAction('approve', id)
          );
        });
      });

      list.querySelectorAll('.reject-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const book = pendingBooks.find((b) => b.ID === id);
          showConfirm(
            `"${book['도서명']}"을(를) 반려하시겠습니까?`,
            () => handleAction('reject', id)
          );
        });
      });
    } else {
      list.querySelectorAll('.delete-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const book = approvedBooks.find((b) => b.ID === id);
          showConfirm(
            `"${book['도서명']}"을(를) 삭제하시겠습니까?\n휴지통으로 이동됩니다.`,
            () => handleAction('delete', id)
          );
        });
      });
    }
  }

  // ---- Shared Card HTML ----
  function bookCardHTML(book, mode) {
    const coverContent = book['표지URL']
      ? `<img src="${escapeHtml(book['표지URL'])}" alt="">`
      : `<div class="cover-placeholder">
           <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#ccc" stroke-width="1.5">
             <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
             <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
           </svg>
         </div>`;

    const dateLabel = mode === 'pending' ? '등록일' : '승인일';
    const dateValue = book['등록일'] || '-';

    let actionsHTML;
    if (mode === 'pending') {
      actionsHTML = `
        <button class="btn btn-outline btn-sm edit-btn" data-id="${book.ID}">수정</button>
        <button class="btn btn-success btn-sm approve-btn" data-id="${book.ID}">승인</button>
        <button class="btn btn-danger btn-sm reject-btn" data-id="${book.ID}">반려</button>`;
    } else {
      actionsHTML = `
        <button class="btn btn-outline btn-sm edit-btn" data-id="${book.ID}">수정</button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${book.ID}">삭제</button>`;
    }

    return `
      <div class="pending-card" data-id="${book.ID}">
        <div class="pending-cover">${coverContent}</div>
        <div class="pending-info">
          <h3>${escapeHtml(book['도서명'])}</h3>
          <p class="pending-meta">${escapeHtml(book['저자'])} · ${escapeHtml(book['출판사'])}</p>
          <p class="pending-meta">출판일: ${escapeHtml(book['출판일'] || '-')} / ISBN: ${escapeHtml(book['ISBN'] || '-')}</p>
          <p class="pending-meta">${dateLabel}: ${escapeHtml(dateValue)}</p>
          <div class="pending-badges">
            <span class="badge badge--level">${escapeHtml(book['수준별'])}</span>
            <span class="badge badge--content">${escapeHtml(book['내용별'])}</span>
          </div>
          <div class="pending-actions">${actionsHTML}</div>
        </div>
      </div>`;
  }

  // ---- Edit Modal ----
  function initEditModal() {
    const modal = $('#editModal');
    const closeBtn = $('#editModalClose');
    const form = $('#editForm');

    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitEdit();
    });
  }

  function openEditModal(book, sheet) {
    const modal = $('#editModal');

    $('#editId').value = book.ID;
    $('#editSheet').value = sheet;
    $('#editTitle').value = book['도서명'] || '';
    $('#editSubtitle').value = book['부제'] || '';
    $('#editAuthor').value = book['저자'] || '';
    $('#editPublisher').value = book['출판사'] || '';
    $('#editPubDate').value = book['출판일'] || '';
    $('#editIsbn').value = book['ISBN'] || '';
    $('#editLinkKyobo').value = book['교보문고'] || '';
    $('#editLinkYes24').value = book['Yes24'] || '';
    $('#editLinkAladin').value = book['알라딘'] || '';
    $('#editLinkEtc').value = book['기타'] || '';
    $('#editLevel').value = book['수준별'] || '대학/임용';
    $('#editContent').value = book['내용별'] || '자연지리';
    $('#editProject1').value = book['지정도서목록1'] || '';
    $('#editProject2').value = book['지정도서목록2'] || '';
    $('#editProject3').value = book['지정도서목록3'] || '';
    $('#editProject4').value = book['지정도서목록4'] || '';
    $('#editProject5').value = book['지정도서목록5'] || '';

    modal.classList.add('open');
  }

  async function submitEdit() {
    const btn = $('#editSubmitBtn');
    const payload = {
      action: 'edit',
      password: adminPassword,
      sheet: $('#editSheet').value,
      id: $('#editId').value,
      title: $('#editTitle').value.trim(),
      subtitle: $('#editSubtitle').value.trim(),
      author: $('#editAuthor').value.trim(),
      publisher: $('#editPublisher').value.trim(),
      pubDate: $('#editPubDate').value,
      isbn: $('#editIsbn').value.trim(),
      linkKyobo: $('#editLinkKyobo').value.trim(),
      linkYes24: $('#editLinkYes24').value.trim(),
      linkAladin: $('#editLinkAladin').value.trim(),
      linkEtc: $('#editLinkEtc').value.trim(),
      level: $('#editLevel').value,
      content: $('#editContent').value,
      project1: $('#editProject1').value.trim(),
      project2: $('#editProject2').value.trim(),
      project3: $('#editProject3').value.trim(),
      project4: $('#editProject4').value.trim(),
      project5: $('#editProject5').value.trim()
    };

    btn.disabled = true;
    btn.textContent = '저장 중...';

    if (CONFIG.DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 400));
      const source = payload.sheet === 'pending' ? pendingBooks : approvedBooks;
      const book = source.find((b) => b.ID === payload.id);
      if (book) {
        book['도서명'] = payload.title;
        book['부제'] = payload.subtitle;
        book['저자'] = payload.author;
        book['출판사'] = payload.publisher;
        book['출판일'] = payload.pubDate;
        book['ISBN'] = payload.isbn;
        book['교보문고'] = payload.linkKyobo;
        book['Yes24'] = payload.linkYes24;
        book['알라딘'] = payload.linkAladin;
        book['기타'] = payload.linkEtc;
        book['수준별'] = payload.level;
        book['내용별'] = payload.content;
        book['지정도서목록1'] = payload.project1;
        book['지정도서목록2'] = payload.project2;
        book['지정도서목록3'] = payload.project3;
        book['지정도서목록4'] = payload.project4;
        book['지정도서목록5'] = payload.project5;
      }
      renderPending();
      renderApproved();
      $('#editModal').classList.remove('open');
      showToast('도서 정보가 수정되었습니다.', 'success');
      btn.disabled = false;
      btn.textContent = '저장';
      return;
    }

    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain' }
      });
      const data = await res.json();

      if (data.success) {
        $('#editModal').classList.remove('open');
        showToast(data.message, 'success');
        loadAll();
      } else {
        showToast(data.error || '수정에 실패했습니다.', 'error');
      }
    } catch (err) {
      console.error('Edit failed:', err);
      showToast('서버 오류가 발생했습니다.', 'error');
    }

    btn.disabled = false;
    btn.textContent = '저장';
  }

  // ---- Approve / Reject / Delete ----
  async function handleAction(action, id) {
    const messages = {
      approve: '도서가 승인되었습니다.',
      reject: '도서가 반려되었습니다.',
      delete: '도서가 삭제되었습니다.'
    };

    if (CONFIG.DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 400));
      if (action === 'delete') {
        approvedBooks = approvedBooks.filter((b) => b.ID !== id);
        renderApproved();
      } else {
        pendingBooks = pendingBooks.filter((b) => b.ID !== id);
        renderPending();
      }
      showToast(messages[action], 'success');
      return;
    }

    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, id, password: adminPassword }),
        headers: { 'Content-Type': 'text/plain' }
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, 'success');
        loadAll();
      } else {
        showToast(data.error || '처리에 실패했습니다.', 'error');
      }
    } catch (err) {
      console.error('Action failed:', err);
      showToast('서버 오류가 발생했습니다.', 'error');
    }
  }

  // ---- Confirm Modal ----
  function initConfirmModal() {
    const modal = $('#confirmModal');
    const yesBtn = $('#confirmYes');
    const noBtn = $('#confirmNo');

    yesBtn.addEventListener('click', () => {
      modal.classList.remove('open');
      if (confirmCallback) confirmCallback();
      confirmCallback = null;
    });

    noBtn.addEventListener('click', () => {
      modal.classList.remove('open');
      confirmCallback = null;
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
        confirmCallback = null;
      }
    });
  }

  function showConfirm(msg, callback) {
    const modal = $('#confirmModal');
    const msgEl = $('#confirmMsg');
    msgEl.textContent = msg;
    confirmCallback = callback;
    modal.classList.add('open');
  }

  // ---- Toast ----
  function showToast(msg, type = '') {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
  }

  // ---- Utilities ----
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
