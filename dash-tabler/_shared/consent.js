/* SchoolsAI: Consent Mode v2 + cookie banner + Google Tag Manager loader.
   Same file is used by blog.schoolsai.work and chat.schoolsai.work (/_shared/consent.js).
   Default is "denied" in the EEA, UK and Switzerland until the visitor accepts; elsewhere it is
   "granted" until the visitor declines. To make it strict everywhere, delete the second default call. */
(function () {
  var GTM_ID = 'GTM-PCBCMDC4';
  var KEY = 'schoolsai_consent_v1';
  var w = window, d = document;

  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = w.gtag || gtag;

  function state(v) {
    return { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v };
  }

  var strict = state('denied');
  strict.region = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH'];
  strict.wait_for_update = 500;
  gtag('consent', 'default', strict);
  gtag('consent', 'default', state('granted'));

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === 'granted' || saved === 'denied') gtag('consent', 'update', state(saved));

  // Google Tag Manager
  w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var s = d.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
  (d.head || d.documentElement).appendChild(s);

  if (saved) return;

  var T = {
    en: ['We use cookies to measure traffic and show relevant ads. You can decline.', 'Accept', 'Decline', 'Privacy'],
    vi: ['Chúng tôi dùng cookie để đo lường truy cập và hiển thị quảng cáo phù hợp. Bạn có thể từ chối.', 'Đồng ý', 'Từ chối', 'Quyền riêng tư'],
    fr: ['Nous utilisons des cookies pour mesurer l’audience et afficher des publicités pertinentes. Vous pouvez refuser.', 'Accepter', 'Refuser', 'Confidentialité'],
    ja: ['アクセス解析と関連性の高い広告表示のためにCookieを使用します。拒否することもできます。', '同意する', '拒否', 'プライバシー']
  };

  function show() {
    var lang = (d.documentElement.lang || 'en').slice(0, 2);
    var t = T[lang] || T.en;
    var css = d.createElement('style');
    css.textContent =
      '#sai-consent{position:fixed;left:16px;right:16px;bottom:16px;max-width:560px;margin:0 auto;z-index:2147483000;' +
      'background:#fff;color:#2b2a33;border:1px solid #efece7;border-radius:18px;padding:16px 18px;' +
      'box-shadow:0 10px 40px rgba(43,42,51,.18);font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}' +
      '#sai-consent p{margin:0 0 12px}#sai-consent a{color:#7c6fd6}' +
      '#sai-consent .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
      '#sai-consent button{cursor:pointer;border-radius:999px;padding:8px 18px;font:600 14px system-ui;border:1px solid #d9d5ee;background:#fff;color:#2b2a33}' +
      '#sai-consent button.y{background:#2b2a33;color:#fff;border-color:#2b2a33}';
    d.head.appendChild(css);
    var box = d.createElement('div');
    box.id = 'sai-consent';
    box.setAttribute('role', 'dialog');
    box.innerHTML = '<p></p><div class="row"><button class="y" type="button"></button><button type="button"></button>' +
      '<a href="https://chat.schoolsai.work/privacy" target="_blank" rel="noopener"></a></div>';
    box.querySelector('p').textContent = t[0];
    var b = box.querySelectorAll('button');
    b[0].textContent = t[1];
    b[1].textContent = t[2];
    box.querySelector('a').textContent = t[3];
    function choose(v) {
      try { localStorage.setItem(KEY, v); } catch (e) {}
      gtag('consent', 'update', state(v));
      box.remove();
    }
    b[0].onclick = function () { choose('granted'); };
    b[1].onclick = function () { choose('denied'); };
    d.body.appendChild(box);
  }

  if (d.body) show(); else d.addEventListener('DOMContentLoaded', show);
})();
