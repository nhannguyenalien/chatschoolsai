// Giao diện dùng chung của Kho nội dung: content-library.html (chủ/thành viên) và content-staff.html (nhân viên).
(function () {
  // Có bộ chọn ngôn ngữ của dashboard thì theo nó; trang nhân viên theo trình duyệt. Chỉ có vi và en.
  const chosen = typeof getLang === 'function' ? getLang() : (localStorage.getItem('lang') || navigator.language || 'vi');
  const LANG = chosen.startsWith('vi') ? 'vi' : 'en';
  const TEXT = {
    vi: {
      tab_todo: 'Chờ đăng', tab_done: 'Chờ kiểm tra', tab_approved: 'Đã duyệt', tab_all: 'Tất cả', tab_sent: 'Đã gửi',
      st_todo: 'Chờ đăng', st_done: 'Đã đăng, chờ kiểm tra', st_approved: 'Đã duyệt', st_redo: 'Cần làm lại',
      all_platforms: 'Mọi nền tảng', empty: 'Chưa có nội dung nào ở mục này.',
      copy: 'Sao chép nội dung', copied: 'Đã sao chép', download: 'Tải về', open_media: 'Xem', open_target: 'Mở nơi đăng',
      note: 'Hướng dẫn', due: 'Hạn đăng', overdue: 'Quá hạn', by_agent: 'Agent', by_hand: 'Thủ công', show_more: 'Xem hết', show_less: 'Thu gọn',
      posted_check: 'Đã đăng thủ công', link_ph: 'Dán link bài viết hoặc trang social (https://…)', staff_note_ph: 'Ghi chú (không bắt buộc)',
      finish: 'Hoàn thành', done_by: 'Người đăng', view_post: 'Xem bài đã đăng', approve: 'Duyệt', redo: 'Yêu cầu làm lại', reopen: 'Mở lại',
      redo_ph: 'Lý do cần làm lại', send_back: 'Gửi trả', undo: 'Bỏ đánh dấu', reason: 'Chủ yêu cầu làm lại', owner_note: 'Nhận xét',
      reviewed_by: 'Người duyệt', edit: 'Sửa', del: 'Xoá', del_confirm: 'Bấm lần nữa để xoá', add_target: 'Thêm nơi đăng', remove_target: 'Bỏ nơi đăng này',
      link_required: 'Dán link trước khi bấm Hoàn thành.', reason_required: 'Ghi lý do cần làm lại.', saved: 'Đã lưu', video: 'Video',
      p_facebook_page: 'Facebook Page', p_facebook_group: 'Nhóm Facebook', p_website: 'Website / blog', p_other: 'Khác',
    },
    en: {
      tab_todo: 'To post', tab_done: 'To check', tab_approved: 'Approved', tab_all: 'All', tab_sent: 'Sent',
      st_todo: 'To post', st_done: 'Posted, waiting for review', st_approved: 'Approved', st_redo: 'Redo needed',
      all_platforms: 'All platforms', empty: 'Nothing here yet.',
      copy: 'Copy text', copied: 'Copied', download: 'Download', open_media: 'View', open_target: 'Open destination',
      note: 'Instructions', due: 'Due', overdue: 'Overdue', by_agent: 'Agent', by_hand: 'Manual', show_more: 'Show all', show_less: 'Show less',
      posted_check: 'Posted manually', link_ph: 'Paste the post or social profile link (https://…)', staff_note_ph: 'Note (optional)',
      finish: 'Mark completed', done_by: 'Posted by', view_post: 'Open the post', approve: 'Approve', redo: 'Ask to redo', reopen: 'Reopen',
      redo_ph: 'Why should it be redone?', send_back: 'Send back', undo: 'Unmark', reason: 'The owner asked to redo', owner_note: 'Review note',
      reviewed_by: 'Reviewed by', edit: 'Edit', del: 'Delete', del_confirm: 'Click again to delete', add_target: 'Add destination', remove_target: 'Remove this destination',
      link_required: 'Paste the link before marking it completed.', reason_required: 'Write why it should be redone.', saved: 'Saved', video: 'Video',
      p_facebook_page: 'Facebook Page', p_facebook_group: 'Facebook group', p_website: 'Website / blog', p_other: 'Other',
    },
  };
  const tr = (key) => TEXT[LANG][key] ?? TEXT.vi[key] ?? key;

  const BRANDS = {
    facebook_page: ['', 'ti-brand-facebook'], facebook_group: ['', 'ti-users-group'], instagram: ['Instagram', 'ti-brand-instagram'],
    threads: ['Threads', 'ti-brand-threads'], linkedin: ['LinkedIn', 'ti-brand-linkedin'], pinterest: ['Pinterest', 'ti-brand-pinterest'],
    tiktok: ['TikTok', 'ti-brand-tiktok'], youtube: ['YouTube', 'ti-brand-youtube'], x: ['X', 'ti-brand-x'], zalo: ['Zalo', 'ti-message-circle'],
    website: ['', 'ti-world'], other: ['', 'ti-share'],
  };
  const platformName = (key) => BRANDS[key]?.[0] || tr(`p_${key}`);
  const platformIcon = (key) => BRANDS[key]?.[1] || 'ti-share';

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const webUrl = (value) => /^https?:\/\//i.test(value || '') ? value : '';
  const when = (value) => {
    const date = new Date(String(value || '').replace(' ', 'T'));
    return isNaN(date) ? '' : date.toLocaleString(LANG === 'vi' ? 'vi-VN' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  function toast(message, isError) {
    let box = document.getElementById('cl-toasts');
    if (!box) { box = document.createElement('div'); box.id = 'cl-toasts'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = `cl-toast${isError ? ' err' : ''}`;
    el.setAttribute('role', 'status');
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => el.remove(), isError ? 6000 : 2500);
  }

  async function api(base, path, { method = 'GET', body, auth } = {}) {
    const response = await fetch(`${base}${path}`, {
      method, cache: 'no-store',
      headers: { Authorization: auth, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { status: response.status, code: data.code });
    return data;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const area = document.createElement('textarea');
      area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
    }
    toast(tr('copied'));
  }

  async function download(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      const link = document.createElement('a');
      link.href = URL.createObjectURL(await response.blob());
      link.download = url.split('/').pop().split('?')[0] || 'media';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 30000);
    } catch { window.open(url, '_blank', 'noopener'); } // máy chủ ảnh không cho tải trực tiếp: mở tab mới
  }

  const TABS = {
    todo: (t) => t.status === 'todo' || t.status === 'redo', done: (t) => t.status === 'done',
    approved: (t) => t.status === 'approved', all: () => true, sent: (t) => t.status === 'done' || t.status === 'approved',
  };
  const BADGE = { todo: 'bg-secondary-lt', done: 'bg-yellow-lt', approved: 'bg-green-lt', redo: 'bg-red-lt' };

  // options: { root, tabs, mode: 'owner'|'staff', canEdit(), canReview(), act(taskId, body), onItem(action, itemId, taskId) }
  function createBoard(options) {
    const state = { items: [], tab: options.tabs[0], platform: '', drafts: {}, expanded: new Set(), armed: '' };
    const root = options.root;
    const draft = (id) => (state.drafts[id] ||= { checked: false, url: '', note: '', reason: '', redoOpen: false });

    function taskHtml(task) {
      const d = draft(task.id);
      const id = esc(task.id);
      const target = webUrl(task.target)
        ? `<a href="${esc(task.target)}" target="_blank" rel="noopener noreferrer">${tr('open_target')} <i class="ti ti-external-link"></i></a>`
        : esc(task.target);
      const open = task.status === 'todo' || task.status === 'redo';
      let body = '';
      if (task.status === 'redo' && task.review_note) body += `<div class="alert alert-danger py-2 mb-2"><b>${tr('reason')}:</b> ${esc(task.review_note)}</div>`;
      if (task.post_url) {
        body += `<div class="mb-1"><a class="cl-break" href="${esc(webUrl(task.post_url))}" target="_blank" rel="noopener noreferrer"><i class="ti ti-link me-1"></i>${tr('view_post')}: ${esc(task.post_url)}</a></div>`;
        if (!open) body += `<div class="text-secondary small">${tr('done_by')}: ${esc(task.done_by)} · ${esc(when(task.done_at))}${task.staff_note ? ` · ${esc(task.staff_note)}` : ''}</div>`;
      }
      if (task.status === 'approved') body += `<div class="text-secondary small">${tr('reviewed_by')}: ${esc(task.reviewed_by)} · ${esc(when(task.reviewed_at))}${task.review_note ? ` · ${tr('owner_note')}: ${esc(task.review_note)}` : ''}</div>`;
      if (open && options.canEdit()) {
        body += `<label class="form-check mb-1"><input class="form-check-input" type="checkbox" data-check="${id}" ${d.checked ? 'checked' : ''}><span class="form-check-label">${tr('posted_check')}</span></label>`;
        if (d.checked) body += `<div class="row g-2">
          <div class="col-md-6"><input type="url" class="form-control" data-field="url" data-task="${id}" value="${esc(d.url)}" placeholder="${tr('link_ph')}" aria-label="${tr('link_ph')}"></div>
          <div class="col-md-4"><input type="text" class="form-control" data-field="note" data-task="${id}" value="${esc(d.note)}" placeholder="${tr('staff_note_ph')}" aria-label="${tr('staff_note_ph')}"></div>
          <div class="col-md-2"><button class="btn btn-success w-100" data-act="done" data-task="${id}"><i class="ti ti-check me-1"></i>${tr('finish')}</button></div></div>`;
      }
      const buttons = [];
      if (task.status === 'done' && options.canReview()) buttons.push(`<button class="btn btn-success btn-sm" data-act="approve" data-task="${id}"><i class="ti ti-check me-1"></i>${tr('approve')}</button>`);
      if ((task.status === 'done' || task.status === 'approved') && options.canReview()) buttons.push(`<button class="btn btn-outline-danger btn-sm" data-act="redo-open" data-task="${id}">${task.status === 'done' ? tr('redo') : tr('reopen')}</button>`);
      if (task.status === 'done' && (options.mode === 'staff' ? task.mine : options.canEdit())) buttons.push(`<button class="btn btn-ghost-secondary btn-sm" data-act="undo" data-task="${id}">${tr('undo')}</button>`);
      if (buttons.length) body += `<div class="d-flex flex-wrap gap-2 mt-2">${buttons.join('')}</div>`;
      if (d.redoOpen && options.canReview()) body += `<div class="input-group mt-2"><input type="text" class="form-control" data-field="reason" data-task="${id}" value="${esc(d.reason)}" placeholder="${tr('redo_ph')}" aria-label="${tr('redo_ph')}"><button class="btn btn-danger" data-act="redo" data-task="${id}">${tr('send_back')}</button></div>`;
      const removable = options.mode === 'owner' && options.canEdit() && (task.status === 'todo' || options.canReview());
      const armed = state.armed === `task:${task.id}`;
      return `<div class="cl-task" data-status="${esc(task.status)}">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
          <i class="ti ${platformIcon(task.platform)} fs-2"></i><b>${esc(platformName(task.platform))}</b><span class="cl-break text-secondary">${target}</span>
          <span class="badge ${BADGE[task.status] || 'bg-secondary-lt'} ms-auto">${tr(`st_${task.status}`)}</span>
          ${removable ? `<button class="btn btn-sm ${armed ? 'btn-danger' : 'btn-ghost-secondary btn-icon'}" data-item-act="remove-task" data-task="${id}" title="${tr('remove_target')}" aria-label="${tr('remove_target')}">${armed ? tr('del_confirm') : '<i class="ti ti-x"></i>'}</button>` : ''}
        </div>${body}</div>`;
    }

    function itemHtml(item, tasks) {
      const id = esc(item.id);
      const long = (item.content || '').length > 280 || (item.content || '').split('\n').length > 5;
      const expanded = state.expanded.has(item.id);
      const overdue = item.due_at && new Date(item.due_at) < new Date() && tasks.some(TABS.todo);
      const media = (item.media || []).map((m) => `<figure class="cl-media">
          ${m.type === 'video' ? `<video src="${esc(m.url)}" controls preload="metadata"></video>` : `<img src="${esc(m.url)}" alt="${esc(item.title)}" loading="lazy">`}
          <figcaption><a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${tr('open_media')}</a><button class="btn btn-link btn-sm p-0" data-download="${esc(m.url)}">${tr('download')}</button></figcaption></figure>`).join('');
      const armed = state.armed === `item:${item.id}`;
      const manage = options.mode === 'owner' && options.canEdit() ? `<div class="d-flex gap-1 flex-wrap">
          <button class="btn btn-sm btn-outline-secondary" data-item-act="add-task" data-item="${id}"><i class="ti ti-plus me-1"></i>${tr('add_target')}</button>
          <button class="btn btn-sm btn-outline-secondary" data-item-act="edit" data-item="${id}"><i class="ti ti-pencil me-1"></i>${tr('edit')}</button>
          ${options.canReview() ? `<button class="btn btn-sm ${armed ? 'btn-danger' : 'btn-outline-danger'}" data-item-act="delete" data-item="${id}"><i class="ti ti-trash me-1"></i>${armed ? tr('del_confirm') : tr('del')}</button>` : ''}</div>` : '';
      return `<div class="card mb-3" data-item-card="${id}"><div class="card-body">
        <div class="d-flex flex-wrap gap-2 align-items-start mb-2">
          <div class="me-auto"><h3 class="card-title mb-1">${esc(item.title)}</h3>
            <div class="text-secondary small"><span class="badge bg-azure-lt me-1">${item.source === 'agent' ? tr('by_agent') : tr('by_hand')}</span>${options.mode === 'owner' && item.created_by ? `${esc(item.created_by)} · ` : ''}${esc(when(item.created))}
            ${item.due_at ? ` · <span class="${overdue ? 'text-danger fw-bold' : ''}">${overdue ? tr('overdue') : tr('due')}: ${esc(when(item.due_at))}</span>` : ''}</div></div>${manage}</div>
        ${item.note ? `<div class="alert alert-info py-2 mb-2"><b>${tr('note')}:</b> <span class="cl-pre">${esc(item.note)}</span></div>` : ''}
        ${media ? `<div class="d-flex flex-wrap gap-2 mb-2">${media}</div>` : ''}
        ${item.content ? `<div class="cl-content${long && !expanded ? ' clamp' : ''}">${esc(item.content)}</div>
          <div class="d-flex gap-2 my-2"><button class="btn btn-sm btn-primary" data-copy="${id}"><i class="ti ti-copy me-1"></i>${tr('copy')}</button>
          ${long ? `<button class="btn btn-sm btn-ghost-secondary" data-expand="${id}">${expanded ? tr('show_less') : tr('show_more')}</button>` : ''}</div>` : ''}
        ${tasks.map(taskHtml).join('')}
      </div></div>`;
    }

    function visible(tab) {
      return state.items
        .map((item) => ({ item, tasks: item.tasks.filter((t) => TABS[tab](t) && (!state.platform || t.platform === state.platform)) }))
        // Nội dung không còn nơi đăng nào chỉ hiện ở tab "Tất cả" để chủ còn sửa/xoá được.
        .filter((row) => row.tasks.length || (tab === 'all' && !state.platform && !row.item.tasks.length));
    }

    function render() {
      const focused = document.activeElement?.dataset?.field ? { ...document.activeElement.dataset, at: document.activeElement.selectionStart } : null;
      const platforms = [...new Set(state.items.flatMap((item) => item.tasks.map((t) => t.platform)))];
      const tabs = options.tabs.map((tab) => {
        const count = visible(tab).reduce((sum, row) => sum + row.tasks.length, 0);
        return `<button type="button" class="btn ${tab === state.tab ? 'btn-primary' : 'btn-outline-secondary'}" data-tab="${tab}" aria-pressed="${tab === state.tab}">${tr(`tab_${tab}`)} <span class="badge ms-2 ${tab === state.tab ? 'bg-white text-primary' : 'bg-secondary-lt'}">${count}</span></button>`;
      }).join('');
      const rows = visible(state.tab);
      root.innerHTML = `<div class="d-flex flex-wrap gap-2 mb-3">${tabs}
        <select class="form-select w-auto ms-auto" data-platform aria-label="${tr('all_platforms')}"><option value="">${tr('all_platforms')}</option>${platforms.map((p) => `<option value="${esc(p)}" ${p === state.platform ? 'selected' : ''}>${esc(platformName(p))}</option>`).join('')}</select></div>
        ${rows.length ? rows.map((row) => itemHtml(row.item, row.tasks)).join('') : `<div class="card"><div class="card-body text-center text-secondary py-5">${tr('empty')}</div></div>`}`;
      if (focused) {
        const el = root.querySelector(`[data-field="${focused.field}"][data-task="${focused.task}"]`);
        if (el) { el.focus(); if (el.type === 'text' && focused.at != null) el.setSelectionRange(focused.at, focused.at); }
      }
    }

    async function act(button, taskId, action) {
      const d = draft(taskId);
      const body = { action };
      if (action === 'done') {
        if (!d.url.trim()) return toast(tr('link_required'), true);
        Object.assign(body, { post_url: d.url.trim(), note: d.note.trim() });
      }
      if (action === 'redo') {
        if (!d.reason.trim()) return toast(tr('reason_required'), true);
        body.note = d.reason.trim();
      }
      button.disabled = true;
      try {
        const task = await options.act(taskId, body);
        for (const item of state.items) {
          const index = item.tasks.findIndex((t) => t.id === taskId);
          if (index >= 0) item.tasks[index] = { ...item.tasks[index], ...task, mine: action === 'done' ? true : item.tasks[index].mine };
        }
        delete state.drafts[taskId];
        toast(tr('saved'));
        render();
      } catch (err) {
        button.disabled = false;
        toast(err.message, true);
        if (err.status === 409) options.reload?.();
      }
    }

    root.addEventListener('input', (event) => {
      const el = event.target;
      if (el.dataset.field) draft(el.dataset.task)[el.dataset.field] = el.value;
    });
    root.addEventListener('keydown', (event) => {
      const el = event.target;
      if (event.key !== 'Enter' || !el.dataset.field || event.isComposing) return;
      const action = el.dataset.field === 'reason' ? 'redo' : 'done';
      root.querySelector(`[data-act="${action}"][data-task="${el.dataset.task}"]`)?.click();
    });
    root.addEventListener('change', (event) => {
      const el = event.target;
      if (el.dataset.check) {
        draft(el.dataset.check).checked = el.checked;
        render();
        if (el.checked) root.querySelector(`[data-field="url"][data-task="${el.dataset.check}"]`)?.focus();
      }
      if (el.hasAttribute('data-platform')) { state.platform = el.value; render(); }
    });
    root.addEventListener('click', (event) => {
      const el = event.target.closest('button');
      if (!el) return;
      const { tab, copy, expand, act: action, itemAct, task, item } = el.dataset;
      if (tab) { state.tab = tab; state.armed = ''; return render(); }
      if (el.dataset.download) return download(el.dataset.download);
      if (copy) return copyText(state.items.find((i) => i.id === copy)?.content || '');
      if (expand) { state.expanded.has(expand) ? state.expanded.delete(expand) : state.expanded.add(expand); return render(); }
      if (action === 'redo-open') { draft(task).redoOpen = !draft(task).redoOpen; render(); return root.querySelector(`[data-field="reason"][data-task="${task}"]`)?.focus(); }
      if (action) return act(el, task, action);
      if (itemAct === 'delete' || itemAct === 'remove-task') {
        const key = itemAct === 'delete' ? `item:${item}` : `task:${task}`;
        if (state.armed !== key) { state.armed = key; return render(); }
        state.armed = '';
      }
      if (itemAct) return options.onItem(itemAct, item, task);
    });

    return {
      setItems(items) { state.items = items; state.armed = ''; render(); },
      item: (id) => state.items.find((i) => i.id === id),
    };
  }

  window.ContentLib = { tr, esc, api, toast, copyText, createBoard, platformName, lang: LANG };
})();
