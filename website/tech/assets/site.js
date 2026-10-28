// Copy buttons: <button data-copy="id-of-element">
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-copy]');
  if (!btn) return;
  var el = document.getElementById(btn.getAttribute('data-copy'));
  if (!el) return;
  var text = el.textContent.trim();
  function selectIt() {
    var r = document.createRange();
    r.selectNodeContents(el);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1600); };
  try {
    navigator.clipboard.writeText(text).then(done, selectIt);
  } catch (err) {
    selectIt();
  }
});
