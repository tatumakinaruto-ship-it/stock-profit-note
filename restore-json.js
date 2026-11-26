/* Stock Profit Note: JSON restore add-on with portfolio enhancements.
   Existing LocalStorage keys and data structures are preserved. */
(function () {
  'use strict';
  function init() {
    const importPanel = document.getElementById('import');
    if (!importPanel) return;

    if (!document.getElementById('jsonRestoreCard')) {
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'jsonRestoreCard';
      card.innerHTML = `
        <h2>4. JSONバックアップを復元</h2>
        <p class="muted">「取引データを書き出す」で保存した stocknote-backup.json を読み込みます。復元前に現在のデータを自動バックアップします。</p>
        <label class="filebtn">JSONファイルを選択<input id="jsonRestoreFile" type="file" accept=".json,application/json"></label>
        <p id="jsonRestoreInfo" class="muted">まだファイルは選択されていません。</p>
        <div class="actions"><button type="button" id="jsonMergeBtn" disabled>既存データに追加</button><button type="button" class="secondary" id="jsonReplaceBtn" disabled>バックアップで置き換え</button></div>
        <p class="muted">追加では同じ取引が重複する場合があります。置き換えではバックアップに含まれる取引・価格・為替・預かり金で復元します。</p>`;
      importPanel.appendChild(card);
      setupRestore();
    }

    setupPortfolioMetrics();
  }

  function setupRestore() {
    const fileInput = document.getElementById('jsonRestoreFile');
    const info = document.getElementById('jsonRestoreInfo');
    const mergeBtn = document.getElementById('jsonMergeBtn');
    const replaceBtn = document.getElementById('jsonReplaceBtn');
    let parsed = null;

    function validTrade(t) {
      return t && typeof t === 'object' && typeof t.date === 'string' && typeof t.symbol === 'string' &&
        ['BUY', 'SELL'].includes(String(t.side).toUpperCase()) && Number.isFinite(Number(t.qty)) &&
        Number(t.qty) > 0 && Number.isFinite(Number(t.price)) && Number(t.price) >= 0;
    }
    function parseBackup(obj) {
      const backupTrades = Array.isArray(obj) ? obj : obj && obj.trades;
      if (!Array.isArray(backupTrades) || !backupTrades.every(validTrade)) throw new Error('JSONの形式が違うか、取引データがありません。');
      return {
        trades: backupTrades,
        prices: obj && !Array.isArray(obj) && obj.prices && typeof obj.prices === 'object' ? obj.prices : {},
        fx: obj && !Array.isArray(obj) && Number.isFinite(Number(obj.fx)) ? Number(obj.fx) : null,
        cashBalance: obj && !Array.isArray(obj) && Number.isFinite(Number(obj.cashBalance)) ? Number(obj.cashBalance) : null,
        hasCashBalance: !!(obj && !Array.isArray(obj) && Object.prototype.hasOwnProperty.call(obj, 'cashBalance')),
        cashLedger: obj && !Array.isArray(obj) && Array.isArray(obj.cashLedger) ? obj.cashLedger : null
      };
    }

    fileInput.addEventListener('change', async function () {
      parsed = null;
      mergeBtn.disabled = true;
      replaceBtn.disabled = true;
      const file = fileInput.files && fileInput.files[0];
      if (!file) { info.textContent = 'まだファイルは選択されていません。'; return; }
      try {
        parsed = parseBackup(JSON.parse(await file.text()));
        info.textContent = `${parsed.trades.length}件の取引を読み込みました。追加または置き換えを選択してください。`;
        mergeBtn.disabled = false;
        replaceBtn.disabled = false;
      } catch (error) {
        info.textContent = `読み込みに失敗しました: ${error.message}`;
      }
    });

    function currentData() {
      return {
        trades: JSON.parse(localStorage.getItem('stocknote_trades') || '[]'),
        prices: JSON.parse(localStorage.getItem('stocknote_prices') || '{}'),
        fx: Number(localStorage.getItem('stocknote_fx') || 150),
        cashBalance: localStorage.getItem('stocknote_cash_balance') === null ? null : Number(localStorage.getItem('stocknote_cash_balance')),
        cashLedger: JSON.parse(localStorage.getItem('stocknote_cash_ledger') || '[]')
      };
    }
    function saveSafetyBackup() {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const link = document.createElement('a');
      const url = URL.createObjectURL(new Blob([JSON.stringify(currentData(), null, 2)], { type: 'application/json' }));
      link.href = url;
      link.download = `stocknote-safety-${stamp}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function apply(data) {
      saveSafetyBackup();
      trades = data.trades;
      prices = data.prices;
      if (data.fx !== null) fx = data.fx;
      if (data.hasCashBalance) cashBalance = data.cashBalance;
      if (data.cashLedger) cashLedger = data.cashLedger;
      save();
      render();
      info.textContent = 'バックアップを復元しました。現在の画面を更新しました。';
    }
    mergeBtn.addEventListener('click', function () {
      if (!parsed || !confirm(`バックアップの${parsed.trades.length}件を現在の取引履歴に追加します。続けますか？`)) return;
      const current = currentData();
      apply({ trades: current.trades.concat(parsed.trades), prices: Object.assign({}, current.prices, parsed.prices),
        fx: parsed.fx === null ? current.fx : parsed.fx,
        cashBalance: parsed.hasCashBalance ? parsed.cashBalance : current.cashBalance,
        hasCashBalance: parsed.hasCashBalance, cashLedger: parsed.cashLedger || current.cashLedger });
    });
    replaceBtn.addEventListener('click', function () {
      if (!parsed || !confirm(`現在の取引履歴をバックアップの${parsed.trades.length}件で置き換えます。復元前のデータはJSONで保存されます。続けますか？`)) return;
      const current = currentData();
      apply({ trades: parsed.trades, prices: parsed.prices, fx: parsed.fx === null ? current.fx : parsed.fx,
        cashBalance: parsed.hasCashBalance ? parsed.cashBalance : current.cashBalance,
        hasCashBalance: parsed.hasCashBalance, cashLedger: parsed.cashLedger || current.cashLedger });
    });
  }

  function setupPortfolioMetrics() {
    const dashboardGrid = document.querySelector('#dash .grid');
    const stockHeader = document.querySelector('#stocks table thead tr');
    if (!dashboardGrid || !stockHeader || typeof render !== 'function') return;

    if (!document.getElementById('stockInvestmentTotal')) {
      const investmentCard = document.createElement('div');
      investmentCard.className = 'card metric';
      investmentCard.innerHTML = '<small>株式投資額合計</small><strong id="stockInvestmentTotal">¥0</strong>';
      dashboardGrid.appendChild(investmentCard);
      const assetsCard = document.createElement('div');
      assetsCard.className = 'card metric';
      assetsCard.innerHTML = '<small>総資産額</small><strong id="totalAssets">¥0</strong>';
      dashboardGrid.appendChild(assetsCard);
    }
    if (!stockHeader.querySelector('[data-return-header]')) {
      const th = document.createElement('th');
      th.textContent = '取得時からの上昇率';
      th.dataset.returnHeader = 'true';
      stockHeader.appendChild(th);
    }

    const originalRender = render;
    render = function () {
      originalRender();
      const calculated = calc();
      const investment = calculated.holdings.reduce((sum, h) => {
        const rate = h.cur === 'USD' ? Number(fx || 0) : 1;
        return sum + Number(h.cp || 0) * Number(h.qty || 0) * rate;
      }, 0);
      const total = investment + (cashBalance === null ? 0 : Number(cashBalance || 0));
      const investmentEl = document.getElementById('stockInvestmentTotal');
      const totalEl = document.getElementById('totalAssets');
      if (investmentEl) investmentEl.textContent = fmt(investment);
      if (totalEl) totalEl.textContent = fmt(total);

      const rows = document.querySelectorAll('#stockRows tr');
      rows.forEach((row, index) => {
        const h = calculated.holdings[index];
        if (!h || row.cells.length > 4) return;
        const marketJpy = Number(h.cp || 0) * Number(h.qty || 0) * (h.cur === 'USD' ? Number(fx || 0) : 1);
        const costBasisJpy = marketJpy - Number(h.unrealJ || 0);
        const percent = costBasisJpy > 0 ? Number(h.unrealJ || 0) / costBasisJpy * 100 : null;
        const cell = row.insertCell(-1);
        cell.className = percent === null ? '' : (percent > 0 ? 'pos' : percent < 0 ? 'neg' : '');
        cell.textContent = percent === null ? '—' : `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
      });
    };
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
