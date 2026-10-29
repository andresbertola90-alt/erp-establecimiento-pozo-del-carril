(function(root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./domain.js') : root.UNRC;
  const cents = value => Math.round(Number(value || 0) * 100);
  const Plan=typeof module!=='undefined'&&module.exports?require('./assets/account-plan.js'):root.UNRCAccountPlan;
  const manualAccount = account => Plan.manual(account)&&(!account.planVersion?!/^1\.(3|4|5)/.test(account.id):true);
  function totals(lines) {
    const debit = lines.reduce((n, line) => n + cents(line.debit), 0);
    const credit = lines.reduce((n, line) => n + cents(line.credit), 0);
    return { debit: debit / 100, credit: credit / 100, difference: (debit - credit) / 100 };
  }
  function query(db, from, to) {
    const state = D.replay(db, to);
    const entries = state.journal.map((entry, i) => ({ ...entry, number: i + 1 })).filter(entry => entry.date >= from && entry.date <= to);
    return { entries, errors: state.errors, ...totals(entries.flatMap(entry => entry.lines)) };
  }
  async function workbook(data, Excel) {
    const book = new Excel.Workbook();
    book.creator = 'Establecimiento Pozo del Carril - UNRC';
    book.created = new Date(data.issued);
    book.calcProperties.fullCalcOnLoad = true;
    const sheet = book.addWorksheet('Libro diario', {
      views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:7', margins: { left: .3, right: .3, top: .4, bottom: .4, header: .15, footer: .15 } },
      headerFooter: { oddFooter: '&LEstablecimiento Pozo del Carril&RPagina &P de &N' }
    });
    const widths = [10, 14, 16, 17, 54, 23, 23];
    widths.forEach((width, index) => sheet.getColumn(index + 1).width = width);
    const moneyFormat = '#,##0.00;[Red](#,##0.00);"-"';
    const border = { style: 'thin', color: { argb: 'FFC9D8DE' } };
    const fill = color => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });
    const full = (row, text, size = 11) => {
      sheet.mergeCells(row, 1, row, 7); sheet.getCell(row, 1).value = text;
      sheet.getCell(row, 1).font = { name: 'Calibri', size, bold: row <= 3, color: { argb: 'FF19272D' } };
      sheet.getCell(row, 1).alignment = { vertical: 'middle', wrapText: true };
    };
    full(1, 'Universidad Nacional de Rio Cuarto', 12);
    full(2, 'Establecimiento Pozo del Carril', 16);
    full(3, 'LIBRO DIARIO', 13);
    full(4, `Periodo: ${data.from.split('-').reverse().join('/')} al ${data.to.split('-').reverse().join('/')} | Moneda: ARS`);
    const warnings = data.errors.length ? 'Hay movimientos con errores. Libro parcial: revisar antes de utilizar.' : '';
    full(5, warnings || 'Operaciones registradas del periodo.');
    sheet.getCell('A5').fill = fill(warnings ? 'FFFFF3DC' : 'FFF1F6F8');
    full(6, `Emitido: ${new Date(data.issued).toLocaleString('es-AR')} | Usuario: ${data.user}`);
    sheet.getRow(7).values = ['Asiento', 'Fecha', 'Actividad', 'Codigo', 'Cuenta / detalle', 'Debe ($)', 'Haber ($)'];
    sheet.getRow(7).height = 27;
    sheet.getRow(7).eachCell(cell => { cell.fill = fill('FF187FA5'); cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { vertical: 'middle', wrapText: true }; });
    let row = 8;
    for (const entry of data.entries) {
      const titleRow = row++;
      sheet.getRow(titleRow).values = [entry.number, new Date(entry.date + 'T00:00:00Z'), D.AREAS[entry.area] || entry.area, entry.description];
      sheet.getCell(titleRow, 2).numFmt = 'dd/mm/yyyy';
      sheet.mergeCells(titleRow, 4, titleRow, 7);
      sheet.getRow(titleRow).height = Math.max(25, 15 * Math.ceil(String(entry.description).length / 105));
      sheet.getRow(titleRow).eachCell({ includeEmpty: true }, cell => { cell.fill = fill('FFE7F3F8'); cell.font = { name: 'Calibri', size: 11, bold: true }; });
      const start = row;
      for (const line of entry.lines) {
        const account = data.accounts.find(account => account.id === line.accountId);
        const name = account?.name || 'Cuenta no encontrada';
        sheet.getRow(row).values = [null, null, null, String(account?.code || line.accountId), name, line.debit ? Number(line.debit) : null, line.credit ? Number(line.credit) : null];
        sheet.getCell(row, 5).alignment = { wrapText: true, vertical: 'middle', indent: line.credit ? 1 : 0 };
        sheet.getRow(row).height = Math.max(23, 15 * Math.ceil(name.length / 45));
        row++;
      }
      const value = totals(entry.lines);
      sheet.mergeCells(row, 1, row, 5); sheet.getCell(row, 1).value = 'Total asiento ' + entry.number;
      sheet.getCell(row, 6).value = { formula: `SUM(F${start}:F${row - 1})`, result: value.debit };
      sheet.getCell(row, 7).value = { formula: `SUM(G${start}:G${row - 1})`, result: value.credit };
      sheet.getRow(row).eachCell({ includeEmpty: true }, cell => { cell.fill = fill('FFF0F4F5'); cell.font = { name: 'Calibri', size: 11, bold: true }; });
      row++;
    }
    const end = row - 1;
    const grand = totals(data.entries.flatMap(entry => entry.lines));
    sheet.mergeCells(row, 1, row, 5); sheet.getCell(row, 1).value = 'TOTAL DEL PERIODO';
    // Subtotals are merged into column A; only detail has a code in D and amounts in F/G.
    sheet.getCell(row, 6).value = { formula: `SUMIFS(F8:F${end},D8:D${end},"<>")`, result: grand.debit };
    sheet.getCell(row, 7).value = { formula: `SUMIFS(G8:G${end},D8:D${end},"<>")`, result: grand.credit };
    sheet.getRow(row).eachCell({ includeEmpty: true }, cell => { cell.fill = fill('FFD4EAF3'); cell.font = { name: 'Calibri', size: 12, bold: true }; });
    sheet.mergeCells(row + 1, 1, row + 1, 6); sheet.getCell(row + 1, 1).value = 'Diferencia Debe - Haber';
    sheet.getCell(row + 1, 7).value = { formula: `ROUND(F${row}-G${row},2)`, result: grand.difference };
    for (let r = 8; r <= row + 1; r++) {
      sheet.getRow(r).height ||= 24;
      for (let c = 1; c <= 7; c++) {
        const cell = sheet.getCell(r, c);
        if (!cell.font) cell.font = { name: 'Calibri', size: 11 };
        cell.alignment = { vertical: 'middle', wrapText: true, ...cell.alignment };
        cell.border = { top: border, left: border, bottom: border, right: border };
        if (c >= 6 && !cell.isMerged) { cell.numFmt = moneyFormat; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
      }
    }
    [1, 3, 4, 6].forEach(r => sheet.getRow(r).height = 23);
    sheet.getRow(2).height = 30; sheet.getRow(5).height = warnings.length > 120 ? 34 : 25;
    sheet.pageSetup.printArea = `A1:G${row + 1}`;
    return book;
  }
  const api = { cents, manualAccount, totals, query, workbook };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UNRCJournal = api;
})(typeof window === 'undefined' ? globalThis : window);
