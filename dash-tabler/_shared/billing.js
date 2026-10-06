async function billingRequest(path, body) {
  const response = await fetch(`${WORKER_URL}/api/account/billing/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: PB.authStore.token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không tải được thông tin thanh toán.');
  return data;
}

async function loadPaymentPlans() {
  const container = document.getElementById('ui-action-container');
  container.replaceChildren();
  const status = document.createElement('p');
  status.className = 'text-secondary mb-0';
  status.setAttribute('role', 'status');
  container.append(status);
  try {
    const { plans } = await billingRequest('plans');
    if (!plans.length) { status.textContent = 'Thanh toán đang chờ cấu hình gói dịch vụ.'; return; }
    for (const plan of plans) {
      const key = `bgate.checkout.${PB.authStore.model.id}.${plan.id}`;
      const button = document.createElement('button');
      button.className = 'btn btn-primary w-100';
      button.textContent = `${plan.label} (${plan.amount} ${plan.currency})`;
      button.onclick = async () => {
        const buttons = [...container.querySelectorAll('button')];
        buttons.forEach(item => { item.disabled = true; });
        status.textContent = 'Đang tạo trang thanh toán…';
        try {
          // Keep the same id on retries/reload after a timeout to avoid duplicate orders.
          const requestId = sessionStorage.getItem(key) || crypto.randomUUID();
          sessionStorage.setItem(key, requestId);
          const result = await billingRequest('checkout', { plan: plan.id, request_id: requestId });
          const target = new URL(result.checkout_url);
          if (target.protocol !== 'https:') throw new Error('Đường dẫn thanh toán không hợp lệ.');
          sessionStorage.setItem(`${key}.order`, result.order_id);
          window.location.assign(target.href);
        } catch (error) {
          status.textContent = error.message;
          buttons.forEach(item => { item.disabled = false; });
        }
      };
      container.insertBefore(button, status);
      const orderId = sessionStorage.getItem(`${key}.order`);
      if (orderId) {
        const check = document.createElement('button');
        check.className = 'btn btn-outline-primary w-100';
        check.textContent = `Kiểm tra giao dịch — ${plan.label}`;
        check.onclick = async () => {
          check.disabled = true;
          status.textContent = 'Đang đối soát thanh toán…';
          try {
            const payment = await billingRequest(`payments/${encodeURIComponent(orderId)}`);
            if (payment.status === 'paid') {
              status.textContent = payment.payment_verified
                ? 'Đã xác minh thanh toán. Gói dịch vụ đang chờ kích hoạt.'
                : 'Giao dịch đã thanh toán nhưng thông tin gói cần được kiểm tra.';
            } else {
              status.textContent = `Trạng thái giao dịch: ${payment.status}. Chưa cấp dịch vụ.`;
            }
            if (['paid', 'expired', 'failed', 'cancelled', 'canceled', 'refunded'].includes(payment.status)) {
              sessionStorage.removeItem(key);
              sessionStorage.removeItem(`${key}.order`);
              check.remove();
            }
          } catch (error) { status.textContent = error.message; }
          finally { check.disabled = false; }
        };
        container.insertBefore(check, status);
      }
    }
  } catch (error) { status.textContent = error.message; }
}
