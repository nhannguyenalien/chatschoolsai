/* Done-for-you setup landing pages: lead form + optional "register and pay Setup now".
   Server-owned: prices, products, provider and order binding live in the Worker (/api/account/billing/*).
   This script only sends contact details, creates the account through the existing registration
   endpoint and opens the checkout URL the Worker returns. */
(() => {
  const cfg = window.SERVICE_PAGE;
  const form = document.getElementById('lead-form');
  if (!cfg || !form) return;
  const m = cfg.msg;
  const statusEl = document.getElementById('lead-status');
  const submit = document.getElementById('lead-submit');
  const confirmBox = document.getElementById('pay-confirm');
  const payOnly = form.querySelectorAll('.pay-only');
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mode = () => form.elements.mode.value;
  const val = (name) => String(form.elements[name]?.value ?? '').trim();

  function say(text, kind = '', links = false) {
    statusEl.className = 'svc-status' + (kind ? ' ' + kind : '');
    statusEl.replaceChildren(document.createTextNode(text));
    if (links) {
      statusEl.append(document.createElement('br'));
      for (const [label, href] of [[m.go_dashboard, 'index.html'], [m.go_billing, 'billing.html']]) {
        const a = document.createElement('a'); a.href = href; a.textContent = label; statusEl.append(a);
      }
    }
  }
  function busy(on, label) { submit.disabled = on; if (label) say(label); }
  function applyMode() {
    const pay = mode() === 'pay';
    payOnly.forEach((el) => { el.hidden = !pay; });
    if (form.elements.password) form.elements.password.required = pay;
    submit.textContent = pay ? submit.dataset.pay : submit.dataset.consult;
    confirmBox.hidden = true;
  }
  form.querySelectorAll('input[name=mode]').forEach((el) => el.addEventListener('change', applyMode));

  function validate() {
    const bad = [];
    for (const name of ['name', 'business_name', 'business_type', 'city']) if (val(name).length < 2) bad.push(name);
    if (!EMAIL.test(val('email'))) bad.push('email');
    if (mode() === 'pay' && form.elements.password.value.length < 8) bad.push('password');
    if (!form.elements.consent.checked) bad.push('consent');
    mark(bad);
    return bad;
  }
  function mark(names) {
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    form.querySelector('.svc-consent').classList.remove('invalid');
    for (const name of names) {
      if (name === 'consent') form.querySelector('.svc-consent').classList.add('invalid');
      else form.elements[name]?.setAttribute('aria-invalid', 'true');
    }
    form.querySelector('[aria-invalid="true"]')?.focus();
  }

  const slugify = (text) => {
    const base = text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 26);
    const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => (b % 36).toString(36)).join('');
    return `${base.length >= 2 ? base : cfg.market}-${rand}`;
  };
  const source = () => {
    const q = new URLSearchParams(location.search);
    const fromUrl = [q.get('utm_source') || q.get('ref'), q.get('utm_campaign')].filter(Boolean).join('/');
    if (fromUrl) return fromUrl.slice(0, 100);
    try { const host = new URL(document.referrer).hostname; return host && host !== location.hostname ? host : ''; } catch { return ''; }
  };
  async function post(path, body, headers = {}) {
    const res = await fetch(`${WORKER_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const sendLead = (tenant = '') => post('/api/public/service-leads', {
    market: cfg.market, lang: cfg.lang, source: source(), tenant, consent: true,
    name: val('name'), email: val('email'), phone: val('phone'), business_name: val('business_name'),
    business_type: val('business_type'), city: val('city'), plan_interest: val('plan_interest'),
    // The global page also asks for a Facebook Page link; the lead record has no field for it, so it travels in the note.
    message: [val('page_url') && `Facebook Page: ${val('page_url')}`, val('message')].filter(Boolean).join('\n').slice(0, 1000),
    website: val('website')
  });

  function leadFailure(res) {
    if (res.status === 400 && Array.isArray(res.data.fields)) { mark(res.data.fields.filter((f) => form.elements[f] || f === 'consent')); say(m.required, 'error'); }
    else say(res.status === 429 ? m.rate_limited : m.lead_failed, 'error');
  }
  function done() {
    form.querySelectorAll('input,select,textarea,button').forEach((el) => { el.disabled = true; });
    say(m.success_title + '. ' + m.success_body, 'ok');
    statusEl.focus();
  }

  async function consult() {
    busy(true, m.sending);
    try {
      const res = await sendLead();
      if (res.status === 200 || res.status === 201) done(); else { leadFailure(res); busy(false); }
    } catch { say(m.network, 'error'); busy(false); }
  }

  async function registerAndPay() {
    busy(true, m.creating);
    let tenant = '';
    let outcome = 'failed';
    try {
      const email = val('email').toLowerCase();
      for (let attempt = 0; attempt < 3 && outcome === 'failed'; attempt++) {
        tenant = slugify(val('business_name'));
        const res = await post('/api/onboarding/register', { email, password: form.elements.password.value, name: val('name'), tenant, bot_name: val('business_name') });
        if (res.status === 201) outcome = 'created';
        else if (res.status === 409 && /email/i.test(res.data.error || '')) { outcome = 'email_exists'; break; }
        else if (res.status === 429) { outcome = 'rate_limited'; break; }
        else if (res.status !== 409) break;
      }
    } catch { say(m.network, 'error'); busy(false); return; }

    if (outcome !== 'created') {
      // The lead is never lost: staff get the contact details even when the account could not be created.
      await sendLead().catch(() => {});
      say(outcome === 'email_exists' ? m.email_exists : outcome === 'rate_limited' ? m.rate_limited : m.tenant_taken, 'error', outcome === 'email_exists');
      busy(false);
      return;
    }
    await sendLead(tenant).catch(() => {});
    try {
      say(m.logging);
      await PB.collection('tenants').authWithPassword(val('email').toLowerCase(), form.elements.password.value);
      try { localStorage.setItem(`schoolsai.activeTenant.${PB.authStore.model.id}`, tenant); } catch { /* storage may be blocked */ }
      say(m.checking);
      const plansRes = await fetch(`${WORKER_URL}/api/account/billing/plans?market=${encodeURIComponent(cfg.market)}`, { headers: { Authorization: PB.authStore.token } });
      const plans = plansRes.ok ? (await plansRes.json()).plans || [] : [];
      const plan = plans.find((p) => p.id === cfg.setupPlan && p.kind === 'setup');
      if (!plan) { say(m.pay_not_ready, 'ok', true); form.querySelectorAll('input,select,textarea,button').forEach((el) => { el.disabled = true; }); return; }
      showConfirm(plan, tenant);
    } catch {
      say(m.account_done + ' ' + m.pay_error, 'error', true);
      busy(false);
    }
  }

  function showConfirm(plan, tenant) {
    say(m.account_done, 'ok');
    form.querySelectorAll('input,select,textarea').forEach((el) => { el.disabled = true; });
    confirmBox.replaceChildren();
    const title = document.createElement('h3'); title.textContent = m.pay_title;
    const text = document.createElement('p');
    text.textContent = m.pay_text.replace('{label}', plan.label).replace('{amount}', plan.amount).replace('{currency}', plan.currency);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'button primary'; button.textContent = m.pay_button;
    confirmBox.append(title, text, button);
    confirmBox.hidden = false;
    submit.hidden = true;
    button.focus();
    button.addEventListener('click', async () => {
      button.disabled = true; say(m.redirecting);
      const key = `bgate.checkout.${PB.authStore.model.id}.${plan.id}.${tenant}`;
      try {
        // Same id on retries so a timeout never creates a second order; same keys as billing.js.
        const requestId = sessionStorage.getItem(key) || crypto.randomUUID();
        sessionStorage.setItem(key, requestId);
        const res = await post('/api/account/billing/checkout', { plan: plan.id, request_id: requestId, tenant }, { Authorization: PB.authStore.token });
        if (res.status !== 200) throw new Error('checkout');
        const target = new URL(res.data.checkout_url);
        if (target.protocol !== 'https:') throw new Error('url');
        sessionStorage.setItem(`${key}.order`, res.data.order_id);
        window.location.assign(target.href);
      } catch { say(m.pay_error, 'error', true); button.disabled = false; }
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (validate().length) { say(m.required, 'error'); return; }
    if (mode() === 'pay') registerAndPay(); else consult();
  });
  applyMode();
})();
