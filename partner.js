/* ===== SAKURA PARTNER SYSTEM — SHARED UTILITIES ===== */

// Save ref code from URL params to localStorage (30-day)
(function () {
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  if (ref) {
    localStorage.setItem('sm_pending_ref', ref);
    localStorage.setItem('sm_pending_ref_at', Date.now().toString());
  }
  // Expire after 30 days
  const storedAt = localStorage.getItem('sm_pending_ref_at');
  if (storedAt && Date.now() - parseInt(storedAt) > 30 * 86400000) {
    localStorage.removeItem('sm_pending_ref');
    localStorage.removeItem('sm_pending_ref_at');
  }
})();

// Initialize default commission rules if not set
(function () {
  if (!localStorage.getItem('sm_commission_rules')) {
    const defaultRules = [
      { id: 'rule_stem_cell',  category: 'stem_cell',  name: '干细胞/再生医疗', commissionRate: 0.20, cashbackRate: 0.03, isActive: true },
      { id: 'rule_checkup',    category: 'checkup',    name: '精密体检',        commissionRate: 0.20, cashbackRate: 0.05, isActive: true },
      { id: 'rule_cosmetic',   category: 'cosmetic',   name: '医美整形',        commissionRate: 0.20, cashbackRate: 0.03, isActive: true },
      { id: 'rule_immunity',   category: 'immunity',   name: '免疫疗法(NK细胞)', commissionRate: 0.20, cashbackRate: 0.03, isActive: true },
      { id: 'rule_nmn',        category: 'nmn',        name: 'NMN/保健品',      commissionRate: 0.20, cashbackRate: 0.00, isActive: true },
      { id: 'rule_consult',    category: 'consult',    name: '远程专家会诊',    commissionRate: 0.20, cashbackRate: 0.00, isActive: true }
    ];
    localStorage.setItem('sm_commission_rules', JSON.stringify(defaultRules));
  }
})();
