/**
 * GeoBooks - Register Page Logic
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  document.addEventListener('DOMContentLoaded', () => {
    initCoverUpload();
    initForm();
  });

  // ---- Cover Image Upload & Preview ----
  function initCoverUpload() {
    const upload = $('#coverUpload');
    const input = $('#coverInput');
    const preview = $('#coverPreview');
    const img = $('#coverImg');

    upload.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        showToast('이미지 크기는 5MB 이하만 가능합니다.', 'error');
        input.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
        img.style.display = 'block';
        preview.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });
  }

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

      if (!title || !author || !publisher || !level || !content) {
        showToast('필수 항목을 모두 입력해주세요.', 'error');
        return;
      }

      // Get cover image as base64
      const coverImg = $('#coverImg');
      const coverImage = coverImg.style.display !== 'none' ? coverImg.src : '';

      const payload = {
        action: 'register',
        title, subtitle, author, publisher, pubDate, isbn,
        linkKyobo, linkYes24, linkAladin, linkEtc,
        level, content, coverImage
      };

      submitBtn.disabled = true;
      submitBtn.textContent = '등록 중...';

      if (CONFIG.DEMO_MODE) {
        await new Promise((r) => setTimeout(r, 800));
        showToast('(데모) 도서가 등록 요청되었습니다. 관리자 승인 후 게시됩니다.', 'success');
        form.reset();
        resetCoverPreview();
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
          resetCoverPreview();
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

  function resetCoverPreview() {
    const preview = $('#coverPreview');
    const img = $('#coverImg');
    const input = $('#coverInput');
    img.style.display = 'none';
    img.src = '';
    preview.style.display = '';
    input.value = '';
  }

  // ---- Toast ----
  function showToast(msg, type = '') {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
  }
})();
