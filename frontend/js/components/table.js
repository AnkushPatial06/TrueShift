class DataTable {
  constructor({ containerId, columns, data = [], pageSize = 15, filters = [] }) {
    this.containerId = containerId;
    this.columns = columns; // [{key, label, render?, sortable?}]
    this.allData = data;
    this.filteredData = data;
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.sortKey = null;
    this.sortDir = 'asc';
    this.searchQuery = '';
    this.activeFilters = {};
    this.filterDefs = filters; // [{key, label, options:[{label,value}]}]
    this.render();
  }

  setData(data) {
    this.allData = data;
    this.currentPage = 1;
    this.applyFilters();
    this.renderBody();
    this.renderPagination();
  }

  applyFilters() {
    let data = [...this.allData];
    // Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(row => this.columns.some(col => {
        const val = String(row[col.key] ?? '');
        return val.toLowerCase().includes(q);
      }));
    }
    // Dropdown filters
    Object.entries(this.activeFilters).forEach(([key, val]) => {
      if (val) data = data.filter(row => String(row[key]) === String(val));
    });
    // Sort
    if (this.sortKey) {
      data.sort((a, b) => {
        const av = a[this.sortKey] ?? '';
        const bv = b[this.sortKey] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, {numeric:true});
        return this.sortDir === 'asc' ? cmp : -cmp;
      });
    }
    this.filteredData = data;
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.innerHTML = `
      <div class="datatable-toolbar">
        <div class="datatable-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <input type="search" placeholder="Search..." class="dt-search" />
        </div>
        <div class="datatable-filters">
          ${this.filterDefs.map(f => `
            <select class="datatable-filter-select" data-filter-key="${f.key}">
              <option value="">${f.label}</option>
              ${f.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
            </select>
          `).join('')}
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>${this.columns.map(col => `
            <th class="${col.sortable !== false ? 'th-sortable' : ''}" data-sort-key="${col.key}">
              ${col.label}
              ${col.sortable !== false ? '<span class="sort-icon"></span>' : ''}
            </th>
          `).join('')}</tr></thead>
          <tbody class="dt-body"></tbody>
        </table>
      </div>
      <div class="datatable-pagination">
        <span class="datatable-page-info dt-info"></span>
        <div class="datatable-page-btns dt-pages"></div>
      </div>
    `;
    this.bindEvents(container);
    this.applyFilters();
    this.renderBody();
    this.renderPagination();
  }

  bindEvents(container) {
    container.querySelector('.dt-search').addEventListener('input', e => {
      this.searchQuery = e.target.value;
      this.currentPage = 1;
      this.applyFilters();
      this.renderBody();
      this.renderPagination();
    });
    container.querySelectorAll('.th-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sortKey;
        if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        else { this.sortKey = key; this.sortDir = 'asc'; }
        container.querySelectorAll('.sort-icon').forEach(s => { s.className='sort-icon'; });
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.className = `sort-icon ${this.sortDir}`;
        this.applyFilters();
        this.renderBody();
      });
    });
    container.querySelectorAll('.datatable-filter-select').forEach(sel => {
      sel.addEventListener('change', () => {
        this.activeFilters[sel.dataset.filterKey] = sel.value;
        this.currentPage = 1;
        this.applyFilters();
        this.renderBody();
        this.renderPagination();
      });
    });
  }

  renderBody() {
    const tbody = document.querySelector(`#${this.containerId} .dt-body`);
    if (!tbody) return;
    const start = (this.currentPage - 1) * this.pageSize;
    const page = this.filteredData.slice(start, start + this.pageSize);
    if (page.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${this.columns.length}"><div class="empty-state"><div class="empty-state-title">No results found</div><div class="empty-state-body">Try adjusting your search or filters.</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = page.map(row => `<tr>${this.columns.map(col => `<td>${col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}</td>`).join('')}</tr>`).join('');
  }

  renderPagination() {
    const total = this.filteredData.length;
    const totalPages = Math.ceil(total / this.pageSize);
    const start = Math.min((this.currentPage - 1) * this.pageSize + 1, total);
    const end = Math.min(this.currentPage * this.pageSize, total);
    const infoEl = document.querySelector(`#${this.containerId} .dt-info`);
    const pagesEl = document.querySelector(`#${this.containerId} .dt-pages`);
    if (infoEl) infoEl.textContent = total ? `Showing ${start}–${end} of ${total}` : 'No results';
    if (pagesEl) {
      const pages = [];
      if (this.currentPage > 1) pages.push(`<button class="datatable-page-btn" data-page="${this.currentPage-1}">‹</button>`);
      for (let p = Math.max(1, this.currentPage-2); p <= Math.min(totalPages, this.currentPage+2); p++) {
        pages.push(`<button class="datatable-page-btn ${p===this.currentPage?'active':''}" data-page="${p}">${p}</button>`);
      }
      if (this.currentPage < totalPages) pages.push(`<button class="datatable-page-btn" data-page="${this.currentPage+1}">›</button>`);
      pagesEl.innerHTML = pages.join('');
      pagesEl.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => { this.currentPage = Number(btn.dataset.page); this.renderBody(); this.renderPagination(); });
      });
    }
  }
}
