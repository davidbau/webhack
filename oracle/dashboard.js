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

// Chart colors - parchment-friendly palette
const COLORS = {
  pass: 'rgba(42, 107, 42, 0.9)',
  passFill: 'rgba(42, 107, 42, 0.25)',
  fail: 'rgba(139, 44, 44, 0.9)',
  failFill: 'rgba(139, 44, 44, 0.25)',
  rate: 'rgba(44, 74, 107, 0.9)',
  rateFill: 'rgba(44, 74, 107, 0.15)',
};

const CAT_COLORS = {
  gameplay: 'rgba(139, 44, 44, 0.9)',
  unit: 'rgba(44, 74, 107, 0.9)',
  chargen: 'rgba(74, 122, 74, 0.9)',
  special: 'rgba(122, 90, 122, 0.9)',
  map: 'rgba(122, 122, 74, 0.9)',
  interface: 'rgba(44, 107, 107, 0.9)',
  option_test: 'rgba(107, 74, 44, 0.9)',
};

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
    const categories = Object.keys(allCats).sort();

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
          backgroundColor: '#222',
          titleColor: '#eee',
          bodyColor: '#ccc',
          borderColor: '#444',
          borderWidth: 1,
          callbacks: {
            title: (items) => {
              if (items.length > 0) {
                const idx = items[0].dataIndex;
                const d = filteredData[idx];
                return `${d.commit} - ${d.date?.slice(0, 10) || 'unknown'}`;
              }
              return '';
            },
            afterTitle: (items) => {
              if (items.length > 0) {
                const idx = items[0].dataIndex;
                const d = filteredData[idx];
                return d.message?.slice(0, 60) || '';
              }
              return '';
            },
            label: (context) => {
              const value = context.parsed.y;
              if (value === null || value === undefined) return null;
              if (currentView === 'metrics') {
                return `${context.dataset.label}: ${value}%`;
              }
              return `${context.dataset.label}: ${value.toLocaleString()}`;
            },
            afterBody: (items) => {
              if (currentView === 'metrics' && items.length > 0) {
                const idx = items[0].dataIndex;
                const d = filteredData[idx];
                const m = d.metrics;
                if (!m) return '';
                const lines = [];
                if (m.rng?.total > 0) lines.push(`  RNG: ${m.rng.matched.toLocaleString()}/${m.rng.total.toLocaleString()}`);
                if (m.screens?.total > 0) lines.push(`  Screens: ${m.screens.matched.toLocaleString()}/${m.screens.total.toLocaleString()}`);
                if (m.grids?.total > 0) lines.push(`  Grids: ${m.grids.matched.toLocaleString()}/${m.grids.total.toLocaleString()}`);
                return lines.join('\n');
              }
              return '';
            },
          },
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
    <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${d.date?.slice(0, 19) || 'unknown'}</span></div>
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

  content.innerHTML = html;
  panel.style.display = 'block';
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
      <td>${d.date?.slice(0, 10) || ''}</td>
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
  for (const [cat, stats] of Object.entries(latest.categories)) {
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

// Event listeners
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;

    // Show/hide breakdown sections
    document.getElementById('category-breakdown').style.display =
      currentView === 'categories' ? 'block' : 'none';

    // Show/hide appropriate controls
    document.getElementById('test-controls').style.display =
      currentView === 'tests' ? 'flex' : 'none';
    document.getElementById('metrics-controls').style.display =
      currentView === 'metrics' ? 'flex' : 'none';

    updateChart();
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
  }
});

// Initialize
loadData();
