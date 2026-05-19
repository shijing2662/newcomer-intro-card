(function () {
  const CARD_W = 573;
  const CARD_H = 470;

  const form = document.getElementById('intro-form');
  const avatarInput = document.getElementById('avatar');
  const avatarPreview = document.getElementById('avatar-preview');
  const cardAvatar = document.getElementById('card-avatar');
  const cardAvatarPlaceholder = document.getElementById('card-avatar-placeholder');
  const btnPreview = document.getElementById('btn-preview');
  const btnDownload = document.getElementById('btn-download');
  const messageEl = document.getElementById('message');
  const previewScaler = document.getElementById('preview-scaler');
  const cardExport = document.getElementById('card-export');

  const fields = {
    name: document.getElementById('name'),
    position: document.getElementById('position'),
    introduction: document.getElementById('introduction'),
    hometown: document.getElementById('hometown'),
    contact: document.getElementById('contact'),
  };

  const cardFields = {
    name: document.getElementById('card-name'),
    position: document.getElementById('card-position'),
    introduction: document.getElementById('card-introduction'),
    hometown: document.getElementById('card-hometown'),
    contact: document.getElementById('card-contact'),
  };
  const cardSongSubtitle = document.getElementById('card-song-subtitle');

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = type ? `message ${type}` : 'message';
  }

  function setCardText(el, value) {
    el.textContent = value?.trim() || '—';
  }

  function updatePreview() {
    const name = fields.name.value.trim();
    setCardText(cardFields.name, name);
    if (cardSongSubtitle) {
      cardSongSubtitle.textContent = name ? `新人介绍--${name}` : '新人介绍--';
    }
    setCardText(cardFields.position, fields.position.value);
    setCardText(cardFields.introduction, fields.introduction.value);
    setCardText(cardFields.hometown, fields.hometown.value);
    setCardText(cardFields.contact, fields.contact.value);
  }

  function fitPreviewScale() {
    const wrap = previewScaler.parentElement;
    const available = wrap.clientWidth - 32;
    const scale = Math.min(1, available / CARD_W);
    previewScaler.style.transform = `scale(${scale})`;
    previewScaler.style.width = `${CARD_W * scale}px`;
    previewScaler.style.height = `${CARD_H * scale}px`;
  }

  async function generateCardCanvas() {
    updatePreview();
    return html2canvas(cardExport, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ececec',
      width: CARD_W,
      height: CARD_H,
    });
  }

  function downloadCanvas(canvas) {
    const name = fields.name.value.trim() || '新人介绍';
    const safeName = name.replace(/[/\\?%*:|"<>]/g, '-');
    const link = document.createElement('a');
    link.download = `${safeName}-新人介绍.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  avatarInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      avatarPreview.src = ev.target.result;
      cardAvatar.src = ev.target.result;
      cardAvatar.style.display = 'block';
      cardAvatarPlaceholder.style.display = 'none';
      updatePreview();
    };
    reader.readAsDataURL(file);
  });

  Object.values(fields).forEach((input) => input.addEventListener('input', updatePreview));
  btnPreview.addEventListener('click', updatePreview);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessage('', '');

    if (!avatarInput.files?.[0]) {
      showMessage('请上传头像照片', 'error');
      return;
    }
    if (!fields.name.value.trim()) {
      showMessage('请填写姓名', 'error');
      return;
    }

    btnDownload.disabled = true;
    btnDownload.textContent = '正在生成图片…';

    try {
      const canvas = await generateCardCanvas();
      downloadCanvas(canvas);
      showMessage('图片已生成并开始下载。请把 PNG 发给 HR。', 'success');
    } catch (err) {
      showMessage(err.message || '生成失败，请重试', 'error');
    } finally {
      btnDownload.disabled = false;
      btnDownload.textContent = '下载图片';
    }
  });

  (function initLogo() {
    const img = document.getElementById('logo-img');
    const fallback = document.getElementById('logo-fallback');
    if (!img || !fallback) return;
    fallback.style.display = 'none';
    img.onload = () => {
      img.style.display = 'block';
      fallback.style.display = 'none';
    };
    img.onerror = () => {
      img.style.display = 'none';
      fallback.style.display = 'block';
    };
    img.src = 'assets/logo.png';
  })();

  window.addEventListener('resize', fitPreviewScale);
  fitPreviewScale();
  updatePreview();
})();
