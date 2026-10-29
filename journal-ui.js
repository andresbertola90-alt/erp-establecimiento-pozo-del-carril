'use strict';
const journalMoney = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
function journalLine(line = {}) {
  const selected = db.accounts.find(account => account.id === line.accountId);
  const accounts = db.accounts.filter(UNRCJournal.manualAccount).filter(account=>!UNRCAccountPlan.enabled(db)||account.planVersion===UNRCAccountPlan.VERSION).sort((a,b)=>a.code.localeCompare(b.code,'es',{numeric:true}));
  if (selected && !accounts.some(account => account.id === selected.id)) accounts.push(selected);
  return `<tr class="journal-line"><td><select class="journal-account" aria-label="Cuenta del renglón" required><option value="">Seleccionar cuenta</option>${accounts.map(account => `<option value="${esc(account.id)}" ${account.id===line.accountId?'selected':''}>${esc(account.code+' · '+account.name)}</option>`).join('')}</select></td><td><input class="journal-debit" type="number" min="0" step="0.01" inputmode="decimal" aria-label="Debe" value="${esc(line.debit||'')}"></td><td><input class="journal-credit" type="number" min="0" step="0.01" inputmode="decimal" aria-label="Haber" value="${esc(line.credit||'')}"></td><td><div class="record-tools"><button type="button" class="tool" data-journal-action="balance" title="Completar diferencia en este renglón" aria-label="Completar diferencia en este renglón">${icon('equal')}</button><button type="button" class="tool danger" data-journal-action="remove" title="Quitar renglón" aria-label="Quitar renglón">${icon('trash-2')}</button></div></td></tr>`;
}
function mountJournal(lines) {
  const saved = Array.isArray(lines) && lines.length ? lines : [{}, {}];
  $('#journalEditor').innerHTML = `<div class="surface-title"><h4>Cuentas del asiento</h4><button class="btn ghost" type="button" data-journal-action="add">${icon('plus')}Agregar cuenta</button></div><div class="journal-scroll"><table class="journal-entry-table"><colgroup><col class="journal-account-col"><col class="journal-amount-col"><col class="journal-amount-col"><col class="journal-tools-col"></colgroup><thead><tr><th>Cuenta</th><th>Debe ($)</th><th>Haber ($)</th><th></th></tr></thead><tbody>${saved.map(journalLine).join('')}</tbody></table></div><div class="journal-totals" aria-live="polite"><div><span>Total Debe</span><strong id="journalDebitTotal"></strong></div><div><span>Total Haber</span><strong id="journalCreditTotal"></strong></div><div><span>Diferencia</span><strong id="journalDifference"></strong></div></div><p id="journalBalanceState" class="journal-balance-state" role="status"></p>`;
  syncJournal(); refreshIcons();
}
function readJournalLines() {
  return [...document.querySelectorAll('#journalEditor .journal-line')].map(row => ({ accountId: row.querySelector('.journal-account').value, debit: Number(row.querySelector('.journal-debit').value || 0), credit: Number(row.querySelector('.journal-credit').value || 0) }));
}
function syncJournal() {
  if (!$('#journalEditor')) return;
  const totals = UNRCJournal.totals(readJournalLines());
  $('#journalDebitTotal').textContent = journalMoney(totals.debit);
  $('#journalCreditTotal').textContent = journalMoney(totals.credit);
  $('#journalDifference').textContent = journalMoney(Math.abs(totals.difference));
  const balanced = Number.isFinite(totals.difference) && totals.difference === 0 && totals.debit > 0;
  $('#journalBalanceState').textContent = balanced ? 'Asiento balanceado' : totals.difference ? 'Falta imputar '+journalMoney(Math.abs(totals.difference))+' al '+(totals.difference>0?'Haber':'Debe') : 'Completá las cuentas y los importes';
  $('#journalBalanceState').classList.toggle('unbalanced', !balanced);
  const lines = document.querySelectorAll('#journalEditor .journal-line');
  lines.forEach((row, i) => {
    row.querySelector('.journal-account').required = true;
    row.querySelector('.journal-account').setAttribute('aria-label', 'Cuenta del renglón '+(i+1));
    row.querySelector('[data-journal-action="remove"]').disabled = lines.length <= 2;
  });
  $('#recordForm [type="submit"]').disabled = !balanced;
}
document.addEventListener('click', event => {
  const control = event.target.closest('[data-journal-action]'); if (!control || busy) return;
  const row = control.closest('.journal-line');
  if (control.dataset.journalAction === 'add') { $('#journalEditor tbody').insertAdjacentHTML('beforeend', journalLine()); $('#journalEditor tbody tr:last-child select').focus(); }
  if (control.dataset.journalAction === 'remove' && $('#journalEditor tbody').rows.length > 2) row.remove();
  if (control.dataset.journalAction === 'balance') {
    const all = [...document.querySelectorAll('#journalEditor .journal-line')];
    const remainder = UNRCJournal.totals(readJournalLines().filter((_line, index) => all[index] !== row)).difference;
    row.querySelector('.journal-debit').value = remainder < 0 ? Math.abs(remainder).toFixed(2) : '';
    row.querySelector('.journal-credit').value = remainder > 0 ? remainder.toFixed(2) : '';
  }
  syncJournal(); refreshIcons();
});
document.addEventListener('input', event => { if (event.target.closest('#journalEditor')) syncJournal(); });
document.addEventListener('change', event => { if (event.target.closest('#journalEditor')) syncJournal(); });
function renderJournal(data) {
  const rows = data.entries.flatMap(entry => [
    `<tr class="journal-operation"><th colspan="4">${entry.number} · ${date(entry.date)} · ${esc(D.AREAS[entry.area])} · ${esc(entry.description)}</th></tr>`,
    ...entry.lines.map(line => `<tr><td>${esc(db.accounts.find(account=>account.id===line.accountId)?.code||line.accountId)}</td><td class="${line.credit?'journal-credit-account':''}">${esc(nameOf('accounts',line.accountId))}</td><td class="numeric">${line.debit?journalMoney(line.debit):'-'}</td><td class="numeric">${line.credit?journalMoney(line.credit):'-'}</td></tr>`)
  ]).join('');
  return `<section class="surface"><div class="surface-title"><h4>Libro diario</h4><div class="section-actions">${button('Exportar Excel','export','data-table="journal"','file-spreadsheet','ghost')}${button('Nuevo asiento','new','data-table="entries"')}</div></div><div class="table-panel"><div class="table-scroll"><table class="journal-ledger"><thead><tr><th>Código</th><th>Cuenta / detalle</th><th>Debe ($)</th><th>Haber ($)</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Sin asientos confirmados en el período.</td></tr>'}</tbody><tfoot><tr><th colspan="2">Total del período</th><th class="numeric">${journalMoney(data.debit)}</th><th class="numeric">${journalMoney(data.credit)}</th></tr><tr><th colspan="3">Diferencia Debe - Haber</th><th class="numeric">${journalMoney(data.difference)}</th></tr></tfoot></table></div></div></section>`;
}
async function exportJournal() {
  if (!window.ExcelJS) throw new Error('No se pudo cargar la exportación de Excel.');
  const query = UNRCJournal.query(db, ui.from, ui.to);
  if (!query.entries.length) return toast('No hay asientos confirmados para exportar.');
  const snapshot = { ...query, accounts: structuredClone(db.accounts), from: ui.from, to: ui.to, issued: new Date().toISOString(), user: UNRCAuth.current.name+' ('+UNRCAuth.current.username+')' };
  const book = await UNRCJournal.workbook(snapshot, ExcelJS);
  const buffer = await book.xlsx.writeBuffer();
  if (!await ensureAccess()) return;
  download('UNRC-Libro-diario-'+snapshot.from+'-al-'+snapshot.to+'.xlsx', buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
