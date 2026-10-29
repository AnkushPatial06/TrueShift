// Skeleton loader utilities
const Skeleton = {
  tableRows(tbody, cols = 5, rows = 5) {
    tbody.innerHTML = Array.from({length: rows}, () => `
      <tr>${Array.from({length: cols}, () => `<td><div class="skeleton skeleton-text" style="height:14px;"></div></td>`).join('')}</tr>
    `).join('');
  },
  cards(container, count = 4) {
    container.innerHTML = Array.from({length: count}, () => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-text wide"></div>
        <div class="skeleton skeleton-text medium"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    `).join('');
  },
  kpiCards(container, count = 4) {
    container.innerHTML = Array.from({length: count}, () => `
      <div class="kpi-card">
        <div class="kpi-header">
          <div class="skeleton" style="width:44px;height:44px;border-radius:12px;"></div>
          <div class="skeleton skeleton-text short"></div>
        </div>
        <div class="skeleton skeleton-text" style="height:36px;width:80px;"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    `).join('');
  },
  text(id, lines = 3) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = Array.from({length: lines}, (_, i) => `<div class="skeleton skeleton-text ${i===lines-1?'medium':'wide'}"></div>`).join('');
  }
};
