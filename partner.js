/* ===== SAKURA PARTNER SYSTEM — SHARED UTILITIES ===== */

// Save ref code from URL params — now requests a signed token from server
// so users cannot forge referral relationships via localStorage editing.
(function () {
  var params = new URLSearchParams(location.search);
  var ref = params.get('ref');
  if (ref) {
    localStorage.removeItem('sm_pending_ref_token');
    // Request a server-signed referral token
    fetch('/api/referral-token?ref=' + encodeURIComponent(ref))
      .then(function (r) {
        if (!r.ok) throw new Error('Invalid referral code');
        return r.json();
      })
      .then(function (data) {
        if (data && data.token) {
          localStorage.setItem('sm_pending_ref', ref);
          localStorage.setItem('sm_pending_ref_token', data.token);
          localStorage.setItem('sm_pending_ref_at', Date.now().toString());
          return;
        }
        localStorage.removeItem('sm_pending_ref_token');
      })
      .catch(function () {
        // Fallback: still store the code for display purposes, but
        // without a valid signed token the server will reject it.
        localStorage.setItem('sm_pending_ref', ref);
        localStorage.setItem('sm_pending_ref_at', Date.now().toString());
        localStorage.removeItem('sm_pending_ref_token');
      });
  }
  // Expire after 30 days
  var storedAt = localStorage.getItem('sm_pending_ref_at');
  if (storedAt && Date.now() - parseInt(storedAt) > 30 * 86400000) {
    localStorage.removeItem('sm_pending_ref');
    localStorage.removeItem('sm_pending_ref_token');
    localStorage.removeItem('sm_pending_ref_at');
  }
})();

localStorage.removeItem('sm_commission_rules');
