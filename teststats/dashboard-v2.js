/**
 * The Oracle's Test Chamber - Dashboard JavaScript
 * Interactive visualization of project health across commits
 */

// GitHub repo URL for commit links
const GITHUB_REPO = 'https://github.com/davidbau/mazesofmenace';

// State
let allData = [];
let filteredData = [];
let currentView = 'sessions';
let currentRange = 'all';
let selectedCommit = null;
let chart = null;

// Chart colors - parchment-friendly palette
const COLORS = {
  pass: 'rgba(42, 107, 42, 0.9)',      // Deep forest green
  passFill: 'rgba(42, 107, 42, 0.25)',
  fail: 'rgba(139, 44, 44, 0.9)',      // Deep burgundy
  failFill: 'rgba(139, 44, 44, 0.25)',
  rate: 'rgba(44, 74, 107, 0.9)',      // Deep navy
  rateFill: 'rgba(44, 74, 107, 0.15)',
  chargen: 'rgba(74, 122, 74, 0.85)',  // Sage green
  special: 'rgba(90, 90, 138, 0.85)',  // Muted purple
  gameplay: 'rgba(138, 90, 74, 0.85)', // Warm brown
  map: 'rgba(74, 122, 138, 0.85)',     // Teal
  unit: 'rgba(122, 90, 122, 0.85)',    // Dusty rose
  options: 'rgba(122, 122, 74, 0.85)', // Olive
  lines: 'rgba(42, 107, 42, 0.7)',     // Green for added lines
  files: 'rgba(139, 44, 44, 0.7)',     // Red for removed lines
};

// Load data
async function loadData() {
  try {
    // Try loading from JSONL file first
    const response = await fetch('results.jsonl');
    const text = await response.text();

    allData = text.trim().split('\n')
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
  updateSessionBreakdown();
}

// Update summary stats
function updateStats() {
  const latest = filteredData[filteredData.length - 1];
  if (!latest) return;

  document.querySelector('#stat-commits .stat-value').textContent = filteredData.length.toLocaleString();
  document.querySelector('#stat-pass .stat-value').textContent = (latest.stats?.pass || 0).toLocaleString();
  document.querySelector('#stat-fail .stat-value').textContent = (latest.stats?.fail || 0).toLocaleString();

  const total = (latest.stats?.total || 0);
  const pass = (latest.stats?.pass || 0);
  const rate = total > 0 ? Math.round(pass / total * 100) : 0;
  document.querySelector('#stat-rate .stat-value').textContent = rate + '%';

  // Total lines across all commits
  const totalLines = filteredData.reduce((sum, d) => sum + (d.codeMetrics?.netLines || 0), 0);
  document.querySelector('#stat-lines .stat-value').textContent = totalLines.toLocaleString();
}

// Update main chart
function updateChart() {
  const ctx = document.getElementById('timeline-chart').getContext('2d');

  if (chart) {
    chart.destroy();
  }

  const labels = filteredData.map(d => d.commit);
  const datasets = [];

  const showPass = document.getElementById('show-pass').checked;
  const showFail = document.getElementById('show-fail').checked;
  const showRate = document.getElementById('show-rate').checked;

  if (currentView === 'tests') {
    if (showPass) {
      datasets.push({
        label: 'Pass',
        data: filteredData.map(d => d.stats?.pass || 0),
        backgroundColor: COLORS.passFill,
        borderColor: COLORS.pass,
        borderWidth: 1,
        fill: true,
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 5,
      });
    }
    if (showFail) {
      datasets.push({
        label: 'Fail',
        data: filteredData.map(d => d.stats?.fail || 0),
        backgroundColor: COLORS.failFill,
        borderColor: COLORS.fail,
        borderWidth: 1,
        fill: true,
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 5,
      });
    }
    if (showRate) {
      datasets.push({
        label: 'Pass Rate %',
        data: filteredData.map(d => {
          const total = d.stats?.total || 0;
          const pass = d.stats?.pass || 0;
          return total > 0 ? Math.round(pass / total * 100) : 0;
        }),
        backgroundColor: COLORS.rateFill,
        borderColor: COLORS.rate,
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: 'y1',
      });
    }
  } else if (currentView === 'categories') {
    const categories = ['unit', 'chargen', 'special', 'map', 'gameplay', 'options'];
    categories.forEach(cat => {
      datasets.push({
        label: cat,
        data: filteredData.map(d => d.categories?.[cat]?.pass || 0),
        borderColor: COLORS[cat],
        backgroundColor: COLORS[cat].replace('0.8', '0.2'),
        borderWidth: 1,
        fill: false,
        tension: 0.1,
        pointRadius: 1,
        pointHoverRadius: 4,
      });
    });
  } else if (currentView === 'sessions') {
    // Show aggregate session metrics: total steps passing across all gameplay sessions
    // Use null for commits without session data (Chart.js will skip them)
    datasets.push({
      label: 'Gameplay Steps Passing',
      data: filteredData.map(d => {
        if (!d.sessions || Object.keys(d.sessions).length === 0) return null;
        let totalSteps = 0;
        let passedSteps = 0;
        Object.entries(d.sessions).forEach(([name, session]) => {
          if (name.includes('gameplay')) {
            totalSteps += session.totalSteps || 0;
            passedSteps += session.passedSteps || 0;
          }
        });
        return passedSteps;
      }),
      borderColor: COLORS.pass,
      backgroundColor: COLORS.passFill,
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 6,
      spanGaps: true,  // Connect points across missing data
    });
    datasets.push({
      label: 'Gameplay Steps Total',
      data: filteredData.map(d => {
        if (!d.sessions || Object.keys(d.sessions).length === 0) return null;
        let totalSteps = 0;
        Object.entries(d.sessions).forEach(([name, session]) => {
          if (name.includes('gameplay')) {
            totalSteps += session.totalSteps || 0;
          }
        });
        return totalSteps;
      }),
      borderColor: COLORS.rate,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderDash: [5, 5],
      fill: false,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      spanGaps: true,
    });
  } else if (currentView === 'code') {
    datasets.push({
      label: 'Lines Added',
      data: filteredData.map(d => d.codeMetrics?.linesAdded || 0),
      backgroundColor: COLORS.passFill,
      borderColor: COLORS.pass,
      borderWidth: 1,
      type: 'bar',
    });
    datasets.push({
      label: 'Lines Removed',
      data: filteredData.map(d => -(d.codeMetrics?.linesRemoved || 0)),
      backgroundColor: COLORS.failFill,
      borderColor: COLORS.fail,
      borderWidth: 1,
      type: 'bar',
    });
  }

  const scales = {
    x: {
      ticks: {
        color: '#6b5b4b',
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 20,
        font: { size: 10, family: "'Source Code Pro', monospace" },
      },
      grid: { color: 'rgba(196, 168, 130, 0.2)' },
    },
    y: {
      ticks: { color: '#6b5b4b', font: { size: 10 } },
      grid: { color: 'rgba(196, 168, 130, 0.2)' },
    },
  };

  if (showRate && currentView === 'tests') {
    scales.y1 = {
      position: 'right',
      min: 0,
      max: 100,
      ticks: { color: '#2c4a6b', font: { size: 10 } },
      grid: { display: false },
    };
  }

  chart = new Chart(ctx, {
    type: currentView === 'code' ? 'bar' : 'line',
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
          },
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
          },
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
    <div class="detail-row"><span class="detail-label">GitHub</span><span class="detail-value"><a href="${GITHUB_REPO}/commit/${d.commit}" target="_blank" style="color:#6b8;">View on GitHub →</a></span></div>
  </div>`;

  // Test stats
  html += `<div class="detail-group">
    <h3>Test Results</h3>
    <div class="detail-row"><span class="detail-label">Total</span><span class="detail-value">${(d.stats?.total || 0).toLocaleString()}</span></div>
    <div class="detail-row"><span class="detail-label">Pass</span><span class="detail-value" style="color:#5a5;">${(d.stats?.pass || 0).toLocaleString()}</span></div>
    <div class="detail-row"><span class="detail-label">Fail</span><span class="detail-value" style="color:#d55;">${(d.stats?.fail || 0).toLocaleString()}</span></div>
    <div class="detail-row"><span class="detail-label">Duration</span><span class="detail-value">${d.stats?.duration || 0}s</span></div>
  </div>`;

  // Categories
  if (d.categories && Object.keys(d.categories).length > 0) {
    html += `<div class="detail-group">
      <h3>Categories</h3>`;
    for (const [cat, stats] of Object.entries(d.categories)) {
      const pct = stats.total > 0 ? Math.round(stats.pass / stats.total * 100) : 0;
      html += `<div class="detail-row">
        <span class="detail-label">${cat}</span>
        <span class="detail-value"><span style="color:#5a5;">${stats.pass}</span>/<span style="color:#d55;">${stats.fail}</span> (${pct}%)</span>
      </div>`;
    }
    html += `</div>`;
  }

  // Code metrics
  if (d.codeMetrics) {
    const cm = d.codeMetrics;
    html += `<div class="detail-group">
      <h3>Code Changes</h3>
      <div class="detail-row"><span class="detail-label">Files</span><span class="detail-value">${cm.filesChanged || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Added</span><span class="detail-value" style="color:#5a5;">+${cm.linesAdded || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Removed</span><span class="detail-value" style="color:#d55;">-${cm.linesRemoved || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Net</span><span class="detail-value">${cm.netLines >= 0 ? '+' : ''}${cm.netLines || 0}</span></div>
    </div>`;
  }

  // Sessions (if any)
  if (d.sessions && Object.keys(d.sessions).length > 0) {
    html += `<div class="detail-group">
      <h3>Sessions</h3>`;
    const sessions = Object.entries(d.sessions).slice(0, 8);
    for (const [name, session] of sessions) {
      const status = session.status === 'pass' ? '✓' : '✗';
      const color = session.status === 'pass' ? '#5a5' : '#d55';
      const coverage = session.coveragePercent?.toFixed(0) || '?';
      html += `<div class="detail-row">
        <span class="detail-label" style="color:${color};">${status} ${name.slice(0, 20)}</span>
        <span class="detail-value">${coverage}%</span>
      </div>`;
    }
    if (Object.keys(d.sessions).length > 8) {
      html += `<div class="detail-row"><span class="detail-label" style="color:#777;">+${Object.keys(d.sessions).length - 8} more...</span></div>`;
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

  // Show most recent first
  const reversed = [...filteredData].reverse();

  reversed.forEach((d, i) => {
    const prev = reversed[i + 1];
    const delta = prev ? (d.stats?.pass || 0) - (prev.stats?.pass || 0) : 0;
    const isRegression = delta < 0;
    const isImprovement = delta > 5;

    const rowClass = isRegression ? 'regression' : (isImprovement ? 'improvement' : '');
    const deltaClass = delta > 0 ? 'delta-positive' : (delta < 0 ? 'delta-negative' : 'delta-neutral');
    const deltaText = delta > 0 ? `+${delta}` : (delta === 0 ? '–' : delta);

    const linesClass = (d.codeMetrics?.netLines || 0) >= 0 ? 'lines-positive' : 'lines-negative';
    const linesText = (d.codeMetrics?.netLines || 0) >= 0 ? `+${d.codeMetrics?.netLines || 0}` : d.codeMetrics?.netLines;

    html += `<tr class="${rowClass}" data-commit="${d.commit}" onclick="selectCommit(filteredData[${filteredData.length - 1 - i}])">
      <td><a class="commit-hash" href="${GITHUB_REPO}/commit/${d.commit}" target="_blank" onclick="event.stopPropagation();">${d.commit}</a></td>
      <td>${d.date?.slice(0, 10) || ''}</td>
      <td class="message-text" title="${d.message || ''}">${d.message?.slice(0, 50) || ''}</td>
      <td style="color:#5a5;">${d.stats?.pass || 0}</td>
      <td style="color:#d55;">${d.stats?.fail || 0}</td>
      <td class="${deltaClass}">${deltaText}</td>
      <td>${d.codeMetrics?.filesChanged || 0}</td>
      <td class="${linesClass}">${linesText}</td>
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

// Update session breakdown
function updateSessionBreakdown() {
  const latest = filteredData[filteredData.length - 1];
  const list = document.getElementById('session-list');

  if (!latest?.sessions || Object.keys(latest.sessions).length === 0) {
    list.innerHTML = '<div style="color:#777;font-style:italic;">No session data available</div>';
    return;
  }

  let html = '';
  const sessions = Object.entries(latest.sessions)
    .sort((a, b) => (a[1].coveragePercent || 0) - (b[1].coveragePercent || 0));

  for (const [name, session] of sessions) {
    const status = session.status === 'pass' ? 'pass' : 'fail';
    const coverage = session.coveragePercent?.toFixed(0) || '?';
    html += `<div class="session-item ${status}">
      <span class="session-name">${name}</span>
      <span class="session-coverage">${coverage}%</span>
    </div>`;
  }

  list.innerHTML = html;
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
    document.getElementById('session-breakdown').style.display =
      currentView === 'sessions' ? 'block' : 'none';

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

document.querySelectorAll('#show-pass, #show-fail, #show-rate').forEach(cb => {
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
