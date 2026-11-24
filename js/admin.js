// © 2026 김용현
/**
 * GeoShelf - Admin Page Logic
 * 목록 줄을 누르면 수정 대화상자가 열리고, 승인, 반려, 삭제는 그 안에서 한다.
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  let adminPassword = '';
  let pendingBooks = [];
  let approvedBooks = [];
  let adminSearchQuery = '';
  let confirmCallback = null;
  let panelReady = false;
  let editDirty = false;

  const BOOK_ICON = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>`;
  const CHEVRON = `<svg class="icon book-row-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;

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
        showError('비밀번호를 넣어 주세요.');
        return;
      }

      if (CONFIG.DEMO_MODE) {
        if (pw === CONFIG.ADMIN_PASSWORD) {
          adminPassword = pw;
          showAdminPanel();
          loadAll();
        } else {
          showError('비밀번호가 맞지 않아요. 다시 넣어 주세요.');
        }
        return;
      }

      adminPassword = pw;
      loginBtn.disabled = true;
      loadPending().then((success) => {
        loginBtn.disabled = false;
        if (success) {
          showAdminPanel();
          loadApproved();
        } else {
          showError('비밀번호가 맞지 않아요. 다시 넣어 주세요.');
          adminPassword = '';
        }
      });
    };

    loginBtn.addEventListener('click', doLogin);
    passwordInput.addEventListener('keyup', (e) => {
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
    if (panelReady) return;
    panelReady = true;

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

    $('#pendingList').addEventListener('click', (e) => openFromRow(e, 'pending'));
    $('#booksList').addEventListener('click', (e) => openFromRow(e, 'books'));
  }

  function openFromRow(e, sheet) {
    const row = e.target.closest('.book-row');
    if (!row) return;
    const source = sheet === 'pending' ? pendingBooks : approvedBooks;
    const book = source.find((b) => b.ID === row.dataset.id);
    if (book) openEditModal(book, sheet);
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
    list.style.display = 'none';

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
      }
      return false;
    } catch (err) {
      console.error('Load pending failed:', err);
      loading.style.display = 'none';
      showToast('확인할 도서를 불러오지 못했어요. 새로고침을 눌러 주세요.');
      return false;
    }
  }

  // ---- Load Approved Books ----
  async function loadApproved() {
    const loading = $('#booksLoading');
    const list = $('#booksList');

    loading.style.display = '';
    list.innerHTML = '';
    list.style.display = 'none';

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
      showToast('등록 도서를 불러오지 못했어요. 새로고침을 눌러 주세요.');
    }
  }

  // ---- Render Pending ----
  function renderPending() {
    const list = $('#pendingList');
    const empty = $('#adminEmpty');
    const n = pendingBooks.length;

    $('#pendingCount').innerHTML = n
      ? `확인할 등록 요청이 <strong>${n}권</strong> 있어요.`
      : '확인할 등록 요청이 없어요.';

    if (n === 0) {
      list.innerHTML = '';
      list.style.display = 'none';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    list.style.display = '';
    list.innerHTML = pendingBooks.map((book) => bookRowHTML(book, 'pending')).join('');
  }

  // ---- Render Approved ----
  function renderApproved() {
    const list = $('#booksList');
    const empty = $('#booksEmpty');

    const filtered = approvedBooks.filter((book) => {
      if (!adminSearchQuery) return true;
      const hay = [book['도서명'], book['저자'], book['출판사'], book['ISBN']].join(' ').toLowerCase();
      return hay.includes(adminSearchQuery);
    });

    // 최근에 넣은 도서가 위로
    filtered.sort((a, b) => idNumber(b.ID) - idNumber(a.ID));

    $('#booksCount').innerHTML = adminSearchQuery
      ? `찾은 도서 <strong>${filtered.length}권</strong>, 전체 ${approvedBooks.length}권`
      : `도서 목록에 <strong>${approvedBooks.length}권</strong>이 올라가 있어요.`;

    if (filtered.length === 0) {
      list.innerHTML = '';
      list.style.display = 'none';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    list.style.display = '';
    list.innerHTML = filtered.map((book) => bookRowHTML(book, 'approved')).join('');
  }

  function idNumber(id) {
    const n = parseInt(String(id || '').replace(/\D/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  // ---- 목록 한 줄 ----
  function bookRowHTML(book, mode) {
    const cover = book['표지URL']
      ? `<img src="${escapeHtml(book['표지URL'])}" alt="" loading="lazy">`
      : BOOK_ICON;
    const meta = [book['저자'], book['출판사'], formatDate(book['출판일'])]
      .filter((v) => v && v !== '-')
      .map(escapeHtml)
      .join(', ');
    const side = mode === 'pending'
      ? `요청 ${escapeHtml(formatDate(book['등록일']))}`
      : `${escapeHtml(label(book['수준별']))}, ${escapeHtml(label(book['내용별']))}`;

    return `
      <button type="button" class="book-row" data-id="${escapeHtml(book.ID)}">
        <span class="book-row-cover">${cover}</span>
        <span class="book-row-main">
          <span class="book-row-title">${escapeHtml(book['도서명'])}</span>
          <span class="book-row-meta">${meta}</span>
        </span>
        <span class="book-row-side">${side}</span>
        ${CHEVRON}
      </button>`;
  }

  // ---- Edit Modal ----
  function initEditModal() {
    const modal = $('#editModal');
    const form = $('#editForm');

    $('#editModalClose').addEventListener('click', closeEditModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeEditModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeEditModal();
    });

    form.addEventListener('input', () => { editDirty = true; });
    form.addEventListener('change', () => { editDirty = true; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitEdit();
    });

    // 승인: 고친 내용이 있으면 먼저 저장하고 승인한다
    $('#editApproveBtn').addEventListener('click', async () => {
      const id = $('#editId').value;
      if (editDirty) {
        const saved = await submitEdit({ quiet: true });
        if (!saved) return;
      }
      closeEditModal();
      handleAction('approve', id);
    });

    // 반려, 삭제: 수정 창을 닫고 한 번 더 확인한다
    $('#editDangerBtn').addEventListener('click', () => {
      const id = $('#editId').value;
      const sheet = $('#editSheet').value;
      const title = $('#editTitle').value;
      closeEditModal();
      if (sheet === 'pending') {
        showConfirm({
          title: `"${title}" 등록 요청을 반려할까요?`,
          desc: '반려하면 확인할 목록에서 사라져요.',
          yes: '반려하기',
          danger: true
        }, () => handleAction('reject', id));
      } else {
        showConfirm({
          title: `"${title}"을(를) 목록에서 뺄까요?`,
          desc: '도서 목록에서 바로 사라지고, 구글 시트의 휴지통 탭으로 옮겨져요.',
          yes: '목록에서 빼기',
          danger: true
        }, () => handleAction('delete', id));
      }
    });
  }

  function closeEditModal() {
    $('#editModal').classList.remove('open');
  }

  function openEditModal(book, sheet) {
    const isPending = sheet === 'pending';

    $('#editModalTitle').textContent = isPending ? '등록 요청 확인' : '도서 정보 고치기';
    $('#editDangerBtn').textContent = isPending ? '반려하기' : '목록에서 빼기';
    $('#editApproveBtn').style.display = isPending ? '' : 'none';
    const save = $('#editSubmitBtn');
    save.className = isPending ? 'btn btn-outline' : 'btn btn-primary';

    $('#editId').value = book.ID;
    $('#editSheet').value = sheet;
    $('#editTitle').value = book['도서명'] || '';
    $('#editSubtitle').value = book['부제'] || '';
    $('#editAuthor').value = book['저자'] || '';
    $('#editPublisher').value = book['출판사'] || '';
    $('#editPubDate').value = formatDate(book['출판일']) === '-' ? '' : formatDate(book['출판일']);
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

    editDirty = false;
    $('#editModal').classList.add('open');
    $('#editModal .modal').scrollTop = 0;
  }

  async function submitEdit(opts = {}) {
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
    btn.textContent = '저장하는 중';
    const done = () => {
      btn.disabled = false;
      btn.textContent = '고친 내용 저장';
    };

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
      editDirty = false;
      if (!opts.quiet) {
        closeEditModal();
        showToast('고친 내용을 저장했어요.');
      }
      done();
      return true;
    }

    let ok = false;
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain' }
      });
      const data = await res.json();

      if (data.success) {
        ok = true;
        editDirty = false;
        if (!opts.quiet) {
          closeEditModal();
          showToast('고친 내용을 저장했어요.');
          loadAll();
        }
      } else {
        showToast('저장하지 못했어요. 잠시 뒤 다시 저장해 주세요.');
      }
    } catch (err) {
      console.error('Edit failed:', err);
      showToast('저장하지 못했어요. 인터넷 연결을 확인해 주세요.');
    }

    done();
    return ok;
  }

  // ---- Approve / Reject / Delete ----
  async function handleAction(action, id) {
    const messages = {
      approve: '승인했어요. 도서 목록에 올라갔어요.',
      reject: '등록 요청을 반려했어요.',
      delete: '목록에서 뺐어요. 휴지통 탭에 남아 있어요.'
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
      showToast(messages[action]);
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
        showToast(messages[action]);
        loadAll();
      } else {
        showToast('처리하지 못했어요. 잠시 뒤 다시 해 주세요.');
      }
    } catch (err) {
      console.error('Action failed:', err);
      showToast('처리하지 못했어요. 인터넷 연결을 확인해 주세요.');
    }
  }

  // ---- Confirm Modal ----
  function initConfirmModal() {
    const modal = $('#confirmModal');
    const close = () => {
      modal.classList.remove('open');
      confirmCallback = null;
    };

    $('#confirmYes').addEventListener('click', () => {
      const cb = confirmCallback;
      close();
      if (cb) cb();
    });
    $('#confirmNo').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  function showConfirm({ title, desc, yes, danger }, callback) {
    $('#confirmTitle').textContent = title;
    $('#confirmMsg').textContent = desc || '';
    const yesBtn = $('#confirmYes');
    yesBtn.textContent = yes;
    yesBtn.className = danger ? 'btn btn-danger-fill' : 'btn btn-primary';
    confirmCallback = callback;
    $('#confirmModal').classList.add('open');
    yesBtn.focus();
  }

  // ---- Toast ----
  let toastTimer;
  function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.className = 'toast show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3500);
  }

  // ---- Utilities ----
  // 시트 날짜는 UTC 시각(예: 2026-11-14T15:00:00.000Z)으로 오므로 이 기기 시간대로 바꿔 읽는다
  function formatDate(val) {
    if (!val) return '-';
    const s = String(val);
    if (s.includes('T')) {
      const d = new Date(s);
      if (!isNaN(d)) {
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      }
    }
    return s.slice(0, 10);
  }

  function label(value) {
    return String(value || '').replace(/·/g, '/');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
