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

    form.addEventListener('input', (e) => {
      if (e.target.id !== 'isbn') e.target.removeAttribute('aria-invalid');
    });
    form.addEventListener('change', (e) => {
      if (e.target.tagName === 'SELECT') e.target.removeAttribute('aria-invalid');
    });

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

      hideFormError();
      const required = [
        ['#title', '도서명'], ['#author', '저자'], ['#publisher', '출판사'],
        ['#level', '수준별'], ['#content', '내용별']
      ];
      const missing = required.filter(([sel]) => !$(sel).value.trim());
      required.forEach(([sel]) => $(sel).removeAttribute('aria-invalid'));
      if (missing.length) {
        missing.forEach(([sel]) => $(sel).setAttribute('aria-invalid', 'true'));
        $(missing[0][0]).focus();
        showFormError(missing.map(([, name]) => name).join(', ') + ' 칸을 채워 주세요.');
        return;
      }

      if (isbn && !/^\d{13}$/.test(isbn)) {
        $('#isbnError').classList.add('show');
        $('#isbn').setAttribute('aria-invalid', 'true');
        $('#isbn').focus();
        return;
      }

      const payload = {
        action: 'register',
        title, subtitle, author, publisher, pubDate, isbn,
        linkKyobo, linkYes24, linkAladin, linkEtc,
        level, content, coverUrl
      };

      submitBtn.disabled = true;
      submitBtn.textContent = '보내는 중';

      if (CONFIG.DEMO_MODE) {
        await new Promise((r) => setTimeout(r, 800));
        showToast('(데모) 등록 요청을 보냈어요. 관리자가 확인하면 목록에 올라가요.', 'success');
        form.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = '등록 요청 보내기';
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
          showToast('등록 요청을 보냈어요. 관리자가 확인하면 목록에 올라가요.', 'success');
          form.reset();
        } else {
          showFormError('등록 요청을 보내지 못했어요. 잠시 뒤 다시 보내 주세요.');
        }
      } catch (err) {
        console.error('Register failed:', err);
        showFormError('등록 요청을 보내지 못했어요. 인터넷 연결을 확인하고 다시 보내 주세요.');
      }

      submitBtn.disabled = false;
      submitBtn.textContent = '등록 요청 보내기';
    });
  }

  // ---- ISBN Info Dialog ----
  function initIsbnInfo() {
    const btn = $('#isbnInfoBtn');
    const dialog = $('#isbnDialog');
    const closeBtn = $('#isbnDialogClose');

    btn.addEventListener('click', () => dialog.classList.add('open'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dialog.classList.remove('open');
    });
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
        input.removeAttribute('aria-invalid');
      }
    });

    input.addEventListener('blur', () => {
      if (input.value.length > 0 && input.value.length !== 13) {
        error.classList.add('show');
        input.setAttribute('aria-invalid', 'true');
      } else {
        error.classList.remove('show');
        input.removeAttribute('aria-invalid');
      }
    });
  }

  // ---- 양식 오류 (버튼 바로 아래) ----
  function showFormError(msg) {
    const el = $('#formError');
    el.textContent = msg;
    el.style.display = '';
  }

  function hideFormError() {
    $('#formError').style.display = 'none';
  }

  // ---- Toast ----
  function showToast(msg, type = '') {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
  }
})();
