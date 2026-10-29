document.addEventListener("DOMContentLoaded", async () => {
  requireRole(['admin', 'hr']);
  const user = TokenStore.getUser();
  if (user) {
    Sidebar.init('insights');
    if (typeof setAvatarElement === 'function') {
      setAvatarElement('topbar-avatar', user);
    }
    if (window.NotificationCenter) NotificationCenter.init('notif-bell-btn');
  }

  // Set skeleton loaders for sections that load on init
  const faceBody = document.getElementById("face-confidence-body");
  if (faceBody && window.Skeleton) faceBody.innerHTML = Skeleton.tableRows(5, 5);
  
  const clustersBody = document.getElementById("leave-clusters-body");
  if (clustersBody && window.Skeleton) clustersBody.innerHTML = Skeleton.text(3);
  
  const swapBody = document.getElementById("shift-swap-body");
  if (swapBody && window.Skeleton) swapBody.innerHTML = Skeleton.tableRows(3, 4);

  await Promise.all([
    loadPredictions(), 
    loadAnomalies(),
    loadFaceConfidence(),
    loadLeaveClusters(),
    loadShiftSwaps()
  ]);

  document.getElementById("run-prediction-btn")?.addEventListener("click", runPrediction);
  document.getElementById("run-anomaly-btn")?.addEventListener("click", runAnomalyScan);
});

async function loadPredictions() {
  const tbody = document.getElementById("predictions-body");
  if (!tbody) return;
  try {
    const predictions = await apiRequest("/ml/absenteeism/predictions");
    if (!predictions || predictions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="table-empty">No predictions generated yet — click "Run Prediction" above to analyze workforce data.</td></tr>`;
      return;
    }
    tbody.innerHTML = predictions.map(rowForPrediction).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="table-empty" style="color:var(--color-danger);">${err.message}</td></tr>`;
  }
}

function rowForPrediction(p) {
  const chipClass = { low: "chip-success", medium: "chip-warning", high: "chip-danger" }[p.risk_level] || "chip-neutral";
  const probVal = ((p.risk_probability || 0) * 100).toFixed(1);
  return `
    <tr>
      <td><div style="font-weight:600; color:var(--color-ink);">${p.employee_name || p.employee_id}</div></td>
      <td><span class="chip ${chipClass}">${(p.risk_level || 'low').toUpperCase()}</span></td>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="flex:1; background:var(--color-surface-alt); height:8px; border-radius:4px; overflow:hidden; border:1px solid var(--color-border);">
            <div style="background:var(--color-primary); height:100%; width:${probVal}%; border-radius:4px;"></div>
          </div>
          <span style="font-size:12px; font-weight:600; color:var(--color-ink); min-width:44px;">${probVal}%</span>
        </div>
      </td>
      <td><span style="font-size:0.8rem; color:var(--color-ink-soft);">${p.model_name || 'Ensemble'}</span></td>
    </tr>
  `;
}

async function runPrediction() {
  const btn = document.getElementById("run-prediction-btn");
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner spinner-sm" style="margin-right:6px;"></span> Training models…`;

  try {
    const result = await apiRequest("/ml/absenteeism/run", { method: "POST" });
    renderModelComparison(result);
    await loadPredictions();
    Toast.show(`AI model trained on ${result.trained_on_samples} employees. Optimal model: ${result.best_model}.`, "success");
  } catch (err) {
    Toast.show(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Prediction";
  }
}

function renderModelComparison(result) {
  const panel = document.getElementById("model-comparison");
  if (!panel || !result.model_comparison) return;
  panel.classList.remove("hidden");
  
  const cardsHtml = result.model_comparison.map(m => `
    <div class="card" style="flex:1; padding:16px; border-left:3px solid ${m.model_name === result.best_model ? 'var(--color-primary)' : 'var(--color-border)'};">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <h4 style="margin:0; font-size:0.9rem;">${m.model_name}</h4>
        ${m.model_name === result.best_model ? '<span class="chip chip-success" style="font-size:10px;">Selected Best</span>' : ''}
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
        <span style="color:var(--color-ink-soft);">Accuracy:</span>
        <strong style="color:var(--color-ink);">${m.accuracy}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px;">
        <span style="color:var(--color-ink-soft);">F1 Score:</span>
        <strong style="color:var(--color-ink);">${m.f1_score}</strong>
      </div>
    </div>
  `).join("");
  
  panel.innerHTML = cardsHtml;
}

async function loadAnomalies() {
  const tbody = document.getElementById("anomalies-body");
  if (!tbody) return;
  try {
    const anomalies = await apiRequest("/ml/anomaly/list?reviewed=false");
    if (!anomalies || anomalies.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No unreviewed anomalies detected. All attendance records are within normal variance.</td></tr>`;
      return;
    }
    tbody.innerHTML = anomalies.map((a) => `
      <tr id="anomaly-row-${a.id}">
        <td><div style="font-weight:600; color:var(--color-ink);">${a.employee_name || a.employee_id}</div></td>
        <td><span style="font-size:0.85rem; color:var(--color-ink-mid);">${a.date}</span></td>
        <td>
          <div style="font-weight:500;">${a.description}</div>
          <div style="margin-top:6px;">
            <button class="btn btn-secondary btn-sm" onclick="explainAnomaly(${a.id}, this)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M12 2a5 5 0 015 5c0 2-1 3-2 4.5S14 14 14 16h-4c0-2-.5-3-1.5-4.5S7 9 7 7a5 5 0 015-5z"/></svg>
              AI Explanation
            </button>
            <div id="explanation-${a.id}" class="hidden" style="margin-top:8px;"></div>
          </div>
        </td>
        <td><span class="chip chip-danger">${a.anomaly_score}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="reviewAnomaly(${a.id})">Mark Reviewed</button></td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="color:var(--color-danger);">${err.message}</td></tr>`;
  }
}

async function runAnomalyScan() {
  const btn = document.getElementById("run-anomaly-btn");
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner spinner-sm" style="margin-right:6px;"></span> Scanning…`;

  try {
    const result = await apiRequest("/ml/anomaly/run", { method: "POST" });
    await loadAnomalies();
    Toast.show(`Scan complete — detected ${result.anomalies_found} potential anomaly(ies).`, "success");
  } catch (err) {
    Toast.show(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Anomaly Scan";
  }
}

async function reviewAnomaly(id) {
  try {
    await apiRequest(`/ml/anomaly/${id}/review`, { method: "POST" });
    Toast.show("Anomaly marked as reviewed", "success");
    document.getElementById(`anomaly-row-${id}`)?.remove();
  } catch (err) {
    Toast.show(err.message, "error");
  }
}

async function explainAnomaly(id, btnElement) {
  const explanationDiv = document.getElementById(`explanation-${id}`);
  if (!explanationDiv) return;
  
  if (!explanationDiv.classList.contains("hidden")) {
    explanationDiv.classList.add("hidden");
    btnElement.textContent = "AI Explanation";
    return;
  }
  
  btnElement.disabled = true;
  btnElement.innerHTML = `<span class="spinner spinner-sm"></span> Loading...`;
  
  try {
    const data = await apiRequest(`/ml/anomaly/${id}/explanation`);
    explanationDiv.innerHTML = `
      <div class="ai-card" style="padding:14px; border-radius:var(--radius-sm); background:var(--color-surface-alt); border:1px solid var(--color-border); border-left:3px solid var(--color-primary);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="ai-badge">TrueShift AI</span>
            <span style="font-weight:700; font-size:0.8rem; color:var(--color-ink);">${data.anomaly_type || 'Pattern Deviation'}</span>
          </div>
          <span style="font-size:0.75rem; color:var(--color-ink-soft);">Score: <strong>${data.score}</strong></span>
        </div>
        <p style="font-size:0.85rem; line-height:1.5; color:var(--color-ink); margin:0 0 10px;">${data.explanation}</p>
        <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid var(--color-border); padding-top:8px;">
          <span style="font-size:0.72rem; color:var(--color-ink-muted);">Empirical Workforce Variance</span>
          <button class="btn btn-primary btn-sm" onclick="reviewAnomaly(${id})">Mark Reviewed</button>
        </div>
      </div>
    `;
    explanationDiv.classList.remove("hidden");
    btnElement.textContent = "Hide Explanation";
  } catch (err) {
    Toast.show(err.message, "error");
    btnElement.textContent = "AI Explanation";
  } finally {
    btnElement.disabled = false;
  }
}

async function loadFaceConfidence() {
  const tbody = document.getElementById("face-confidence-body");
  if (!tbody) return;
  try {
    const data = await apiRequest("/ml/face/confidence-tracking");
    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No biometric confidence data available yet.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = data.map(item => {
      const confVal = ((item.average_confidence || item.avg_confidence || 0) * 100).toFixed(1);
      const confNum = parseFloat(item.average_confidence || item.avg_confidence || 0);
      const confClass = confNum >= 0.8 ? 'chip-success' : (confNum >= 0.6 ? 'chip-warning' : 'chip-danger');
      return `
        <tr>
          <td><div style="font-weight:600; color:var(--color-ink);">${item.employee_name}</div></td>
          <td><span style="font-size:0.82rem; color:var(--color-ink-soft);">${item.employee_id}</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="flex:1; background:var(--color-surface-alt); height:8px; border-radius:4px; overflow:hidden; min-width:80px; border:1px solid var(--color-border);">
                <div style="background:var(--color-primary); height:100%; width:${confVal}%;"></div>
              </div>
              <span class="chip ${confClass}" style="font-size:11px;">${confVal}%</span>
            </div>
          </td>
          <td><span style="font-size:0.82rem; color:var(--color-ink-soft);">${item.check_count || item.checks || 0} checks</span></td>
          <td>${item.face_registered ? '<span class="chip chip-success">Registered</span>' : '<span class="chip chip-danger">Pending</span>'}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="color:var(--color-danger);">${err.message}</td></tr>`;
  }
}

async function loadLeaveClusters() {
  const container = document.getElementById("leave-clusters-body");
  if (!container) return;
  try {
    const data = await apiRequest("/ml/leave/clusters");
    if (!data || (Array.isArray(data) && data.length === 0)) {
      container.innerHTML = `<p class="field-hint">No leave clusters available yet.</p>`;
      return;
    }

    let clustersArray = [];
    if (Array.isArray(data)) {
      clustersArray = data;
    } else if (typeof data === 'object') {
      clustersArray = Object.entries(data).map(([k, v]) => ({
        cluster: k,
        count: Array.isArray(v) ? v.length : 0,
        examples: Array.isArray(v) ? v : []
      }));
    }
    
    let html = '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">';
    
    clustersArray.forEach((c) => {
      html += `
        <div style="background:var(--color-surface-alt); border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0; font-size:14px; color:var(--color-ink);">${c.cluster}</h4>
            <span class="chip chip-neutral" style="font-size:11px;">${c.count || 0} requests</span>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${(c.examples || []).map(r => `<span style="background:var(--color-surface); border:1px solid var(--color-border); color:var(--color-ink-soft); padding:3px 8px; border-radius:var(--radius-xs); font-size:11px;">${r}</span>`).join('')}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="field-hint" style="color:var(--color-danger);">${err.message}</p>`;
  }
}

async function loadShiftSwaps() {
  const tbody = document.getElementById("shift-swap-body");
  if (!tbody) return;
  try {
    const data = await apiRequest("/ml/shift-swap/recommendations");
    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="table-empty">No swap recommendations currently. All schedules are balanced.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = data.map(item => {
      const confVal = ((item.confidence || 0.8) * 100).toFixed(0);
      return `
        <tr>
          <td><div style="font-weight:600; color:var(--color-ink);">${item.employee_name || item.employee_a || ('Emp #' + item.employee_id)}</div></td>
          <td><span style="font-size:0.85rem; color:var(--color-warning); font-weight:600;">${item.absence_count || 'Frequent'} morning absences</span></td>
          <td><span style="font-size:0.85rem; color:var(--color-ink-mid);">${item.recommendation || item.shift_info || 'Shift rebalancing recommended'}</span></td>
          <td><span class="chip chip-neutral">${confVal}% Confidence</span></td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="table-empty" style="color:var(--color-danger);">${err.message}</td></tr>`;
  }
}
