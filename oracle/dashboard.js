/**
 * The Oracle's Test Chamber - Dashboard JavaScript
 * Interactive visualization of project health across commits
 */

// GitHub repo URL for commit links
const GITHUB_REPO = 'https://github.com/davidbau/mazesofmenace';

// State
let allData = [];
let filteredData = [];
let currentView = 'categories';
let currentRange = 'all';
let selectedCommit = null;
let chart = null;
let gridTooltipEl = null;

// Chart colors - parchment-friendly palette
const COLORS = {
  pass: 'rgba(42, 107, 42, 0.9)',
  passFill: 'rgba(42, 107, 42, 0.25)',
  fail: 'rgba(139, 44, 44, 0.9)',
  failFill: 'rgba(139, 44, 44, 0.25)',
  rate: 'rgba(44, 74, 107, 0.9)',
  rateFill: 'rgba(44, 74, 107, 0.15)',
};

// Category display order: gameplay first (most interesting), chargen last (always passes)
const CAT_SORT = { gameplay: 0, special: 1, map: 2, interface: 3, other: 4, chargen: 99 };
function catSortOrder(name) { return CAT_SORT[name] ?? 50; }

const CAT_COLORS = {
  gameplay: 'rgba(139, 44, 44, 0.9)',
  unit: 'rgba(44, 74, 107, 0.9)',
  chargen: 'rgba(74, 122, 74, 0.9)',
  special: 'rgba(122, 90, 122, 0.9)',
  map: 'rgba(122, 122, 74, 0.9)',
  interface: 'rgba(44, 107, 107, 0.9)',
  option_test: 'rgba(107, 74, 44, 0.9)',
};

// Format date as MM/DD HH:MM (skip year, include time)
function fmtDate(d) {
  if (!d) return '–';
  // d is ISO string like "2026-02-18T23:41:32.905Z"
  const m = d.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return d;
  return `${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
}

// Helper: get pass/fail from either field naming convention
function getPass(d) {
  return d.stats?.passed ?? d.stats?.pass ?? 0;
}
function getFail(d) {
  return d.stats?.failed ?? d.stats?.fail ?? 0;
}
function getTotal(d) {
  return d.stats?.total ?? (getPass(d) + getFail(d));
}

// Color helpers for heatmap cells
function rngColor(matched, total) {
  if (total === 0) return 'rgba(180, 180, 180, 0.3)';
  const pct = matched / total;
  // red(0%) -> yellow(50%) -> green(100%)
  if (pct < 0.5) {
    const r = 180, g = Math.round(160 * pct * 2), b = 40;
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
  } else {
    const r = Math.round(180 * (1 - (pct - 0.5) * 2)), g = 160, b = 40;
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
  }
}

function screenColor(matched, total) {
  if (total === 0) return 'rgba(180, 180, 180, 0.3)';
  const pct = matched / total;
  if (pct < 0.5) {
    const r = 140, g = Math.round(120 * pct * 2), b = 160;
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
  } else {
    const r = Math.round(140 * (1 - (pct - 0.5) * 2)), g = 120 + Math.round(40 * (pct - 0.5) * 2), b = Math.round(160 * (1 - (pct - 0.5) * 2));
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
  }
}

function passFailColor(passed) {
  return passed ? 'rgba(42, 107, 42, 0.7)' : 'rgba(139, 44, 44, 0.7)';
}

function getCellColor(session, metric) {
  if (metric === 'rng') {
    // Fall back to screen metric if no RNG data (e.g. chargen sessions)
    if (session.rt > 0) return rngColor(session.rm, session.rt);
    if (session.st > 0) return screenColor(session.sm, session.st);
    return passFailColor(session.p);
  }
  if (metric === 'screen') {
    if (session.st > 0) return screenColor(session.sm, session.st);
    if (session.rt > 0) return rngColor(session.rm, session.rt);
    return passFailColor(session.p);
  }
  return passFailColor(session.p);
}

// Load data
async function loadData() {
  try {
    const response = await fetch('results.jsonl');
    const text = await response.text();

    const parsed = text.trim().split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.warn('Failed to parse line:', line);
          return null;
        }
      })
      .filter(d => d !== null)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Start after 68992c5a (Phase 2: injectable input runtime, 2026-02-16 03:05)
    const START_DATE = '2026-02-16T03:06';
    allData = parsed.filter(d => {
      if (!d.date || d.date < START_DATE || !d.categories) return false;
      const sum = Object.values(d.categories).reduce((s, c) => s + (c.total || 0), 0);
      return sum >= 10;
    });

    if (allData.length === 0) {
      showError('No data found in results.jsonl');
      return;
    }

    updateDisplay();
  } catch (e) {
    console.error('Error loading data:', e);
    showError('Failed to load test data. Run the backfill script first.');
  }
}

function showError(message) {
  document.querySelector('.chart-container').innerHTML =
    `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#d55;">${message}</div>`;
}

// Apply range filter
function applyRangeFilter() {
  if (currentRange === 'all') {
    filteredData = [...allData];
  } else {
    const n = parseInt(currentRange);
    filteredData = allData.slice(-n);
  }
}

// Update entire display
function updateDisplay() {
  applyRangeFilter();
  updateStats();
  updateChart();
  updateTable();
  updateCategoryBreakdown();
  if (currentView === 'sessions') {
    updateSessionGrid();
  }
}

// Update summary stats
function updateStats() {
  const latest = filteredData[filteredData.length - 1];
  if (!latest) return;

  document.querySelector('#stat-commits .stat-value').textContent = filteredData.length.toLocaleString();
  document.querySelector('#stat-pass .stat-value').textContent = getPass(latest).toLocaleString();
  document.querySelector('#stat-fail .stat-value').textContent = getFail(latest).toLocaleString();

  const total = getTotal(latest);
  const pass = getPass(latest);
  const rate = total > 0 ? Math.round(pass / total * 100) : 0;
  document.querySelector('#stat-rate .stat-value').textContent = rate + '%';

  // RNG match rate from latest commit with metrics
  const m = latest.metrics;
  if (m && m.rng && m.rng.total > 0) {
    const rngRate = Math.round(m.rng.matched / m.rng.total * 100);
    document.querySelector('#stat-rng .stat-value').textContent = rngRate + '%';
  } else {
    document.querySelector('#stat-rng .stat-value').textContent = '–';
  }
}

// Update main chart
function updateChart() {
  const chartSection = document.querySelector('.chart-section');

  // Hide chart for sessions view
  if (currentView === 'sessions') {
    chartSection.style.display = 'none';
    return;
  }
  chartSection.style.display = 'block';

  const ctx = document.getElementById('timeline-chart').getContext('2d');

  if (chart) {
    chart.destroy();
  }

  const labels = filteredData.map(d => d.commit);
  const datasets = [];
  const scales = {};

  if (currentView === 'tests') {
    const showPass = document.getElementById('show-pass').checked;
    const showFail = document.getElementById('show-fail').checked;
    const showRate = document.getElementById('show-rate').checked;

    scales.y = {
      type: 'linear',
      position: 'left',
      ticks: { color: '#6b5b4b', font: { size: 10 } },
      grid: { color: 'rgba(196, 168, 130, 0.2)' },
    };

    if (showPass) {
      datasets.push({
        label: 'Pass',
        data: filteredData.map(d => getPass(d)),
        backgroundColor: COLORS.passFill,
        borderColor: COLORS.pass,
        borderWidth: 1,
        fill: true,
        tension: 0.1,
        pointRadius: 2,
        yAxisID: 'y',
      });
    }
    if (showFail) {
      datasets.push({
        label: 'Fail',
        data: filteredData.map(d => getFail(d)),
        backgroundColor: COLORS.failFill,
        borderColor: COLORS.fail,
        borderWidth: 1,
        fill: true,
        tension: 0.1,
        pointRadius: 2,
        yAxisID: 'y',
      });
    }
    if (showRate) {
      scales.yRate = {
        type: 'linear',
        position: 'right',
        min: 0,
        max: 100,
        ticks: { color: COLORS.rate, font: { size: 10 } },
        grid: { display: false },
      };
      datasets.push({
        label: 'Pass Rate %',
        data: filteredData.map(d => {
          const total = getTotal(d);
          const pass = getPass(d);
          return total > 0 ? Math.round(pass / total * 100) : 0;
        }),
        borderColor: COLORS.rate,
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 2,
        yAxisID: 'yRate',
      });
    }

  } else if (currentView === 'categories') {
    const allCats = {};
    filteredData.forEach(d => {
      if (d.categories) Object.keys(d.categories).forEach(k => allCats[k] = true);
    });
    const categories = Object.keys(allCats).sort((a, b) => catSortOrder(a) - catSortOrder(b));

    scales.y = {
      title: { display: true, text: 'Failing Tests', color: '#6b5b4b' },
      ticks: { color: '#6b5b4b', font: { size: 10 } },
      grid: { color: 'rgba(196, 168, 130, 0.2)' },
      stacked: true,
    };

    categories.forEach(cat => {
      datasets.push({
        label: cat,
        data: filteredData.map(d => d.categories?.[cat]?.fail ?? 0),
        borderColor: CAT_COLORS[cat] || COLORS.fail,
        backgroundColor: (CAT_COLORS[cat] || COLORS.fail).replace('0.9', '0.3'),
        borderWidth: 1,
        fill: true,
        tension: 0.3,
        pointRadius: 1,
        spanGaps: true,
      });
    });

  } else if (currentView === 'metrics') {
    const showRng = document.getElementById('show-rng').checked;
    const showScreens = document.getElementById('show-screens').checked;
    const showGrids = document.getElementById('show-grids').checked;

    scales.y = {
      type: 'linear',
      position: 'left',
      title: { display: true, text: 'Match Rate %', color: '#6b5b4b' },
      min: 0,
      max: 100,
      ticks: { color: '#6b5b4b', font: { size: 10 } },
      grid: { color: 'rgba(196, 168, 130, 0.2)' },
    };

    if (showRng) {
      datasets.push({
        label: 'RNG Calls',
        data: filteredData.map(d => {
          const m = d.metrics?.rng;
          return m && m.total > 0 ? +(m.matched / m.total * 100).toFixed(1) : null;
        }),
        borderColor: 'rgba(44, 74, 107, 0.9)',
        backgroundColor: 'rgba(44, 74, 107, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        spanGaps: true,
      });
    }
    if (showScreens) {
      datasets.push({
        label: 'Screen Match',
        data: filteredData.map(d => {
          const m = d.metrics?.screens;
          return m && m.total > 0 ? +(m.matched / m.total * 100).toFixed(1) : null;
        }),
        borderColor: 'rgba(74, 122, 74, 0.9)',
        backgroundColor: 'rgba(74, 122, 74, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        spanGaps: true,
      });
    }
    if (showGrids) {
      datasets.push({
        label: 'Grid Match',
        data: filteredData.map(d => {
          const m = d.metrics?.grids;
          return m && m.total > 0 ? +(m.matched / m.total * 100).toFixed(1) : null;
        }),
        borderColor: 'rgba(122, 90, 122, 0.9)',
        backgroundColor: 'rgba(122, 90, 122, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        spanGaps: true,
      });
    }
  }

  // Common x-axis
  scales.x = {
    ticks: {
      color: '#6b5b4b',
      maxRotation: 0,
      autoSkip: true,
      maxTicksLimit: 20,
      font: { size: 10, family: "'Source Code Pro', monospace" },
    },
    grid: { color: 'rgba(196, 168, 130, 0.2)' },
  };

  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#888',
            font: { size: 10 },
            boxWidth: 12,
            padding: 8,
          },
        },
        tooltip: {
          enabled: false,
        },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            wheel: { enabled: true },
            drag: { enabled: true, backgroundColor: 'rgba(107, 136, 136, 0.2)' },
            mode: 'x',
          },
        },
      },
      scales,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          selectCommit(filteredData[idx]);
        }
      },
    },
  });
}

// Select a commit and show details
function selectCommit(commit) {
  selectedCommit = commit;
  showDetailPanel(commit);
  highlightTableRow(commit.commit);
}

// Show detail panel
function showDetailPanel(d) {
  const panel = document.getElementById('detail-panel');
  const content = document.getElementById('detail-content');
  const title = document.getElementById('detail-title');

  title.innerHTML = `<a href="${GITHUB_REPO}/commit/${d.commit}" target="_blank" style="color: inherit; text-decoration: underline;">${d.commit}</a> - ${d.message?.slice(0, 80) || 'No message'}`;

  let html = '';

  // Commit info
  html += `<div class="detail-group">
    <h3>Commit Info</h3>
    <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${fmtDate(d.date)}</span></div>
    <div class="detail-row"><span class="detail-label">Author</span><span class="detail-value">${d.author || 'unknown'}</span></div>
    <div class="detail-row"><span class="detail-label">Sessions</span><span class="detail-value">${d.sessions || '–'}</span></div>
    <div class="detail-row"><span class="detail-label">GitHub</span><span class="detail-value"><a href="${GITHUB_REPO}/commit/${d.commit}" target="_blank" style="color:#6b8;">View on GitHub</a></span></div>
  </div>`;

  // Test stats
  html += `<div class="detail-group">
    <h3>Test Results</h3>
    <div class="detail-row"><span class="detail-label">Total</span><span class="detail-value">${getTotal(d).toLocaleString()}</span></div>
    <div class="detail-row"><span class="detail-label">Pass</span><span class="detail-value" style="color:#5a5;">${getPass(d).toLocaleString()}</span></div>
    <div class="detail-row"><span class="detail-label">Fail</span><span class="detail-value" style="color:#d55;">${getFail(d).toLocaleString()}</span></div>
  </div>`;

  // Metrics
  const m = d.metrics;
  if (m && (m.rng?.total > 0 || m.screens?.total > 0 || m.grids?.total > 0)) {
    html += `<div class="detail-group">
      <h3>Parity Metrics</h3>`;
    if (m.rng?.total > 0) {
      const pct = (m.rng.matched / m.rng.total * 100).toFixed(1);
      html += `<div class="detail-row"><span class="detail-label">RNG Calls</span><span class="detail-value">${m.rng.matched.toLocaleString()} / ${m.rng.total.toLocaleString()} (${pct}%)</span></div>`;
    }
    if (m.screens?.total > 0) {
      const pct = (m.screens.matched / m.screens.total * 100).toFixed(1);
      html += `<div class="detail-row"><span class="detail-label">Screens</span><span class="detail-value">${m.screens.matched.toLocaleString()} / ${m.screens.total.toLocaleString()} (${pct}%)</span></div>`;
    }
    if (m.grids?.total > 0) {
      const pct = (m.grids.matched / m.grids.total * 100).toFixed(1);
      html += `<div class="detail-row"><span class="detail-label">Grids</span><span class="detail-value">${m.grids.matched.toLocaleString()} / ${m.grids.total.toLocaleString()} (${pct}%)</span></div>`;
    }
    html += `</div>`;
  }

  // Categories
  if (d.categories && Object.keys(d.categories).length > 0) {
    html += `<div class="detail-group">
      <h3>Categories</h3>`;
    for (const [cat, stats] of Object.entries(d.categories)) {
      const pct = stats.total > 0 ? Math.round(stats.pass / stats.total * 100) : 0;
      html += `<div class="detail-row">
        <span class="detail-label">${cat}</span>
        <span class="detail-value"><span style="color:#5a5;">${stats.pass}</span> / ${stats.total} (${pct}%)</span>
      </div>`;
    }
    html += `</div>`;
  }

  // Per-session breakdown
  if (d.session_detail && d.session_detail.length > 0) {
    // Group by type
    const byType = {};
    for (const s of d.session_detail) {
      if (!byType[s.t]) byType[s.t] = [];
      byType[s.t].push(s);
    }

    html += `<div class="detail-group" style="grid-column: 1 / -1;">
      <h3>Sessions</h3>
      <div class="session-list">`;

    for (const [type, sessions] of Object.entries(byType).sort((a, b) => catSortOrder(a[0]) - catSortOrder(b[0]))) {
      const passCount = sessions.filter(s => s.p).length;
      const totalCount = sessions.length;
      const expanded = sessions.some(s => !s.p); // expand groups with failures

      html += `<div class="session-group">
        <div class="session-group-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span class="group-name">${type}</span>
          <span class="group-stats"><span style="color:var(--pass)">${passCount}</span>/${totalCount}</span>
          <span class="group-expand">&#9660;</span>
        </div>
        <div class="session-group-details"${expanded ? '' : ' style="display:none"'}>
          <div class="session-items">`;

      for (const s of sessions.sort((a, b) => a.s.localeCompare(b.s))) {
        const name = s.s.replace('.session.json', '');
        const cls = s.p ? 'pass' : 'fail';
        const icon = s.p ? '\u2713' : '\u2717';
        let metricText = '';
        if (s.rt > 0) metricText = `RNG ${Math.round(s.rm / s.rt * 100)}%`;
        else if (s.st > 0) metricText = `Scr ${Math.round(s.sm / s.st * 100)}%`;
        else if (s.gt > 0) metricText = `Grid ${Math.round(s.gm / s.gt * 100)}%`;

        html += `<div class="session-item ${cls}">
          <span class="session-status">${icon}</span>
          <span class="session-name" title="${s.s}">${name}</span>
          <span class="session-coverage">${metricText}</span>
        </div>`;
      }

      html += `</div></div></div>`;
    }

    html += `</div></div>`;
  }

  content.innerHTML = html;
  panel.style.display = 'block';

  // Wire up collapse toggles
  content.querySelectorAll('.session-group-header').forEach(header => {
    header.addEventListener('click', () => {
      const details = header.nextElementSibling;
      if (details) {
        details.style.display = details.style.display === 'none' ? '' : 'none';
      }
    });
  });
}

// Highlight table row
function highlightTableRow(commit) {
  document.querySelectorAll('#commit-tbody tr').forEach(tr => {
    tr.classList.remove('selected');
    if (tr.dataset.commit === commit) {
      tr.classList.add('selected');
      tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

// Update commit table
function updateTable() {
  const tbody = document.getElementById('commit-tbody');
  let html = '';

  const reversed = [...filteredData].reverse();

  reversed.forEach((d, i) => {
    const prev = reversed[i + 1];
    const delta = prev ? getPass(d) - getPass(prev) : 0;
    const isRegression = delta < 0;
    const isImprovement = delta > 5;

    const rowClass = isRegression ? 'regression' : (isImprovement ? 'improvement' : '');
    const deltaClass = delta > 0 ? 'delta-positive' : (delta < 0 ? 'delta-negative' : 'delta-neutral');
    const deltaText = delta > 0 ? `+${delta}` : (delta === 0 ? '–' : delta);

    // RNG match rate
    const m = d.metrics?.rng;
    const rngText = m && m.total > 0 ? Math.round(m.matched / m.total * 100) + '%' : '–';

    html += `<tr class="${rowClass}" data-commit="${d.commit}" onclick="selectCommit(filteredData[${filteredData.length - 1 - i}])">
      <td><a class="commit-hash" href="${GITHUB_REPO}/commit/${d.commit}" target="_blank" onclick="event.stopPropagation();">${d.commit}</a></td>
      <td>${fmtDate(d.date)}</td>
      <td class="message-text" title="${d.message || ''}">${d.message?.slice(0, 50) || ''}</td>
      <td style="color:#5a5;">${getPass(d)}</td>
      <td style="color:#d55;">${getFail(d)}</td>
      <td class="${deltaClass}">${deltaText}</td>
      <td>${rngText}</td>
      <td>${d.sessions || '–'}</td>
    </tr>`;
  });

  tbody.innerHTML = html;
}

// Update category breakdown
function updateCategoryBreakdown() {
  const latest = filteredData[filteredData.length - 1];
  const grid = document.getElementById('category-grid');

  if (!latest?.categories) {
    grid.innerHTML = '<div style="color:#777;font-style:italic;">No category data available</div>';
    return;
  }

  let html = '';
  for (const [cat, stats] of Object.entries(latest.categories).sort((a, b) => catSortOrder(a[0]) - catSortOrder(b[0]))) {
    const pct = stats.total > 0 ? Math.round(stats.pass / stats.total * 100) : 0;
    html += `<div class="category-card" data-category="${cat}">
      <span class="category-name">${cat}</span>
      <div class="category-bar"><div class="category-bar-fill" style="width:${pct}%;"></div></div>
      <div class="category-stats">
        <span class="pass">${stats.pass}</span>
        <span>${pct}%</span>
        <span class="fail">${stats.fail}</span>
      </div>
    </div>`;
  }

  grid.innerHTML = html;
}

// ===== Session Grid =====

function updateSessionGrid() {
  const wrapper = document.getElementById('session-grid-wrapper');
  if (!wrapper) return;

  const showPass = document.getElementById('grid-show-pass').checked;
  const showFail = document.getElementById('grid-show-fail').checked;
  const colorMetric = document.getElementById('grid-color-metric').value;

  // Only use commits that have session_detail
  const commitsWithSessions = filteredData.filter(d => d.session_detail && d.session_detail.length > 0);

  if (commitsWithSessions.length === 0) {
    wrapper.innerHTML = '<div style="padding:1rem;color:#777;font-style:italic;">No per-session data available for the selected range. Session details are only available for commits tested with the full session runner.</div>';
    return;
  }

  // Build the union of all session names, grouped by type
  const sessionMap = new Map(); // session name -> { type, latestPassed }
  for (const d of commitsWithSessions) {
    for (const s of d.session_detail) {
      if (!sessionMap.has(s.s)) {
        sessionMap.set(s.s, { type: s.t, latestPassed: s.p });
      } else {
        sessionMap.get(s.s).latestPassed = s.p;
      }
    }
  }

  // Filter sessions by pass/fail checkbox (based on latest known state)
  let sessionNames = [...sessionMap.entries()]
    .filter(([_, info]) => {
      if (info.latestPassed && !showPass) return false;
      if (!info.latestPassed && !showFail) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by category priority, then by name
      const orderCmp = catSortOrder(a[1].type) - catSortOrder(b[1].type);
      if (orderCmp !== 0) return orderCmp;
      return a[0].localeCompare(b[0]);
    });

  if (sessionNames.length === 0) {
    wrapper.innerHTML = '<div style="padding:1rem;color:#777;font-style:italic;">No sessions match the current filter.</div>';
    return;
  }

  // Build lookup: commit -> session name -> session data
  const commitSessionLookup = new Map();
  for (const d of commitsWithSessions) {
    const map = new Map();
    for (const s of d.session_detail) {
      map.set(s.s, s);
    }
    commitSessionLookup.set(d.commit, map);
  }

  // Group sessions by type for incremental rendering
  const typeGroups = [];
  let currentType = null;
  let currentGroup = null;
  for (const [sessionName, info] of sessionNames) {
    if (info.type !== currentType) {
      currentType = info.type;
      currentGroup = { type: info.type, sessions: [] };
      typeGroups.push(currentGroup);
    }
    currentGroup.sessions.push([sessionName, info]);
  }

  // Build table shell with header immediately
  const table = document.createElement('table');
  table.className = 'session-grid-table';

  const thead = document.createElement('thead');
  let headerHtml = '<tr><th class="corner"></th>';
  for (const d of commitsWithSessions) {
    headerHtml += `<th class="commit-col" data-commit="${d.commit}" title="${d.commit} - ${fmtDate(d.date)}\n${d.message?.slice(0, 60) || ''}">${d.commit.slice(0, 6)}</th>`;
  }
  headerHtml += '</tr>';
  thead.innerHTML = headerHtml;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  wrapper.innerHTML = '';
  wrapper.appendChild(table);

  // Render one type group per animation frame for responsiveness
  let groupIdx = 0;
  function renderNextGroup() {
    if (groupIdx >= typeGroups.length) {
      // All groups rendered, set up interactions
      setupGridInteractions(wrapper, commitsWithSessions, commitSessionLookup);
      return;
    }

    const group = typeGroups[groupIdx++];
    const fragment = document.createDocumentFragment();

    // Type separator row
    const sepRow = document.createElement('tr');
    const sepTh = document.createElement('th');
    sepTh.className = 'type-separator';
    sepTh.colSpan = commitsWithSessions.length + 1;
    sepTh.textContent = group.type;
    sepRow.appendChild(sepTh);
    fragment.appendChild(sepRow);

    // Session rows
    for (const [sessionName] of group.sessions) {
      const shortName = sessionName.replace('.session.json', '');
      const row = document.createElement('tr');
      row.dataset.session = sessionName;

      let rowHtml = `<th class="row-header" title="${sessionName}">${shortName}</th>`;
      for (const d of commitsWithSessions) {
        const sessionData = commitSessionLookup.get(d.commit)?.get(sessionName);
        if (!sessionData) {
          rowHtml += '<td class="no-data"></td>';
        } else {
          const color = getCellColor(sessionData, colorMetric);
          rowHtml += `<td data-commit="${d.commit}" data-session="${sessionName}" style="background:${color}"><span class="grid-cell"></span></td>`;
        }
      }
      row.innerHTML = rowHtml;
      fragment.appendChild(row);
    }

    tbody.appendChild(fragment);
    requestAnimationFrame(renderNextGroup);
  }

  requestAnimationFrame(renderNextGroup);
}

function setupGridInteractions(wrapper, commitsWithSessions, commitSessionLookup) {
  // Create tooltip element
  if (!gridTooltipEl) {
    gridTooltipEl = document.createElement('div');
    gridTooltipEl.className = 'grid-tooltip';
    gridTooltipEl.style.display = 'none';
    document.body.appendChild(gridTooltipEl);
  }

  // Cell hover -> tooltip
  wrapper.addEventListener('mouseover', (e) => {
    const td = e.target.closest('td[data-session]');
    if (!td) {
      gridTooltipEl.style.display = 'none';
      return;
    }

    const sessionName = td.dataset.session;
    const commitHash = td.dataset.commit;
    const sessionData = commitSessionLookup.get(commitHash)?.get(sessionName);
    const commitData = commitsWithSessions.find(d => d.commit === commitHash);

    if (!sessionData || !commitData) {
      gridTooltipEl.style.display = 'none';
      return;
    }

    const shortName = sessionName.replace('.session.json', '');
    const passText = sessionData.p
      ? '<span class="tt-pass">\u2713 PASS</span>'
      : '<span class="tt-fail">\u2717 FAIL</span>';

    let metricLines = '';
    if (sessionData.rt > 0) {
      const pct = (sessionData.rm / sessionData.rt * 100).toFixed(1);
      metricLines += `<div class="tt-metric">RNG: ${sessionData.rm.toLocaleString()}/${sessionData.rt.toLocaleString()} (${pct}%)</div>`;
    }
    if (sessionData.st > 0) {
      const pct = (sessionData.sm / sessionData.st * 100).toFixed(1);
      metricLines += `<div class="tt-metric">Screens: ${sessionData.sm}/${sessionData.st} (${pct}%)</div>`;
    }
    if (sessionData.gt > 0) {
      const pct = (sessionData.gm / sessionData.gt * 100).toFixed(1);
      metricLines += `<div class="tt-metric">Grids: ${sessionData.gm}/${sessionData.gt} (${pct}%)</div>`;
    }

    gridTooltipEl.innerHTML = `
      <div class="tt-session">${shortName}</div>
      <div class="tt-commit">${commitData.commit} - ${fmtDate(commitData.date)}</div>
      <div>${passText}</div>
      ${metricLines}
    `;
    gridTooltipEl.style.display = 'block';

    // Position near mouse
    const rect = td.getBoundingClientRect();
    gridTooltipEl.style.left = (rect.right + 8) + 'px';
    gridTooltipEl.style.top = (rect.top - 10) + 'px';

    // Keep tooltip on screen
    const ttRect = gridTooltipEl.getBoundingClientRect();
    if (ttRect.right > window.innerWidth - 10) {
      gridTooltipEl.style.left = (rect.left - ttRect.width - 8) + 'px';
    }
    if (ttRect.bottom > window.innerHeight - 10) {
      gridTooltipEl.style.top = (window.innerHeight - ttRect.height - 10) + 'px';
    }
  });

  wrapper.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget || !wrapper.contains(e.relatedTarget)) {
      gridTooltipEl.style.display = 'none';
    }
  });

  // Cell click -> select commit
  wrapper.addEventListener('click', (e) => {
    const td = e.target.closest('td[data-session]');
    if (td) {
      const commitHash = td.dataset.commit;
      const commitData = commitsWithSessions.find(d => d.commit === commitHash);
      if (commitData) selectCommit(commitData);
      return;
    }

    // Column header click -> select commit
    const th = e.target.closest('th.commit-col');
    if (th) {
      const commitHash = th.dataset.commit;
      const commitData = commitsWithSessions.find(d => d.commit === commitHash);
      if (commitData) selectCommit(commitData);
      return;
    }
  });

  // Row hover highlight
  wrapper.addEventListener('mouseover', (e) => {
    const row = e.target.closest('tr[data-session]');
    wrapper.querySelectorAll('tr.highlighted').forEach(r => r.classList.remove('highlighted'));
    wrapper.querySelectorAll('th.commit-col.highlighted').forEach(r => r.classList.remove('highlighted'));
    if (row) row.classList.add('highlighted');

    const td = e.target.closest('td[data-commit]');
    if (td) {
      const commitHash = td.dataset.commit;
      wrapper.querySelectorAll(`th.commit-col[data-commit="${commitHash}"]`).forEach(h => h.classList.add('highlighted'));
    }
  });
}

// ===== Event listeners =====

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;

    // Show/hide breakdown sections
    document.getElementById('category-breakdown').style.display =
      currentView === 'categories' ? 'block' : 'none';
    document.getElementById('session-grid-section').style.display =
      currentView === 'sessions' ? 'block' : 'none';

    // Show/hide appropriate controls
    document.getElementById('test-controls').style.display =
      currentView === 'tests' ? 'flex' : 'none';
    document.getElementById('metrics-controls').style.display =
      currentView === 'metrics' ? 'flex' : 'none';

    updateChart();
    if (currentView === 'sessions') {
      updateSessionGrid();
    }
  });
});

document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRange = btn.dataset.range;
    updateDisplay();
  });
});

// Test view controls
document.querySelectorAll('#show-pass, #show-fail, #show-rate').forEach(cb => {
  cb.addEventListener('change', updateChart);
});

// Metrics view controls
document.querySelectorAll('#show-rng, #show-screens, #show-grids').forEach(cb => {
  cb.addEventListener('change', updateChart);
});

// Session grid controls
document.querySelectorAll('#grid-show-pass, #grid-show-fail, #grid-color-metric').forEach(el => {
  el.addEventListener('change', () => {
    if (currentView === 'sessions') updateSessionGrid();
  });
});

document.getElementById('zoom-reset').addEventListener('click', () => {
  if (chart) {
    chart.resetZoom();
  }
});

document.getElementById('detail-close').addEventListener('click', () => {
  document.getElementById('detail-panel').style.display = 'none';
  document.querySelectorAll('#commit-tbody tr').forEach(tr => {
    tr.classList.remove('selected');
  });
  selectedCommit = null;
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('detail-panel').style.display = 'none';
    if (gridTooltipEl) gridTooltipEl.style.display = 'none';
  }
});

// Initialize
loadData();
