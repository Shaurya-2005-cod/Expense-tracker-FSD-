'use strict';

/* ===== CONSTANTS ===== */
const CATEGORY_META = {
  food:          { label: 'Food',          emoji: '🍜', color: '#FFB84D' },
  rent:          { label: 'Rent',          emoji: '🏠', color: '#FF5F57' },
  travel:        { label: 'Travel',        emoji: '✈️',  color: '#57C8FF' },
  shopping:      { label: 'Shopping',      emoji: '🛍️',  color: '#C457FF' },
  utilities:     { label: 'Utilities',     emoji: '💡', color: '#FFC857' },
  health:        { label: 'Health',        emoji: '💊', color: '#57FFB8' },
  entertainment: { label: 'Entertainment', emoji: '🎬', color: '#FF57C4' },
  income:        { label: 'Income',        emoji: '💰', color: '#B8FF57' },
  other:         { label: 'Other',         emoji: '📦', color: '#A0A0B4' },
};

const DEFAULT_BUDGETS = {
  food: 5000, rent: 15000, travel: 3000, shopping: 4000,
  utilities: 2000, health: 2000, entertainment: 2000, other: 2000,
};

/* ===== STATE ===== */
let transactions = JSON.parse(localStorage.getItem('flowt_txns') || '[]');
let budgets      = JSON.parse(localStorage.getItem('flowt_budgets') || JSON.stringify(DEFAULT_BUDGETS));
let currentType  = 'expense';
let donutChart   = null;

/* ===== DOM REFS ===== */
const txnList       = document.getElementById('txnList');
const emptyState    = document.getElementById('emptyState');
const totalIncome   = document.getElementById('totalIncome');
const totalExpenses = document.getElementById('totalExpenses');
const netBalance    = document.getElementById('netBalance');
const savingsRate   = document.getElementById('savingsRate');
const savingsTag    = document.getElementById('savingsTag');
const balanceTag    = document.getElementById('balanceTag');
const incomeBar     = document.getElementById('incomeBar');
const expenseBar    = document.getElementById('expenseBar');
const chartTotal    = document.getElementById('chartTotal');
const chartLegend   = document.getElementById('chartLegend');
const budgetList    = document.getElementById('budgetList');
const monthFilter   = document.getElementById('monthFilter');
const categoryFilter = document.getElementById('categoryFilter');
const currentMonth  = document.getElementById('currentMonth');
const modalOverlay  = document.getElementById('modalOverlay');
const budgetOverlay = document.getElementById('budgetOverlay');
const txnDesc       = document.getElementById('txnDesc');
const txnAmount     = document.getElementById('txnAmount');
const txnDate       = document.getElementById('txnDate');
const txnCategory   = document.getElementById('txnCategory');

/* ===== INIT ===== */
function init() {
  const now = new Date();
  currentMonth.textContent = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  txnDate.value = now.toISOString().split('T')[0];
  populateMonthFilter();
  render();
  setupListeners();
  // Add sample data if empty
  if (transactions.length === 0) addSampleData();
}

function addSampleData() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const samples = [
    { id: uid(), type: 'income',   desc: 'Monthly salary',   amount: 55000, category: 'income',        date: `${y}-${m}-01` },
    { id: uid(), type: 'expense',  desc: 'Apartment rent',   amount: 14000, category: 'rent',          date: `${y}-${m}-02` },
    { id: uid(), type: 'expense',  desc: 'Grocery run',      amount: 3200,  category: 'food',          date: `${y}-${m}-05` },
    { id: uid(), type: 'expense',  desc: 'Uber rides',       amount: 1850,  category: 'travel',        date: `${y}-${m}-07` },
    { id: uid(), type: 'expense',  desc: 'Amazon order',     amount: 4400,  category: 'shopping',      date: `${y}-${m}-09` },
    { id: uid(), type: 'expense',  desc: 'Electricity bill', amount: 1100,  category: 'utilities',     date: `${y}-${m}-10` },
    { id: uid(), type: 'expense',  desc: 'Movie tickets',    amount: 800,   category: 'entertainment', date: `${y}-${m}-12` },
  ];
  transactions = samples;
  save();
  render();
}

/* ===== SAVE ===== */
function save() {
  localStorage.setItem('flowt_txns',    JSON.stringify(transactions));
  localStorage.setItem('flowt_budgets', JSON.stringify(budgets));
}

/* ===== UID ===== */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ===== FORMAT ===== */
function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

/* ===== FILTER ===== */
function getFiltered() {
  let txns = [...transactions];
  const mv = monthFilter.value;
  const cv = categoryFilter.value;
  if (mv !== 'all') txns = txns.filter(t => t.date.startsWith(mv));
  if (cv !== 'all') txns = txns.filter(t => t.category === cv);
  return txns;
}

/* ===== RENDER ===== */
function render() {
  const filtered = getFiltered();

  // Metrics
  const income   = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net      = income - expenses;
  const rate     = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;

  totalIncome.textContent   = fmt(income);
  totalExpenses.textContent = fmt(expenses);
  netBalance.textContent    = fmt(net);
  savingsRate.textContent   = rate + '%';
  savingsTag.textContent    = rate >= 0 ? 'of income saved' : 'over budget';

  balanceTag.textContent  = net >= 0 ? 'Looking good!' : 'In the red';
  balanceTag.style.color  = net >= 0 ? 'var(--accent)' : 'var(--accent-red)';

  const maxBar = Math.max(income, expenses) || 1;
  incomeBar.style.width   = Math.round((income / maxBar) * 100) + '%';
  expenseBar.style.width  = Math.round((expenses / maxBar) * 100) + '%';

  renderTransactions(filtered);
  renderChart(filtered);
  renderBudget();
}

/* ===== TRANSACTIONS ===== */
function renderTransactions(filtered) {
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
  const visible = sorted.slice(0, 30);

  emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

  // Remove old txn items
  Array.from(txnList.querySelectorAll('.txn-item')).forEach(el => el.remove());

  visible.forEach((t, i) => {
    const meta = CATEGORY_META[t.category] || CATEGORY_META.other;
    const dateStr = new Date(t.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const el = document.createElement('div');
    el.className = 'txn-item';
    el.dataset.id = t.id;
    el.style.animationDelay = (i * 0.04) + 's';
    el.innerHTML = `
      <div class="txn-dot cat-${t.category}" style="font-size:16px;">${meta.emoji}</div>
      <div class="txn-info">
        <div class="txn-name">${escHtml(t.desc)}</div>
        <div class="txn-meta">${dateStr} · ${meta.label}</div>
      </div>
      <div class="txn-right">
        <div class="txn-amt ${t.type === 'income' ? 'pos' : 'neg'}">
          ${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}
        </div>
        <button class="txn-del" data-id="${t.id}" title="Delete">✕</button>
      </div>`;
    txnList.appendChild(el);
  });
}

/* ===== CHART ===== */
function renderChart(filtered) {
  const expenses = filtered.filter(t => t.type === 'expense');
  const byCat = {};
  expenses.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });

  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const labels  = entries.map(([k]) => CATEGORY_META[k]?.label || k);
  const data    = entries.map(([,v]) => v);
  const colors  = entries.map(([k]) => CATEGORY_META[k]?.color || '#888');
  const total   = data.reduce((s, v) => s + v, 0);

  chartTotal.textContent = fmt(total);

  const ctx = document.getElementById('donutChart').getContext('2d');

  if (donutChart) donutChart.destroy();

  if (total === 0) {
    chartLegend.innerHTML = '<p style="font-size:12px;color:var(--text-3);text-align:center;padding:1rem 0;">No expense data yet</p>';
    return;
  }

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
    options: {
      cutout: '68%',
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ${fmt(ctx.parsed)}` },
        backgroundColor: isDark ? '#1A1A1F' : '#fff',
        titleColor: isDark ? '#F0F0F2' : '#1A1A1F',
        bodyColor: isDark ? '#9191A0' : '#6B6B78',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderWidth: 1,
      }},
      animation: { animateScale: true, duration: 600 },
    }
  });

  // Legend
  chartLegend.innerHTML = '';
  entries.slice(0, 5).forEach(([k, v]) => {
    const pct = Math.round((v / total) * 100);
    const meta = CATEGORY_META[k] || CATEGORY_META.other;
    const row = document.createElement('div');
    row.className = 'leg-item';
    row.innerHTML = `
      <div class="leg-dot" style="background:${meta.color}"></div>
      <div class="leg-name">${meta.label}</div>
      <div class="leg-pct">${pct}%</div>
      <div class="leg-amt">${fmt(v)}</div>`;
    chartLegend.appendChild(row);
  });
}

/* ===== BUDGET ===== */
function renderBudget() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTxns = transactions.filter(t => t.date.startsWith(thisMonth) && t.type === 'expense');

  budgetList.innerHTML = '';
  const cats = ['rent', 'food', 'shopping', 'travel', 'entertainment'];
  cats.forEach(cat => {
    const limit   = budgets[cat] || 0;
    const spent   = monthTxns.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
    const pct     = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
    const meta    = CATEGORY_META[cat];
    const fillCls = pct >= 100 ? 'danger' : pct >= 75 ? 'warn' : '';

    const el = document.createElement('div');
    el.className = 'budget-item';
    el.innerHTML = `
      <div class="budget-top">
        <span class="budget-cat">${meta.emoji} ${meta.label}</span>
        <span class="budget-nums">${fmt(spent)} / ${fmt(limit)}</span>
      </div>
      <div class="budget-track">
        <div class="budget-track-fill ${fillCls}" style="width:${pct}%"></div>
      </div>`;
    budgetList.appendChild(el);
  });
}

/* ===== MONTH FILTER ===== */
function populateMonthFilter() {
  const months = new Set(transactions.map(t => t.date.slice(0, 7)));
  // Also add current month
  months.add(new Date().toISOString().slice(0, 7));
  const sorted = [...months].sort().reverse();
  sorted.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    const d = new Date(m + '-01');
    opt.textContent = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    monthFilter.appendChild(opt);
  });
}

/* ===== BUDGET MODAL ===== */
function openBudgetModal() {
  const form = document.getElementById('budgetForm');
  form.innerHTML = '';
  const cats = ['rent', 'food', 'shopping', 'travel', 'entertainment', 'utilities', 'health', 'entertainment'];
  const unique = [...new Set(cats)];
  unique.forEach(cat => {
    const meta = CATEGORY_META[cat];
    const div = document.createElement('div');
    div.className = 'field';
    div.innerHTML = `
      <label>${meta.emoji} ${meta.label} limit (₹)</label>
      <input type="number" data-cat="${cat}" value="${budgets[cat] || 0}" min="0" placeholder="0" />`;
    form.appendChild(div);
  });
  budgetOverlay.classList.add('open');
}

/* ===== ADD TRANSACTION ===== */
function addTransaction() {
  const desc   = txnDesc.value.trim();
  const amount = parseFloat(txnAmount.value);
  const date   = txnDate.value;
  const cat    = currentType === 'income' ? 'income' : txnCategory.value;

  if (!desc)        { shake(txnDesc);   return; }
  if (!amount || amount <= 0) { shake(txnAmount); return; }
  if (!date)        { shake(txnDate);   return; }

  const txn = { id: uid(), type: currentType, desc, amount, category: cat, date };
  transactions.unshift(txn);
  save();
  populateMonthFilter();
  render();

  // Reset form
  txnDesc.value   = '';
  txnAmount.value = '';
  txnDate.value   = new Date().toISOString().split('T')[0];
  modalOverlay.classList.remove('open');
}

/* ===== DELETE ===== */
function deleteTransaction(id) {
  const el = txnList.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.classList.add('removing');
    el.addEventListener('animationend', () => {
      transactions = transactions.filter(t => t.id !== id);
      save();
      render();
    }, { once: true });
  }
}

/* ===== SHAKE (validation) ===== */
function shake(el) {
  el.style.outline = '2px solid var(--accent-red)';
  el.style.animation = 'none';
  setTimeout(() => {
    el.style.outline = '';
  }, 800);
}

/* ===== EXPORT CSV ===== */
function exportCSV() {
  const header = 'Date,Description,Category,Type,Amount\n';
  const rows = transactions.map(t =>
    `${t.date},"${t.desc}",${t.category},${t.type},${t.amount}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'flowt-expenses.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ===== ESCAPE HTML ===== */
function escHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ===== LISTENERS ===== */
function setupListeners() {
  // Modal open/close
  document.getElementById('openModal').addEventListener('click', () => {
    modalOverlay.classList.add('open');
    txnDesc.focus();
  });
  document.getElementById('closeModal').addEventListener('click', () => modalOverlay.classList.remove('open'));
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) modalOverlay.classList.remove('open'); });

  // Budget modal
  document.getElementById('openBudget').addEventListener('click', openBudgetModal);
  document.getElementById('closeBudget').addEventListener('click', () => budgetOverlay.classList.remove('open'));
  budgetOverlay.addEventListener('click', e => { if (e.target === budgetOverlay) budgetOverlay.classList.remove('open'); });

  document.getElementById('saveBudget').addEventListener('click', () => {
    document.querySelectorAll('#budgetForm input[data-cat]').forEach(inp => {
      const val = parseFloat(inp.value);
      if (!isNaN(val)) budgets[inp.dataset.cat] = val;
    });
    save();
    render();
    budgetOverlay.classList.remove('open');
  });

  // Type toggle
  document.getElementById('typeExpense').addEventListener('click', () => {
    currentType = 'expense';
    document.getElementById('typeExpense').classList.add('active');
    document.getElementById('typeIncome').classList.remove('active');
    txnCategory.parentElement.style.display = '';
  });
  document.getElementById('typeIncome').addEventListener('click', () => {
    currentType = 'income';
    document.getElementById('typeIncome').classList.add('active');
    document.getElementById('typeExpense').classList.remove('active');
    txnCategory.parentElement.style.display = 'none';
  });

  // Submit
  document.getElementById('submitTxn').addEventListener('click', addTransaction);
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && modalOverlay.classList.contains('open')) addTransaction();
    if (e.key === 'Escape') {
      modalOverlay.classList.remove('open');
      budgetOverlay.classList.remove('open');
    }
  });

  // Delete (delegated)
  txnList.addEventListener('click', e => {
    const btn = e.target.closest('.txn-del');
    if (btn) deleteTransaction(btn.dataset.id);
  });

  // Filters
  monthFilter.addEventListener('change', render);
  categoryFilter.addEventListener('change', render);

  // Theme
  document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    // Rebuild chart for new theme colors
    const filtered = getFiltered();
    renderChart(filtered);
  });

  // Export
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
}

/* ===== START ===== */
init();
