/* Stock Profit Note: safe JSON backup restore add-on.
   Loads after the main app and does not modify tab navigation or existing app handlers. */
(function () {
  'use strict';

  function init() {
    const importPanel = document.getElementById('import');
    if (!importPanel || document.getElementById('jsonRestoreCard')) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'jsonRestoreCard';

    card.innerHTML = `
      <h2>4. JSONバックアップを復元</h2>
      <p class="muted">「取引データを書き出す」で保存した stocknote-backup.json を読み込みます。読み込み前に現在のデータを自動バックアップします。</p>
      <label class="filebtn">JSONファイルを選択<input id="jsonRestoreFile" type="file" accept=".json,application/json"></label>
      <p id="jsonRestoreInfo" class="muted">まだファイルは選択されていません。</p>
      <div class="actions">
        <button type="button" id="jsonMergeBtn" disabled>既存データに追加</button>
        <button type="button" class="secondary" id="jsonReplaceBtn" disabled>バックアップで置き換え</button>
      </div>
      <p class="muted">追加では同じ取引が重複する場合があります。置き換えでは現在の取引・価格・為替設定がバックアップ内容に置き換わります。</p>`;

    importPanel.appendChild(card);

    const fileInput = document.getElementById('jsonRestoreFile');
    const info = document.getElementById('jsonRestoreInfo');
    const mergeBtn = document.getElementById('jsonMergeBtn');
    const replaceBtn = document.getElementById('jsonReplaceBtn');

    let parsed = null;

    function validTrade(t) {
      return t &&
        typeof t === 'object' &&
        typeof t.date === 'string' &&
        typeof t.symbol === 'string' &&
        ['BUY', 'SELL'].includes(String(t.side).toUpperCase()) &&
        Number.isFinite(Number(t.qty)) &&
        Number(t.qty) > 0 &&
        Number.isFinite(Number(t.price)) &&
        Number(t.price) >= 0;
    }

    function parseBackup(obj) {
      const trades = Array.isArray(obj) ? obj : obj && obj.trades;

      if (!Array.isArray(trades) || !trades.every(validTrade)) {
        throw new Error('JSONの形式が違うか、取引データが正しくありません。株式損益ノートから書き出したJSONを選んでください。');
      }

      const prices = !Array.isArray(obj) &&
        obj.prices &&
        typeof obj.prices === 'object'
          ? obj.prices
          : {};

      const fx = !Array.isArray(obj) &&
        Number.isFinite(Number(obj.fx)) &&
        Number(obj.fx) > 0
          ? Number(obj.fx)
          : 150;

      return { trades, prices, fx };
    }

    fileInput.addEventListener('change', async function () {
      parsed = null;
      mergeBtn.disabled = true;
      replaceBtn.disabled = true;

      const file = fileInput.files && fileInput.files[0];

      if (!file) {
        info.textContent = 'まだファイルは選択されていません。';
        return;
      }

      try {
        parsed = parseBackup(JSON.parse(await file.text()));

        info.textContent =
          `${file.name}：${parsed.trades.length}件の取引を確認しました。復元方法を選んでください。`;

        mergeBtn.disabled = false;
        replaceBtn.disabled = false;
      } catch (err) {
        info.textContent =
          err.message || 'JSONファイルを読み込めませんでした。';
      }
    });

    function currentData() {
      return {
        trades: JSON.parse(localStorage.getItem('stocknote_trades') || '[]'),
        prices: JSON.parse(localStorage.getItem('stocknote_prices') || '{}'),
        fx: Number(localStorage.getItem('stocknote_fx') || 150)
      };
    }

    function writeData(data) {
      localStorage.setItem(
        'stocknote_trades',
        JSON.stringify(data.trades)
      );

      localStorage.setItem(
        'stocknote_prices',
        JSON.stringify(data.prices || {})
      );

      localStorage.setItem(
        'stocknote_fx',
        String(Number(data.fx) || 150)
      );
    }

    function saveSafetyBackup() {
      const now = new Date();

      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        '-',
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0')
      ].join('');

      const blob = new Blob(
        [JSON.stringify(currentData(), null, 2)],
        { type: 'application/json' }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = `stocknote-before-restore-${stamp}.json`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    mergeBtn.addEventListener('click', function () {
      if (!parsed) return;

      if (!confirm(
        `バックアップの${parsed.trades.length}件を現在の取引履歴に追加します。続けますか？\n同じ取引が重複する可能性があります。`
      )) return;

      try {
        const current = currentData();

        saveSafetyBackup();

        writeData({
          trades: current.trades.concat(parsed.trades),
          prices: Object.assign({}, current.prices, parsed.prices),
          fx: parsed.fx || current.fx
        });

        alert('追加しました。画面を再読み込みします。');
        location.reload();
      } catch (err) {
        alert('復元できませんでした：' + err.message);
      }
    });

    replaceBtn.addEventListener('click', function () {
      if (!parsed) return;

      if (!confirm(
        `現在の取引履歴${currentData().trades.length}件を、バックアップの${parsed.trades.length}件で置き換えます。\n実行前に現在のデータをJSONで自動保存します。続けますか？`
      )) return;

      try {
        saveSafetyBackup();
        writeData(parsed);

        alert('置き換えました。画面を再読み込みします。');
        location.reload();
      } catch (err) {
        alert('復元できませんでした：' + err.message);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
