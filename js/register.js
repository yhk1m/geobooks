/**
 * GeoShelf - Register Page Logic
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  document.addEventListener('DOMContentLoaded', () => {
    initForm();
    initIsbnInfo();
    initIsbnValidation();
  });

  // ---- Form Submit ----
  function initForm() {
    const form = $('#registerForm');
    const submitBtn = $('#submitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = $('#title').value.trim();
      const subtitle = $('#subtitle').value.trim();
      const author = $('#author').value.trim();
      const publisher = $('#publisher').value.trim();
      const pubDate = $('#pubDate').value;
      const isbn = $('#isbn').value.trim();
      const linkKyobo = $('#linkKyobo').value.trim();
      const linkYes24 = $('#linkYes24').value.trim();
      const linkAladin = $('#linkAladin').value.trim();
      const linkEtc = $('#linkEtc').value.trim();
      const level = $('#level').value;
      const content = $('#content').value;
      const coverUrl = $('#coverUrl').value.trim();

      if (!title || !author || !publisher || !level || !content) {
        showToast('필수 항목을 모두 입력해주세요.', 'error');
        return;
      }

      if (isbn && !/^\d{13}$/.test(isbn)) {
        $('#isbnError').classList.add('show');
        $('#isbn').focus();
        showToast('ISBN은 13자리 숫자여야 합니다.', 'error');
        return;
      }

      const payload = {
        action: 'register',
        title, subtitle, author, publisher, pubDate, isbn,
        linkKyobo, linkYes24, linkAladin, linkEtc,
        level, content, coverUrl
      };

      submitBtn.disabled = true;
      submitBtn.textContent = '등록 중...';

      if (CONFIG.DEMO_MODE) {
        await new Promise((r) => setTimeout(r, 800));
        showToast('(데모) 도서가 등록 요청되었습니다. 관리자 승인 후 게시됩니다.', 'success');
        form.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = '도서 등록 요청';
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
          showToast(data.message || '도서가 등록 요청되었습니다.', 'success');
          form.reset();
        } else {
          showToast(data.error || '등록에 실패했습니다.', 'error');
        }
      } catch (err) {
        console.error('Register failed:', err);
        showToast('서버 오류가 발생했습니다.', 'error');
      }

      submitBtn.disabled = false;
      submitBtn.textContent = '도서 등록 요청';
    });
  }

  // ---- ISBN Info Dialog ----
  function initIsbnInfo() {
    const btn = $('#isbnInfoBtn');
    const dialog = $('#isbnDialog');
    const closeBtn = $('#isbnDialogClose');

    btn.addEventListener('click', () => dialog.classList.add('open'));
    closeBtn.addEventListener('click', () => dialog.classList.remove('open'));
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.classList.remove('open');
    });
  }

  // ---- ISBN Validation ----
  function initIsbnValidation() {
    const input = $('#isbn');
    const error = $('#isbnError');

    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '');
      if (input.value.length === 13 || input.value.length === 0) {
        error.classList.remove('show');
      }
    });

    input.addEventListener('blur', () => {
      if (input.value.length > 0 && input.value.length !== 13) {
        error.classList.add('show');
      } else {
        error.classList.remove('show');
      }
    });
  }

  // ---- Toast ----
  function showToast(msg, type = '') {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
  }
})();
