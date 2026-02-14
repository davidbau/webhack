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

// Session groups to show (toggleable)
const SESSION_GROUPS = ['chargen', 'gameplay', 'selfplay', 'options', 'special'];

// Chart colors - parchment-friendly palette
const COLORS = {
  pass: 'rgba(42, 107, 42, 0.9)',
  passFill: 'rgba(42, 107, 42, 0.25)',
  fail: 'rgba(139, 44, 44, 0.9)',
  failFill: 'rgba(139, 44, 44, 0.25)',
  rate: 'rgba(44, 74, 107, 0.9)',
  rateFill: 'rgba(44, 74, 107, 0.15)',
  // Session groups
  chargen: 'rgba(74, 122, 74, 0.85)',
  gameplay: 'rgba(138, 90, 74, 0.85)',
  selfplay: 'rgba(122, 90, 122, 0.85)',
  options: 'rgba(122, 122, 74, 0.85)',
  special: 'rgba(90, 90, 138, 0.85)',
  // Metrics
  sessions: 'rgba(74, 122, 74, 0.9)',
  steps: 'rgba(42, 107, 42, 0.9)',
  rng: 'rgba(44, 74, 107, 0.9)',
  screen: 'rgba(138, 90, 74, 0.9)',
  // Code metrics
  main: 'rgba(42, 107, 42, 0.85)',
  test: 'rgba(44, 74, 107, 0.85)',
  docs: 'rgba(122, 122, 74, 0.85)',
  other: 'rgba(122, 90, 122, 0.85)',
};

// Group icons
const GROUP_ICONS = {
  chargen: '🧙',
  gameplay: '🎮',
  selfplay: '🤖',
  options: '⚙️',
  special: '🗺️',
};

// Load data
async function loadData() {
  try {
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

  // Code metrics from latest commit
  const mainLines = latest.codeMetrics?.main?.lines || 0;
  document.querySelector('#stat-lines .stat-value').textContent = mainLines.toLocaleString();
}

// Get enabled session groups
function getEnabledGroups() {
  return SESSION_GROUPS.filter(g => document.getElementById(`show-${g}`)?.checked);
}

// Aggregate session stats for enabled groups from a commit
function getAggregatedStats(d) {
  const enabledGroups = getEnabledGroups();

  // Try new sessionGroups format first
  if (d.sessionGroups) {
    let sessions = 0, sessionsPassing = 0;
    let steps = 0, stepsPassing = 0;
    let rng = 0, rngPassing = 0;

    for (const group of enabledGroups) {
      const g = d.sessionGroups[group];
      if (g) {
        sessions += g.total || 0;
        sessionsPassing += g.passing || 0;
        steps += g.steps || 0;
        stepsPassing += g.stepsPassing || 0;
        rng += g.rng || 0;
        rngPassing += g.rngPassing || 0;
      }
    }

    return { sessions, sessionsPassing, steps, stepsPassing, rng, rngPassing };
  }

  // Fallback to old sessionStats format
  if (d.sessionStats) {
    return {
      sessions: d.sessionStats.sessionsTotal || 0,
      sessionsPassing: d.sessionStats.sessionsPassing || 0,
      steps: d.sessionStats.stepsTotal || 0,
      stepsPassing: d.sessionStats.stepsPassing || 0,
      rng: d.sessionStats.rngTotal || 0,
      rngPassing: d.sessionStats.rngPassing || 0,
    };
  }

  return null;
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
        data: filteredData.map(d => d.stats?.pass || 0),
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
        data: filteredData.map(d => d.stats?.fail || 0),
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
          const total = d.stats?.total || 0;
          const pass = d.stats?.pass || 0;
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
    const categories = ['unit', 'chargen', 'special', 'gameplay', 'options'];
    scales.y = {
      ticks: { color: '#6b5b4b', font: { size: 10 } },
      grid: { color: 'rgba(196, 168, 130, 0.2)' },
    };
    categories.forEach(cat => {
      datasets.push({
        label: cat,
        data: filteredData.map(d => d.categories?.[cat]?.pass || 0),
        borderColor: COLORS[cat] || COLORS.pass,
        borderWidth: 1,
        fill: false,
        tension: 0.1,
        pointRadius: 1,
      });
    });

  } else if (currentView === 'sessions') {
    // Session view with separate Y axes for sessions, steps, RNG, screen
    const showSessions = document.getElementById('show-sessions')?.checked ?? true;
    const showSteps = document.getElementById('show-steps')?.checked ?? true;
    const showRng = document.getElementById('show-rng')?.checked ?? false;
    const showScreen = document.getElementById('show-screen')?.checked ?? false;

    // Calculate data for each metric
    const sessionData = filteredData.map(d => getAggregatedStats(d));

    let axisCount = 0;

    // Sessions axis (left)
    if (showSessions) {
      scales.ySessions = {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'Sessions', color: COLORS.sessions },
        ticks: { color: COLORS.sessions, font: { size: 9 } },
        grid: { color: 'rgba(196, 168, 130, 0.15)' },
      };
      datasets.push({
        label: 'Sessions Passing',
        data: sessionData.map(s => s?.sessionsPassing ?? null),
        borderColor: COLORS.sessions,
        backgroundColor: COLORS.sessions.replace('0.9', '0.2'),
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        yAxisID: 'ySessions',
        spanGaps: true,
      });
      axisCount++;
    }

    // Steps axis
    if (showSteps) {
      scales.ySteps = {
        type: 'linear',
        position: axisCount === 0 ? 'left' : 'right',
        title: { display: true, text: 'Steps', color: COLORS.steps },
        ticks: { color: COLORS.steps, font: { size: 9 } },
        grid: { display: axisCount === 0 },
      };
      datasets.push({
        label: 'Steps Passing',
        data: sessionData.map(s => s?.stepsPassing ?? null),
        borderColor: COLORS.steps,
        backgroundColor: COLORS.steps.replace('0.9', '0.15'),
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        yAxisID: 'ySteps',
        spanGaps: true,
      });
      axisCount++;
    }

    // RNG axis
    if (showRng) {
      scales.yRng = {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'RNG Calls', color: COLORS.rng },
        ticks: { color: COLORS.rng, font: { size: 9 } },
        grid: { display: false },
      };
      datasets.push({
        label: 'RNG Matching',
        data: sessionData.map(s => s?.rngPassing ?? null),
        borderColor: COLORS.rng,
        backgroundColor: COLORS.rng.replace('0.9', '0.1'),
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        yAxisID: 'yRng',
        spanGaps: true,
      });
      axisCount++;
    }

    // Screen axis (placeholder for now)
    if (showScreen) {
      scales.yScreen = {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'Screen', color: COLORS.screen },
        ticks: { color: COLORS.screen, font: { size: 9 } },
        grid: { display: false },
      };
      // Screen data not yet implemented - use steps as placeholder
      datasets.push({
        label: 'Screen Matching',
        data: sessionData.map(s => s?.stepsPassing ?? null),
        borderColor: COLORS.screen,
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.3,
        pointRadius: 2,
        yAxisID: 'yScreen',
        spanGaps: true,
      });
    }

  } else if (currentView === 'code') {
    // Code metrics view
    const showMain = document.getElementById('show-main')?.checked ?? true;
    const showTest = document.getElementById('show-test')?.checked ?? true;
    const showDocs = document.getElementById('show-docs')?.checked ?? false;
    const showOther = document.getElementById('show-other')?.checked ?? false;

    scales.y = {
      type: 'linear',
      position: 'left',
      title: { display: true, text: 'Lines of Code' },
      ticks: { color: '#6b5b4b', font: { size: 10 } },
      grid: { color: 'rgba(196, 168, 130, 0.2)' },
    };

    if (showMain) {
      datasets.push({
        label: 'Main Code',
        data: filteredData.map(d => d.codeMetrics?.main?.lines || 0),
        borderColor: COLORS.main,
        backgroundColor: COLORS.main.replace('0.85', '0.2'),
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      });
    }
    if (showTest) {
      datasets.push({
        label: 'Test Code',
        data: filteredData.map(d => d.codeMetrics?.test?.lines || 0),
        borderColor: COLORS.test,
        backgroundColor: COLORS.test.replace('0.85', '0.2'),
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      });
    }
    if (showDocs) {
      datasets.push({
        label: 'Documentation',
        data: filteredData.map(d => d.codeMetrics?.docs?.lines || 0),
        borderColor: COLORS.docs,
        backgroundColor: COLORS.docs.replace('0.85', '0.2'),
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      });
    }
    if (showOther) {
      datasets.push({
        label: 'Other',
        data: filteredData.map(d => d.codeMetrics?.other?.lines || 0),
        borderColor: COLORS.other,
        backgroundColor: COLORS.other.replace('0.85', '0.2'),
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
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
              return `${context.dataset.label}: ${value.toLocaleString()}`;
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
    <div class="detail-row"><span class="detail-label">GitHub</span><span class="detail-value"><a href="${GITHUB_REPO}/commit/${d.commit}" target="_blank" style="color:#6b8;">View on GitHub</a></span></div>
  </div>`;

  // Session groups
  if (d.sessionGroups) {
    html += `<div class="detail-group">
      <h3>Session Groups</h3>`;
    for (const [group, stats] of Object.entries(d.sessionGroups)) {
      if (stats.total === 0) continue;
      const pct = stats.total > 0 ? Math.round(stats.passing / stats.total * 100) : 0;
      const icon = GROUP_ICONS[group] || '📋';
      html += `<div class="detail-row">
        <span class="detail-label">${icon} ${group}</span>
        <span class="detail-value"><span style="color:#5a5;">${stats.passing}</span>/${stats.total} (${pct}%)</span>
      </div>`;
    }
    html += `</div>`;
  }

  // Code metrics
  if (d.codeMetrics) {
    const cm = d.codeMetrics;
    html += `<div class="detail-group">
      <h3>Code Metrics</h3>`;
    if (cm.main) {
      html += `<div class="detail-row"><span class="detail-label">Main</span><span class="detail-value">${cm.main.files} files, ${cm.main.lines?.toLocaleString()} lines</span></div>`;
    }
    if (cm.test) {
      html += `<div class="detail-row"><span class="detail-label">Test</span><span class="detail-value">${cm.test.files} files, ${cm.test.lines?.toLocaleString()} lines</span></div>`;
    }
    if (cm.docs) {
      html += `<div class="detail-row"><span class="detail-label">Docs</span><span class="detail-value">${cm.docs.files} files, ${cm.docs.lines?.toLocaleString()} lines</span></div>`;
    }
    html += `</div>`;
  }

  // Test stats
  html += `<div class="detail-group">
    <h3>Test Results</h3>
    <div class="detail-row"><span class="detail-label">Total</span><span class="detail-value">${(d.stats?.total || 0).toLocaleString()}</span></div>
    <div class="detail-row"><span class="detail-label">Pass</span><span class="detail-value" style="color:#5a5;">${(d.stats?.pass || 0).toLocaleString()}</span></div>
    <div class="detail-row"><span class="detail-label">Fail</span><span class="detail-value" style="color:#d55;">${(d.stats?.fail || 0).toLocaleString()}</span></div>
  </div>`;

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
    const delta = prev ? (d.stats?.pass || 0) - (prev.stats?.pass || 0) : 0;
    const isRegression = delta < 0;
    const isImprovement = delta > 5;

    const rowClass = isRegression ? 'regression' : (isImprovement ? 'improvement' : '');
    const deltaClass = delta > 0 ? 'delta-positive' : (delta < 0 ? 'delta-negative' : 'delta-neutral');
    const deltaText = delta > 0 ? `+${delta}` : (delta === 0 ? '–' : delta);

    const mainLines = d.codeMetrics?.main?.lines || 0;

    html += `<tr class="${rowClass}" data-commit="${d.commit}" onclick="selectCommit(filteredData[${filteredData.length - 1 - i}])">
      <td><a class="commit-hash" href="${GITHUB_REPO}/commit/${d.commit}" target="_blank" onclick="event.stopPropagation();">${d.commit}</a></td>
      <td>${d.date?.slice(0, 10) || ''}</td>
      <td class="message-text" title="${d.message || ''}">${d.message?.slice(0, 50) || ''}</td>
      <td style="color:#5a5;">${d.stats?.pass || 0}</td>
      <td style="color:#d55;">${d.stats?.fail || 0}</td>
      <td class="${deltaClass}">${deltaText}</td>
      <td>${d.codeMetrics?.main?.files || 0}</td>
      <td>${mainLines.toLocaleString()}</td>
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

// Update session breakdown with grouped sessions
function updateSessionBreakdown() {
  const latest = filteredData[filteredData.length - 1];
  const list = document.getElementById('session-list');

  if (!latest?.sessionGroups) {
    list.innerHTML = '<div style="color:#777;font-style:italic;">No session data available</div>';
    return;
  }

  let html = '';

  // Show each group
  for (const group of SESSION_GROUPS) {
    const g = latest.sessionGroups[group];
    if (!g || g.total === 0) continue;

    const icon = GROUP_ICONS[group] || '📋';
    const pct = g.total > 0 ? Math.round(g.passing / g.total * 100) : 0;
    const isEnabled = document.getElementById(`show-${group}`)?.checked;
    const enabledClass = isEnabled ? '' : 'disabled';

    html += `<div class="session-group ${enabledClass}">
      <div class="session-group-header" onclick="toggleGroupExpand('${group}')">
        <span class="group-icon">${icon}</span>
        <span class="group-name">${group}</span>
        <span class="group-stats">${g.passing}/${g.total} sessions (${pct}%)</span>
        <span class="group-expand" id="expand-${group}">▶</span>
      </div>
      <div class="session-group-details" id="details-${group}" style="display:none;">`;

    // Session metrics for this group
    if (g.steps > 0) {
      const stepPct = Math.round(g.stepsPassing / g.steps * 100);
      html += `<div class="group-metric"><span>Steps:</span> ${g.stepsPassing.toLocaleString()}/${g.steps.toLocaleString()} (${stepPct}%)</div>`;
    }
    if (g.rng > 0) {
      const rngPct = Math.round(g.rngPassing / g.rng * 100);
      html += `<div class="group-metric"><span>RNG:</span> ${g.rngPassing.toLocaleString()}/${g.rng.toLocaleString()} (${rngPct}%)</div>`;
    }

    // Individual sessions
    if (g.sessions && g.sessions.length > 0) {
      html += `<div class="session-items">`;
      for (const session of g.sessions) {
        const status = session.status === 'pass' ? 'pass' : 'fail';
        const statusIcon = session.status === 'pass' ? '✓' : '✗';
        html += `<div class="session-item ${status}">
          <span class="session-status">${statusIcon}</span>
          <span class="session-name">${session.name}</span>
        </div>`;
      }
      html += `</div>`;
    }

    html += `</div></div>`;
  }

  list.innerHTML = html;
}

// Toggle group expansion
function toggleGroupExpand(group) {
  const details = document.getElementById(`details-${group}`);
  const expand = document.getElementById(`expand-${group}`);
  if (details.style.display === 'none') {
    details.style.display = 'block';
    expand.textContent = '▼';
  } else {
    details.style.display = 'none';
    expand.textContent = '▶';
  }
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

    // Show/hide appropriate controls
    document.getElementById('test-controls').style.display =
      currentView === 'tests' ? 'flex' : 'none';
    document.getElementById('session-controls').style.display =
      currentView === 'sessions' ? 'flex' : 'none';
    document.getElementById('session-metrics-controls').style.display =
      currentView === 'sessions' ? 'flex' : 'none';
    document.getElementById('code-controls').style.display =
      currentView === 'code' ? 'flex' : 'none';

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

// Session view controls (groups)
document.querySelectorAll('#show-chargen, #show-gameplay, #show-selfplay, #show-options, #show-special').forEach(cb => {
  cb.addEventListener('change', () => {
    updateChart();
    updateSessionBreakdown();
  });
});

// Session view controls (metrics)
document.querySelectorAll('#show-sessions, #show-steps, #show-rng, #show-screen').forEach(cb => {
  cb.addEventListener('change', updateChart);
});

// Code view controls
document.querySelectorAll('#show-main, #show-test, #show-docs, #show-other').forEach(cb => {
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
