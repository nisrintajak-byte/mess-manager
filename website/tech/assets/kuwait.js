// Kuwait / GCC section: Get Demo buttons, the contact form and the WhatsApp buttons.
// The Kuwait WhatsApp number goes here, digits only with country code, e.g. "96512345678".
// While it is empty the page runs in demo mode and nothing is sent anywhere.
var KW_WHATSAPP = "";

(function () {
  var form = document.getElementById('kw-form');
  var msg = document.getElementById('kw-form-msg');
  var productField = document.getElementById('kw-product');
  var t = function (key) { return form ? form.getAttribute('data-' + key) || '' : ''; };

  function waUrl(text) {
    return 'https://wa.me/' + KW_WHATSAPP + (text ? '?text=' + encodeURIComponent(text) : '');
  }
  function show(text) {
    if (!msg) return;
    msg.textContent = text;
    msg.hidden = false;
  }

  // WhatsApp buttons: real link once the number is set, otherwise a demo note.
  document.querySelectorAll('[data-wa]').forEach(function (a) {
    if (KW_WHATSAPP) {
      a.href = waUrl(t('wa-hello'));
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      a.setAttribute('aria-disabled', 'true');
      a.title = t('wa-pending');
      a.addEventListener('click', function (e) {
        e.preventDefault();
        show(t('wa-pending'));
        if (msg) msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  });

  // Get Demo: remember which product, then jump to the form.
  document.querySelectorAll('[data-demo]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (productField) productField.value = btn.getAttribute('data-demo');
      var note = document.getElementById('kw-product-note');
      if (note) {
        note.textContent = t('demo-for') + ' ' + btn.getAttribute('data-demo');
        note.hidden = false;
      }
      setTimeout(function () {
        var first = document.getElementById('kw-name');
        if (first) first.focus({ preventScroll: true });
      }, 400);
    });
  });

  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (form.elements.company_website.value) return; // bot
    var v = function (n) { return form.elements[n].value.trim(); };
    var lines = [
      t('wa-intro'),
      t('l-name') + ': ' + v('name'),
      t('l-mobile') + ': +965 ' + v('mobile'),
      t('l-company') + ': ' + v('company'),
      t('l-city') + ': ' + v('city')
    ];
    if (v('product')) lines.push(t('l-product') + ': ' + v('product'));
    if (KW_WHATSAPP) {
      window.open(waUrl(lines.join('\n')), '_blank', 'noopener');
      show(t('msg-sent'));
      form.reset();
    } else {
      show(t('msg-demo'));
    }
  });
})();
