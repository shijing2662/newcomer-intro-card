(function () {
  const token = new URLSearchParams(location.search).get('token');
  const authWarning = document.getElementById('auth-warning');
  const table = document.getElementById('table');
  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty');
  const previewDialog = document.getElementById('preview-dialog');
  const previewFull = document.getElementById('preview-full');

  if (!token) { authWarning.style.display = 'block'; return; }

  async function loadSubmissions() {
    const res = await fetch('/api/submissions', { headers: { 'X-Admin-Token': token } });
    if (res.status === 401) {
      authWarning.textContent = 'Token 无效';
      authWarning.style.display = 'block';
      return;
    }
    const list = await res.json();
    tbody.innerHTML = '';
    if (!list.length) { table.style.display = 'none'; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    table.style.display = 'table';
    list.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img class="thumb" src="${item.cardPath}" data-full="${item.cardPath}" /></td>
        <td>${esc(item.name)}</td>
        <td>${esc(item.position || '—')}</td>
        <td>${esc(item.hometown || '—')}</td>
        <td>${esc(item.contact || item.wechat || '—')}</td>
        <td>${new Date(item.submittedAt).toLocaleString('zh-CN', { hour12: false })}</td>
        <td>
          <a class="link-btn" href="${item.cardPath}" download="${item.name}-新人介绍.png">下载</a>
          | <button class="link-btn btn-delete" data-id="${item.id}">删除</button>
        </td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.thumb').forEach((img) => {
      img.onclick = () => { previewFull.src = img.dataset.full; previewDialog.showModal(); };
    });
    tbody.querySelectorAll('.btn-delete').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('确定删除？')) return;
        await fetch(`/api/submissions/${btn.dataset.id}?token=${token}`, {
          method: 'DELETE', headers: { 'X-Admin-Token': token },
        });
        loadSubmissions();
      };
    });
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  document.getElementById('btn-refresh').onclick = loadSubmissions;
  loadSubmissions();
})();
