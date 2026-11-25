// JSON backup restore add-on for 株式損益ノート
(() => {
  const section = document.getElementById('import');
  if (!section || document.getElementById('jsonRestoreCard')) return;
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'jsonRestoreCard';
  card.innerHTML = `
    <h2>4. JSONバックアップを復元</h2>
    <p class="muted">「取引データを書き出す」で保存した stocknote-backup.json を選択してください。</p>
    <label class="filebtn">JSONバックアップを選択<input id="jsonBackupFile" type="file" accept=".json,application/json"></label>
    <div id="jsonBackupInfo" class="muted" style="margin-top:8px">まだファイルが選択されていません。</div>
    <div class="actions">
      <button id="jsonMerge" disabled>既存データに追加</button>
      <button id="jsonReplace" class="danger" disabled>バックアップで置き換え</button>
    </div>
    <p class="muted">追加：バックアップ内の取引を現在の履歴に追加します。置き換え：現在の取引・価格・為替をバックアップ内容に置き換えます。実行前に確認します。</p>`;
  section.insertBefore(card, section.firstChild);

  let backup = null;
  const fileInput = document.getElementById('jsonBackupFile');
  const info = document.getElementById('jsonBackupInfo');
  const merge = document.getElementById('jsonMerge');
  const replace = document.getElementById('jsonReplace');

  fileInput.addEventListener('change', async () => {
    backup = null;
    merge.disabled = replace.disabled = true;
    const file = fileInput.files && fileInput.files[0];
    if (!file) { info.textContent = 'まだファイルが選択されていません。'; return; }
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.trades) || typeof data.prices !== 'object' || data.prices === null || !Number.isFinite(Number(data.fx))) {
        throw new Error('このファイルは株式損益ノートのバックアップ形式ではありません。');
      }
      const valid = data.trades.every(t => t && typeof t.date === 'string' && typeof t.symbol === 'string' && ['BUY','SELL'].includes(t.side) && Number(t.qty) > 0 && Number(t.price) >= 0 && ['USD','JPY'].includes(t.currency));
      if (!valid) throw new Error('取引データの形式が正しくありません。');
      backup = { trades: data.trades, prices: data.prices, fx: Number(data.fx) };
      info.textContent = `読み込みOK：取引 ${backup.trades.length}件、現在価格 ${Object.keys(backup.prices).length}銘柄、USD/JPY ${backup.fx}`;
      merge.disabled = replace.disabled = false;
    } catch (err) {
      info.textContent = '読み込み失敗：' + (err && err.message ? err.message : 'JSONを確認してください。');
    }
  });

  const current = () => ({
    trades: JSON.parse(localStorage.getItem('stocknote_trades') || '[]'),
    prices: JSON.parse(localStorage.getItem('stocknote_prices') || '{}'),
    fx: Number(localStorage.getItem('stocknote_fx') || 150)
  });
  const store = data => {
    localStorage.setItem('stocknote_trades', JSON.stringify(data.trades));
    localStorage.setItem('stocknote_prices', JSON.stringify(data.prices));
    localStorage.setItem('stocknote_fx', String(data.fx));
  };

  merge.addEventListener('click', () => {
    if (!backup) return;
    const now = current();
    if (!confirm(`バックアップの${backup.trades.length}件を、現在の${now.trades.length}件に追加します。重複チェックは行いません。続けますか？`)) return;
    store({ trades: now.trades.concat(backup.trades), prices: { ...now.prices, ...backup.prices }, fx: backup.fx });
    alert('バックアップを追加しました。画面を更新します。');
    location.reload();
  });

  replace.addEventListener('click', () => {
    if (!backup) return;
    if (!confirm(`現在の取引${current().trades.length}件を、バックアップの${backup.trades.length}件で置き換えます。よろしいですか？`)) return;
    store(backup);
    alert('バックアップから復元しました。画面を更新します。');
    location.reload();
  });
})();
