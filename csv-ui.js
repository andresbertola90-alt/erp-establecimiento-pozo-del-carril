(function(root) {
  'use strict';

  const Csv = typeof module !== 'undefined' && module.exports ? require('./csv-engine.js') : root.UNRCCsv;

  let wizardState = {
    step: 1,
    entityId: 'campaigns',
    file: null,
    fileText: '',
    fileName: '',
    delimiter: ';',
    rawHeaders: [],
    columnMapping: {},
    previewResult: null,
    strategy: 'skip',
    mappingError: '',
    busy: false
  };

  function openCsvImportWizard(targetEntity = null) {
    const dialog = document.getElementById('csvWizardDialog');
    if (!dialog) return;

    // Verificar permisos del usuario actual
    const user = (root.UNRCAuth && root.UNRCAuth.current) || { role: 'operador' };
    if (user.role === 'analista' || user.role === 'auditor') {
      root.toast && root.toast('Acceso de solo consulta: Tu perfil (' + (user.role === 'auditor' ? 'Auditor' : 'Analista') + ') tiene permisos para exportar información, pero no para importar datos.');
      return;
    }

    // Si se pasa una entidad objetivo (ej. desde el módulo de agricultura o ganadería)
    let initEntity = targetEntity || 'campaigns';
    if (user.role === 'responsable_agricultura') {
      initEntity = ['campaigns', 'costs', 'stock', 'sales'].includes(initEntity) ? initEntity : 'campaigns';
    } else if (user.role === 'responsable_ganaderia' || user.role === 'responsable_cerdos') {
      initEntity = ['lots', 'movements', 'costs', 'sales', 'stock'].includes(initEntity) ? initEntity : 'lots';
    }

    wizardState = {
      step: 1,
      entityId: initEntity,
      file: null,
      fileText: '',
      fileName: '',
      delimiter: ';',
      rawHeaders: [],
      columnMapping: {},
      previewResult: null,
      strategy: 'skip',
      mappingError: '',
      busy: false
    };

    renderWizard();
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
  }

  function closeWizard() {
    const dialog = document.getElementById('csvWizardDialog');
    if (dialog && dialog.open) {
      dialog.close();
    }
  }

  function reparseFileWithDelimiter(delim) {
    wizardState.delimiter = delim;
    if (!wizardState.fileText) return;

    const clean = Csv.cleanBom(wizardState.fileText);
    const firstLine = clean.split(/\r?\n/)[0] || '';

    let headers = [];
    if (typeof Papa !== 'undefined') {
      const p = Papa.parse(clean, { delimiter: delim, preview: 1, header: false });
      headers = (p.data && p.data[0]) || [];
    } else {
      headers = firstLine.split(delim).map(c => c.replace(/^"|"$/g, '').trim());
    }

    wizardState.rawHeaders = headers;
    const matched = Csv.matchColumns(headers, wizardState.entityId);
    wizardState.columnMapping = matched.mapping;
    wizardState.mappingError = '';
  }

  function renderWizard() {
    const dialog = document.getElementById('csvWizardDialog');
    if (!dialog) return;

    const user = (root.UNRCAuth && root.UNRCAuth.current) || { role: 'operador' };
    const isAdmin = user.role === 'admin';
    const isAgri = user.role === 'responsable_agricultura' || isAdmin;
    const isGan = user.role === 'responsable_ganaderia' || user.role === 'responsable_cerdos' || isAdmin;

    const meta = Csv.ENTITIES[wizardState.entityId] || Csv.ENTITIES.campaigns;

    // Pasos del Asistente
    const stepsNav = `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:12px 24px; font-size:0.8rem">
        <div style="display:flex; gap:16px; flex-wrap:wrap">
          <span style="font-weight:${wizardState.step===1?'700':'400'}; color:${wizardState.step===1?'#087FBD':'#64748B'}">1. Entidad & Plantilla</span>
          <span style="color:#cbd5e1">›</span>
          <span style="font-weight:${wizardState.step===2?'700':'400'}; color:${wizardState.step===2?'#087FBD':'#64748B'}">2. Cargar Archivo</span>
          <span style="color:#cbd5e1">›</span>
          <span style="font-weight:${wizardState.step===3?'700':'400'}; color:${wizardState.step===3?'#087FBD':'#64748B'}">3. Mapeo Columnas</span>
          <span style="color:#cbd5e1">›</span>
          <span style="font-weight:${wizardState.step===4?'700':'400'}; color:${wizardState.step===4?'#087FBD':'#64748B'}">4. Vista Previa de Filas</span>
          <span style="color:#cbd5e1">›</span>
          <span style="font-weight:${wizardState.step===5?'700':'400'}; color:${wizardState.step===5?'#10b981':'#64748B'}">5. Confirmación</span>
        </div>
        <span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700">Paso ${wizardState.step} de 5</span>
      </div>
    `;

    let stepHtml = '';

    // =========================================================
    // PASO 1: SELECCIONAR ENTIDAD
    // =========================================================
    if (wizardState.step === 1) {
      stepHtml = `
        <div style="padding:24px; display:flex; flex-direction:column; gap:18px">
          <div>
            <label style="font-size:0.88rem; font-weight:700; color:#14263D; display:block; margin-bottom:8px">Seleccioná el módulo y tipo de registro a importar:</label>
            <select id="wizardEntitySelect" class="input" style="width:100%; padding:10px 12px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:6px">
              ${isAgri ? `
                <optgroup label="Gestión Agrícola">
                  <option value="campaigns" ${wizardState.entityId==='campaigns'?'selected':''}>Campañas y Lotes Agrícolas (Maíz / Soja)</option>
                </optgroup>
              ` : ''}
              ${isGan ? `
                <optgroup label="Gestión Ganadera">
                  <option value="lots" ${wizardState.entityId==='lots'?'selected':''}>Lotes y Categorías de Hacienda (Bovinos, Porcinos, Ovinos)</option>
                  <option value="movements" ${wizardState.entityId==='movements'?'selected':''}>Movimientos Ganaderos, Pesajes y Sanidad</option>
                </optgroup>
              ` : ''}
              <optgroup label="Gestión Comercial y Operativa">
                <option value="parties" ${wizardState.entityId==='parties'?'selected':''}>Clientes y Proveedores</option>
                <option value="costs" ${wizardState.entityId==='costs'?'selected':''}>Compras y Costos Operativos</option>
                <option value="sales" ${wizardState.entityId==='sales'?'selected':''}>Ventas Comerciales (Hacienda y Granos)</option>
                <option value="stock" ${wizardState.entityId==='stock'?'selected':''}>Existencias, Cosechas e Insumos</option>
                <option value="payments" ${wizardState.entityId==='payments'?'selected':''}>Cobros y Pagos Financieros</option>
              </optgroup>
            </select>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px">
            <h5 style="margin:0 0 10px 0; color:#14263D; font-size:0.95rem; display:flex; align-items:center; gap:8px">
              <i data-lucide="info" style="color:#087FBD; width:18px; height:18px"></i> Estructura y Reglas para <strong>${meta.name}</strong>
            </h5>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.84rem; color:#475569">
              <div>
                <strong>Campos Obligatorios (*):</strong>
                <ul style="margin:4px 0 0 16px; padding:0">
                  ${meta.fields.filter(f => f.required).map(f => `<li><code>${f.label}</code></li>`).join('')}
                </ul>
              </div>
              <div>
                <strong>Campos Opcionales:</strong>
                <ul style="margin:4px 0 0 16px; padding:0">
                  ${meta.fields.filter(f => !f.required).map(f => `<li><code>${f.label}</code></li>`).join('')}
                </ul>
              </div>
            </div>
            <p style="margin:12px 0 0 0; font-size:0.8rem; color:#64748B; border-top:1px solid #edf2f7; padding-top:10px">
              ✓ Compatible con Microsoft Excel argentino (separador <code>;</code>, números con coma decimal <code>1.250,50</code> y fechas <code>DD/MM/AAAA</code>).
            </p>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:16px; margin-top:8px">
            <button type="button" class="btn ghost" id="wizardBtnDownloadTemplate" style="color:#087FBD; font-weight:600">
              <i data-lucide="download" style="width:16px; height:16px"></i> Descargar Plantilla CSV Oficial
            </button>
            <button type="button" class="btn primary" id="wizardBtnNext1">
              Continuar al Paso 2: Cargar Archivo →
            </button>
          </div>
        </div>
      `;
    }

    // =========================================================
    // PASO 2: CARGAR ARCHIVO CSV
    // =========================================================
    else if (wizardState.step === 2) {
      stepHtml = `
        <div style="padding:24px; display:flex; flex-direction:column; gap:18px">
          <div>
            <h4 style="margin:0 0 6px 0; color:#14263D; font-size:1.1rem">Cargar archivo CSV para ${meta.name}</h4>
            <p style="margin:0; font-size:0.86rem; color:#64748B">Seleccioná o arrastrá el archivo CSV exportado desde Microsoft Excel o tu sistema.</p>
          </div>

          <div id="wizardDropZone" style="border:2px dashed #94a3b8; border-radius:10px; padding:28px 20px; text-align:center; background:#f8fafc; cursor:pointer; transition:all 0.2s">
            <i data-lucide="upload-cloud" style="width:44px; height:44px; color:#087FBD; margin-bottom:10px"></i>
            <h5 style="margin:0 0 6px 0; font-size:1rem; color:#14263D">Hacé clic aquí o arrastrá tu archivo .csv</h5>
            <p style="margin:0; font-size:0.8rem; color:#64748B">Formatos compatibles: CSV delimitado por punto y coma (;) o comas (,)</p>
            <input type="file" id="wizardFileInput" accept=".csv,text/csv" style="display:none">
          </div>

          ${wizardState.fileName ? `
            <div style="background:#e0f2fe; border:1px solid #bae6fd; border-radius:8px; padding:14px 18px; display:flex; flex-direction:column; gap:10px">
              <div style="display:flex; justify-content:space-between; align-items:center">
                <div>
                  <strong style="color:#0369a1; font-size:0.95rem; display:block">📄 ${wizardState.fileName}</strong>
                  <span style="font-size:0.8rem; color:#0284c7">
                    Encabezados detectados: <strong>${wizardState.rawHeaders.length}</strong> · Codificación: <strong>UTF-8</strong>
                  </span>
                </div>
                <span class="badge" style="background:#10b981; color:#fff">✓ Archivo cargado</span>
              </div>

              <!-- Selector de delimitador en caso de necesidad -->
              <div style="display:flex; align-items:center; gap:14px; border-top:1px solid #bae6fd; padding-top:10px; font-size:0.84rem">
                <span style="font-weight:600; color:#0369a1">Separador de columnas:</span>
                <label style="display:flex; align-items:center; gap:4px; cursor:pointer">
                  <input type="radio" name="wizardDelimRadio" value=";" ${wizardState.delimiter===';'?'checked':''}> Punto y coma (;)
                </label>
                <label style="display:flex; align-items:center; gap:4px; cursor:pointer">
                  <input type="radio" name="wizardDelimRadio" value="," ${wizardState.delimiter===','?'checked':''}> Coma (,)
                </label>
              </div>

              <!-- Vista previa de encabezados leídos -->
              <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:8px 12px; font-size:0.78rem; overflow-x:auto">
                <span style="color:#64748B; font-weight:600; display:block; margin-bottom:4px">Columnas leídas del archivo:</span>
                <div style="display:flex; gap:6px; flex-wrap:wrap">
                  ${wizardState.rawHeaders.map((h, i) => `<span class="badge neutral" style="font-family:monospace">Col ${i+1}: ${h}</span>`).join('')}
                </div>
              </div>
            </div>
          ` : ''}

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:16px">
            <button type="button" class="btn ghost" id="wizardBtnBack">← Paso Anterior</button>
            <button type="button" class="btn primary" id="wizardBtnNext2" ${!wizardState.fileText ? 'disabled style="opacity:0.5; cursor:not-allowed"' : ''}>
              Continuar al Mapeo de Columnas →
            </button>
          </div>
        </div>
      `;
    }

    // =========================================================
    // PASO 3: MAPEO DE COLUMNAS
    // =========================================================
    else if (wizardState.step === 3) {
      const missingRequired = meta.fields.filter(f => f.required && wizardState.columnMapping[f.key] === undefined);

      stepHtml = `
        <div style="padding:24px; display:flex; flex-direction:column; gap:16px">
          <div>
            <h4 style="margin:0 0 4px 0; color:#14263D; font-size:1.1rem">Mapeo de Columnas · ${meta.name}</h4>
            <p style="margin:0; font-size:0.85rem; color:#64748B">Relacioná cada campo del sistema con la columna correspondiente de tu archivo.</p>
          </div>

          ${wizardState.mappingError ? `
            <div style="background:#fee2e2; border:1px solid #fecaca; color:#991b1b; padding:12px 16px; border-radius:8px; font-size:0.85rem">
              <strong>⚠️ Atención:</strong> ${wizardState.mappingError}
            </div>
          ` : ''}

          ${missingRequired.length > 0 ? `
            <div style="background:#fffbeb; border:1px solid #fef3c7; color:#92400e; padding:10px 14px; border-radius:8px; font-size:0.84rem">
              <strong>Campos obligatorios pendientes de asignar:</strong> ${missingRequired.map(f => `<code>${f.label}</code>`).join(', ')}.
            </div>
          ` : `
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; padding:8px 14px; border-radius:8px; font-size:0.82rem">
              ✓ Todos los campos obligatorios se encuentran mapeados correctamente.
            </div>
          `}

          <div style="max-height:340px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px">
            <table class="table" style="width:100%; margin:0; font-size:0.85rem">
              <thead>
                <tr style="background:#f1f5f9; text-align:left">
                  <th style="padding:10px 14px">Campo del Sistema</th>
                  <th style="padding:10px 14px">Requisito</th>
                  <th style="padding:10px 14px">Columna en tu Archivo CSV</th>
                </tr>
              </thead>
              <tbody>
                ${meta.fields.map(f => {
                  const mappedIdx = wizardState.columnMapping[f.key];
                  const isMissing = f.required && mappedIdx === undefined;
                  return `
                    <tr style="border-bottom:1px solid #f1f5f9; background:${isMissing ? '#fff5f5' : '#ffffff'}">
                      <td style="padding:10px 14px">
                        <strong style="color:${isMissing ? '#991b1b' : '#14263D'}">${f.label}</strong>
                        <small style="display:block; color:#64748B">Tipo: ${f.type}</small>
                      </td>
                      <td style="padding:10px 14px">
                        ${f.required ? '<span class="badge" style="background:#fee2e2; color:#991b1b; font-weight:700">Requerido</span>' : '<span style="color:#94a3b8">Opcional</span>'}
                      </td>
                      <td style="padding:10px 14px">
                        <select class="input wizard-map-select" data-field="${f.key}" style="width:100%; padding:6px 10px; font-size:0.85rem; border-color:${isMissing ? '#ef4444' : '#cbd5e1'}">
                          <option value="">-- No mapear / Dejar vacío --</option>
                          ${wizardState.rawHeaders.map((h, idx) => `
                            <option value="${idx}" ${mappedIdx === idx ? 'selected' : ''}>Columna ${idx + 1}: ${h}</option>
                          `).join('')}
                        </select>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:16px">
            <button type="button" class="btn ghost" id="wizardBtnBack">← Paso Anterior</button>
            <button type="button" class="btn primary" id="wizardBtnNext3" style="background:#087FBD; border-color:#087FBD">
              Validar y Cargar Vista Previa →
            </button>
          </div>
        </div>
      `;
    }

    // =========================================================
    // PASO 4: VISTA PREVIA DETALLADA DE FILAS & VALIDACIÓN
    // =========================================================
    else if (wizardState.step === 4) {
      const p = wizardState.previewResult;
      const validCount = p ? p.validRows.length : 0;
      const dupCount = p ? p.duplicateRows.length : 0;
      const errCount = p ? p.invalidRows.length : 0;

      // Combinar todas las filas para la tabla de vista previa ordenada por número de fila
      const allRows = [];
      if (p) {
        (p.validRows || []).forEach(r => allRows.push({ ...r, status: 'valid' }));
        (p.duplicateRows || []).forEach(r => allRows.push({ ...r, status: 'duplicate' }));
        (p.invalidRows || []).forEach(r => allRows.push({ ...r, status: 'error' }));
        allRows.sort((a, b) => a.rowNum - b.rowNum);
      }

      // Columnas mapeadas activas para mostrar en la tabla
      const displayFields = meta.fields.filter(f => wizardState.columnMapping[f.key] !== undefined);

      stepHtml = `
        <div style="padding:22px; display:flex; flex-direction:column; gap:16px">
          <div>
            <h4 style="margin:0 0 4px 0; color:#14263D; font-size:1.15rem">Vista Previa y Validación de Registros</h4>
            <p style="margin:0; font-size:0.85rem; color:#64748B">Revisá las filas procesadas antes de confirmar la incorporación a la base de datos.</p>
          </div>

          <!-- Semáforo de Estadísticas -->
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px">
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px; text-align:center">
              <span style="font-size:1.4rem; font-weight:800; color:#16a34a; display:block">${validCount}</span>
              <span style="font-size:0.8rem; font-weight:700; color:#15803d">✓ Registros Válidos (Nuevos)</span>
            </div>
            <div style="background:#fefce8; border:1px solid #fef08a; border-radius:8px; padding:12px; text-align:center">
              <span style="font-size:1.4rem; font-weight:800; color:#ca8a04; display:block">${dupCount}</span>
              <span style="font-size:0.8rem; font-weight:700; color:#a16207">⚠️ Duplicados Detectados</span>
            </div>
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; text-align:center">
              <span style="font-size:1.4rem; font-weight:800; color:#dc2626; display:block">${errCount}</span>
              <span style="font-size:0.8rem; font-weight:700; color:#b91c1c">❌ Filas Rechazadas con Errores</span>
            </div>
          </div>

          <!-- TABLA DE VISTA PREVIA DETALLADA -->
          <div style="border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; background:#ffffff">
            <div style="background:#f1f5f9; padding:10px 14px; font-weight:700; font-size:0.86rem; color:#14263D; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0">
              <span style="display:flex; align-items:center; gap:6px">
                <i data-lucide="table" style="width:16px; height:16px; color:#087FBD"></i>
                Vista Previa de Filas (${allRows.length} filas analizadas)
              </span>
              <small style="color:#64748B">Mostrando primeras ${Math.min(20, allRows.length)} filas</small>
            </div>
            <div style="max-height:220px; overflow-x:auto; overflow-y:auto">
              <table class="table" style="width:100%; font-size:0.8rem; margin:0">
                <thead>
                  <tr style="background:#f8fafc; position:sticky; top:0; z-index:2; border-bottom:1px solid #e2e8f0">
                    <th style="padding:6px 10px; width:50px">Fila</th>
                    <th style="padding:6px 10px; width:90px">Estado</th>
                    ${displayFields.map(f => `<th style="padding:6px 10px">${f.label}</th>`).join('')}
                    <th style="padding:6px 10px">Diagnóstico / Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  ${allRows.length ? allRows.slice(0, 20).map(r => {
                    const isError = r.status === 'error';
                    const isDup = r.status === 'duplicate';
                    const rowBg = isError ? '#fef2f2' : isDup ? '#fefce8' : '#ffffff';
                    return `
                      <tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9">
                        <td style="padding:6px 10px; font-weight:700; color:#64748B">${r.rowNum}</td>
                        <td style="padding:6px 10px">
                          ${isError
                            ? '<span class="badge" style="background:#fee2e2; color:#991b1b; font-weight:700">❌ Error</span>'
                            : isDup
                            ? '<span class="badge" style="background:#fef08a; color:#854d0e; font-weight:700">⚠️ Duplicado</span>'
                            : '<span class="badge" style="background:#dcfce7; color:#166534; font-weight:700">✓ Válido</span>'}
                        </td>
                        ${displayFields.map(f => {
                          let val = r.data ? r.data[f.key] : (r.raw ? r.raw[wizardState.columnMapping[f.key]] : '');
                          if (val === null || val === undefined) val = '-';
                          return `<td style="padding:6px 10px">${val}</td>`;
                        }).join('')}
                        <td style="padding:6px 10px; font-size:0.76rem">
                          ${isError
                            ? `<span style="color:#b91c1c; font-weight:600">${r.errors.map(e => `${e.label}: ${e.error}`).join(' | ')}</span>`
                            : isDup
                            ? `<span style="color:#854d0e">Ya coincide con registro existente en sistema</span>`
                            : `<span style="color:#166534">Listo para incorporar</span>`}
                        </td>
                      </tr>
                    `;
                  }).join('') : '<tr><td colspan="6" style="padding:16px; text-align:center; color:#64748b">No se encontraron filas para previsualizar.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Selección de Estrategia para Duplicados -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px">
            <strong style="font-size:0.86rem; color:#14263D; display:block; margin-bottom:6px">Estrategia ante Registros Duplicados:</strong>
            <div style="display:flex; flex-direction:column; gap:6px; font-size:0.82rem">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer">
                <input type="radio" name="wizardStrategy" value="skip" ${wizardState.strategy==='skip'?'checked':''}>
                <span><strong>Omitir duplicados</strong> (conservar registros existentes sin modificarlos · Recomendado)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer">
                <input type="radio" name="wizardStrategy" value="update" ${wizardState.strategy==='update'?'checked':''}>
                <span><strong>Actualizar registros existentes</strong> (actualizar valores con los datos del CSV)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer">
                <input type="radio" name="wizardStrategy" value="error" ${wizardState.strategy==='error'?'checked':''}>
                <span><strong>Importar únicamente registros nuevos</strong> (ignorar duplicados)</span>
              </label>
            </div>
          </div>

          <!-- Si hay filas con error, permitir descargar reporte -->
          ${errCount > 0 ? `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#fff5f5; border:1px solid #fecaca; border-radius:8px; padding:10px 14px">
              <span style="font-size:0.82rem; color:#991b1b">
                ⚠️ Se detectaron ${errCount} filas con errores que no podrán incorporarse. Podés descargar el informe para corregirlas en Excel.
              </span>
              <button type="button" class="btn ghost danger" id="wizardBtnDownloadErrors" style="font-size:0.75rem; padding:4px 10px; white-space:nowrap">
                <i data-lucide="download" style="width:14px; height:14px"></i> Descargar Informe de Errores CSV
              </button>
            </div>
          ` : ''}

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:16px">
            <button type="button" class="btn ghost" id="wizardBtnBack">← Reconfigurar Mapeo</button>
            <button type="button" class="btn primary" id="wizardBtnNext4" ${validCount === 0 && (dupCount === 0 || wizardState.strategy === 'skip') ? 'disabled style="opacity:0.5"' : ''} style="background:#10b981; border-color:#10b981">
              Confirmar e Importar ${validCount + (wizardState.strategy==='update'?dupCount:0)} Registros →
            </button>
          </div>
        </div>
      `;
    }

    // =========================================================
    // PASO 5: REPORTE FINAL DE FINALIZACIÓN
    // =========================================================
    else if (wizardState.step === 5) {
      stepHtml = `
        <div style="padding:28px 24px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:16px">
          <div style="width:56px; height:56px; border-radius:50%; background:#dcfce7; display:flex; align-items:center; justify-content:center; color:#16a34a">
            <i data-lucide="check-circle" style="width:36px; height:36px"></i>
          </div>
          <div>
            <h3 style="margin:0 0 6px 0; font-size:1.3rem; color:#14263D">¡Importación Completada con Éxito!</h3>
            <p style="margin:0; font-size:0.88rem; color:#64748B">Los registros han sido guardados y auditados de acuerdo a las reglas del establecimiento.</p>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px 24px; max-width:460px; width:100%; text-align:left; font-size:0.86rem">
            <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #edf2f7">
              <span style="color:#64748B">Módulo destino:</span>
              <strong>${meta.name}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #edf2f7">
              <span style="color:#64748B">Registros nuevos incorporados:</span>
              <strong style="color:#16a34a">${wizardState.importStats?.insertedCount || 0}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #edf2f7">
              <span style="color:#64748B">Registros existentes actualizados:</span>
              <strong style="color:#087FBD">${wizardState.importStats?.updatedCount || 0}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:6px 0">
              <span style="color:#64748B">Filas omitidas / no modificadas:</span>
              <span style="color:#94a3b8">${wizardState.importStats?.skippedCount || 0}</span>
            </div>
          </div>

          <button type="button" class="btn primary" id="wizardBtnFinish" style="margin-top:10px">
            Finalizar y Ver Registros Actualizados
          </button>
        </div>
      `;
    }

    dialog.innerHTML = `
      <div class="dialog-card" style="max-width:820px; padding:0; overflow:hidden; background:#ffffff; border-radius:10px; border:1px solid #cbd5e1">
        <div style="background:#14263D; color:#ffffff; padding:18px 24px; display:flex; justify-content:space-between; align-items:center">
          <div>
            <h3 style="margin:0; font-size:1.2rem; color:#ffffff; display:flex; align-items:center; gap:8px">
              <i data-lucide="file-spreadsheet" style="color:#087FBD"></i> Asistente de Importación CSV · Excel Argentino
            </h3>
            <p style="margin:4px 0 0 0; font-size:0.8rem; color:#94a3b8">Carga masiva, validación de integridad y control de duplicados</p>
          </div>
          <button class="tool" type="button" id="wizardBtnClose" style="color:#ffffff; background:transparent; border:none; font-size:1.4rem; cursor:pointer">×</button>
        </div>
        ${stepsNav}
        ${stepHtml}
      </div>
    `;

    bindWizardEvents();
    if (typeof root.lucide !== 'undefined' && typeof root.lucide.createIcons === 'function') {
      root.lucide.createIcons();
    }
  }

  function bindWizardEvents() {
    const dialog = document.getElementById('csvWizardDialog');
    if (!dialog) return;

    // Botón Cerrar
    const closeBtn = document.getElementById('wizardBtnClose');
    if (closeBtn) closeBtn.onclick = closeWizard;

    // Selector de Entidad en Paso 1
    const entSel = document.getElementById('wizardEntitySelect');
    if (entSel) {
      entSel.onchange = e => {
        wizardState.entityId = e.target.value;
        if (wizardState.fileText) {
          const matched = Csv.matchColumns(wizardState.rawHeaders, wizardState.entityId);
          wizardState.columnMapping = matched.mapping;
        }
        renderWizard();
      };
    }

    // Botón Descargar Plantilla en Paso 1
    const tplBtn = document.getElementById('wizardBtnDownloadTemplate');
    if (tplBtn) {
      tplBtn.onclick = () => {
        downloadTemplate(wizardState.entityId);
      };
    }

    // Botón Continuar Paso 1 -> 2
    const next1 = document.getElementById('wizardBtnNext1');
    if (next1) {
      next1.onclick = () => {
        wizardState.step = 2;
        renderWizard();
      };
    }

    // Radio de Delimitador en Paso 2
    dialog.querySelectorAll('input[name="wizardDelimRadio"]').forEach(radio => {
      radio.onchange = e => {
        reparseFileWithDelimiter(e.target.value);
        renderWizard();
      };
    });

    // Manejo de carga de archivos en Paso 2
    const dropZone = document.getElementById('wizardDropZone');
    const fileInput = document.getElementById('wizardFileInput');
    if (dropZone && fileInput) {
      dropZone.onclick = () => fileInput.click();
      dropZone.ondragover = e => { e.preventDefault(); dropZone.style.borderColor = '#087FBD'; dropZone.style.background = '#f0f9ff'; };
      dropZone.ondragleave = () => { dropZone.style.borderColor = '#94a3b8'; dropZone.style.background = '#f8fafc'; };
      dropZone.ondrop = e => {
        e.preventDefault();
        dropZone.style.borderColor = '#94a3b8';
        dropZone.style.background = '#f8fafc';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          processFile(e.dataTransfer.files[0]);
        }
      };
      fileInput.onchange = e => {
        if (e.target.files && e.target.files[0]) {
          processFile(e.target.files[0]);
        }
      };
    }

    // Botón Continuar Paso 2 -> 3
    const next2 = document.getElementById('wizardBtnNext2');
    if (next2) {
      next2.onclick = () => {
        if (!wizardState.fileText) return;
        const matched = Csv.matchColumns(wizardState.rawHeaders, wizardState.entityId);
        wizardState.columnMapping = matched.mapping;
        wizardState.mappingError = '';
        wizardState.step = 3;
        renderWizard();
      };
    }

    // Cambios en los selects de Mapeo en Paso 3
    dialog.querySelectorAll('.wizard-map-select').forEach(sel => {
      sel.onchange = e => {
        const fieldKey = sel.dataset.field;
        const val = sel.value;
        if (val === '') {
          delete wizardState.columnMapping[fieldKey];
        } else {
          wizardState.columnMapping[fieldKey] = Number(val);
        }
        wizardState.mappingError = '';
      };
    });

    // Botón Continuar Paso 3 -> 4 (Validar y previsualizar)
    const next3 = document.getElementById('wizardBtnNext3');
    if (next3) {
      next3.onclick = () => {
        const meta = Csv.ENTITIES[wizardState.entityId];
        const missingRequired = meta.fields.filter(f => f.required && wizardState.columnMapping[f.key] === undefined);

        if (missingRequired.length > 0) {
          wizardState.mappingError = `Faltan asignar las siguientes columnas obligatorias: ${missingRequired.map(f => f.label).join(', ')}. Por favor, seleccioná la columna correspondiente en la lista.`;
          renderWizard();
          return;
        }

        try {
          const db = root.db || {};
          const result = Csv.parseAndValidate(wizardState.fileText, wizardState.entityId, db, wizardState.columnMapping, {
            delimiter: wizardState.delimiter
          });
          wizardState.previewResult = result;
          wizardState.mappingError = '';
          wizardState.step = 4;
          renderWizard();
        } catch (err) {
          wizardState.mappingError = err.message;
          renderWizard();
        }
      };
    }

    // Cambio de Estrategia para Duplicados en Paso 4
    dialog.querySelectorAll('input[name="wizardStrategy"]').forEach(radio => {
      radio.onchange = e => {
        wizardState.strategy = e.target.value;
        renderWizard();
      };
    });

    // Botón Descargar Informe de Errores en Paso 4
    const errBtn = document.getElementById('wizardBtnDownloadErrors');
    if (errBtn) {
      errBtn.onclick = () => {
        downloadErrorReport(wizardState.previewResult, wizardState.fileName);
      };
    }

    // Botón Confirmar e Importar Paso 4 -> 5
    const next4 = document.getElementById('wizardBtnNext4');
    if (next4) {
      next4.onclick = async () => {
        if (wizardState.busy) return;
        wizardState.busy = true;
        next4.disabled = true;
        next4.textContent = 'Guardando registros en el sistema...';

        try {
          const db = root.db || {};
          const actor = (root.UNRCAuth && root.UNRCAuth.current) || null;
          const importRes = Csv.executeImport(wizardState.previewResult, db, wizardState.strategy, actor, wizardState.fileName);

          if (typeof root.persist === 'function') {
            await root.persist(importRes.nextDb);
          } else {
            root.db = importRes.nextDb;
          }

          wizardState.importStats = importRes;
          wizardState.step = 5;
          renderWizard();
          if (typeof root.render === 'function') {
            root.render();
          }
        } catch (err) {
          wizardState.mappingError = err.message;
          alert('Fallo al guardar importación: ' + err.message);
          next4.disabled = false;
          next4.textContent = 'Reintentar Importación';
        } finally {
          wizardState.busy = false;
        }
      };
    }

    // Botón Atrás
    const backBtn = document.getElementById('wizardBtnBack');
    if (backBtn) {
      backBtn.onclick = () => {
        if (wizardState.step > 1) {
          wizardState.step--;
          wizardState.mappingError = '';
          renderWizard();
        }
      };
    }

    // Botón Finalizar Paso 5
    const finishBtn = document.getElementById('wizardBtnFinish');
    if (finishBtn) {
      finishBtn.onclick = () => {
        closeWizard();
        const meta = Csv.ENTITIES[wizardState.entityId];
        if (meta && root.ui) {
          if (meta.module === 'agricultura') root.ui.view = 'maiz';
          else if (meta.module === 'ganaderia') root.ui.view = 'cerdos';
          else if (meta.module === 'comercial') root.ui.view = 'costos';
          if (typeof root.render === 'function') root.render();
        }
      };
    }
  }

  function processFile(file) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('El archivo supera los 15 MB permitidos.');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const clean = Csv.cleanBom(text);
      const firstLine = clean.split(/\r?\n/)[0] || '';
      const delimiter = Csv.detectDelimiter(firstLine);

      // Parsear encabezados de la primera línea
      let headers = [];
      if (typeof Papa !== 'undefined') {
        const p = Papa.parse(clean, { delimiter, preview: 1, header: false });
        headers = (p.data && p.data[0]) || [];
      } else {
        headers = firstLine.split(delimiter).map(c => c.replace(/^"|"$/g, '').trim());
      }

      wizardState.file = file;
      wizardState.fileName = file.name;
      wizardState.fileText = text;
      wizardState.delimiter = delimiter;
      wizardState.rawHeaders = headers;
      wizardState.mappingError = '';

      const matched = Csv.matchColumns(headers, wizardState.entityId);
      wizardState.columnMapping = matched.mapping;

      renderWizard();
    };
    reader.readAsText(file, 'utf-8');
  }

  function downloadTemplate(entityId) {
    const meta = Csv.ENTITIES[entityId];
    if (!meta) return;
    const content = Csv.generateTemplateCsv(entityId, ';');
    const filename = `plantilla-${entityId}-pozo-del-carril.csv`;
    downloadBlob(filename, content, 'text/csv;charset=utf-8');
    if (root.toast) root.toast(`Plantilla CSV descargada: ${filename}`);
  }

  function downloadErrorReport(previewResult, originalFilename) {
    if (!previewResult || !previewResult.invalidRows || !previewResult.invalidRows.length) return;
    const rows = [
      ['Fila', 'Campo / Columna', 'Motivo del Error', 'Contenido Original']
    ];
    previewResult.invalidRows.forEach(inv => {
      const rowNum = inv.rowNum;
      const rawText = Array.isArray(inv.raw) ? inv.raw.join(' ; ') : '';
      inv.errors.forEach(err => {
        rows.push([rowNum, err.label, err.error, rawText]);
      });
    });

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const filename = `errores-importacion-${(originalFilename || 'archivo').replace(/\.[^.]+$/, '')}-${Date.now()}.csv`;
    downloadBlob(filename, csvContent, 'text/csv;charset=utf-8');
    if (root.toast) root.toast(`Informe de inconsistencias descargado: ${filename}`);
  }

  function exportModuleToCsv(entityOrTable, filterArea = null) {
    const db = root.db || {};
    let records = [];
    let table = entityOrTable;

    if (Csv.ENTITIES[entityOrTable]) {
      table = Csv.ENTITIES[entityOrTable].targetTable;
    }

    records = (db[table] || []).filter(r => !r.voided);

    // Filtrar por área si se especifica
    if (filterArea && filterArea !== 'all') {
      records = records.filter(r => r.area === filterArea || r.species === filterArea);
    }

    // Filtrar por fechas si existe período activo en ui
    if (root.ui && root.ui.from && root.ui.to) {
      if (!['accounts', 'products', 'parties', 'campaigns', 'lots'].includes(table)) {
        records = records.filter(r => r.date >= root.ui.from && r.date <= root.ui.to);
      }
    }

    if (!records.length) {
      if (root.toast) root.toast('No hay registros para exportar con los filtros seleccionados.');
      return;
    }

    const csvContent = Csv.exportRecordsToCsv(table, records, db, { delimiter: ';' });
    const filename = `UNRC-${table}-${filterArea || 'general'}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadBlob(filename, csvContent, 'text/csv;charset=utf-8');
    if (root.toast) root.toast(`✓ Exportación completada: ${records.length} registros exportados a ${filename}`);
  }

  function downloadBlob(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Exportar al ámbito global
  root.UNRCCsvUI = {
    openCsvImportWizard,
    closeWizard,
    downloadTemplate,
    exportModuleToCsv
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
