// Test Dashboard Logic - NetHack Themed
let testData = [];
let timelineChart = null;
let categoryChart = null;
let currentIndex = -1;

// Load test data
async function loadTestData() {
    try {
        const response = await fetch('results.jsonl');
        const text = await response.text();

        testData = text.trim().split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log(`Loaded ${testData.length} test results`);
        renderDashboard();
    } catch (error) {
        console.error('Error loading test data:', error);
        document.getElementById('latest-commit').textContent = 'Error loading data';
    }
}

// Render dashboard
function renderDashboard() {
    if (testData.length === 0) {
        document.getElementById('latest-commit').textContent = 'No data available';
        return;
    }

    currentIndex = testData.length - 1;

    // Setup scrubber
    const scrubber = document.getElementById('commit-scrubber');
    scrubber.max = testData.length - 1;
    scrubber.value = currentIndex;
    scrubber.addEventListener('input', (e) => {
        updateForCommit(parseInt(e.target.value));
    });

    // Render charts
    renderTimelineChart();
    renderCommitsTable();

    // Update last updated timestamp
    document.getElementById('last-updated').textContent = new Date().toLocaleString();

    // Initial display
    updateForCommit(currentIndex);
}

// Update display for specific commit
function updateForCommit(index) {
    const commit = testData[index];
    if (!commit) return;

    currentIndex = index;

    // Update scrubber
    const scrubber = document.getElementById('commit-scrubber');
    if (scrubber) scrubber.value = index;

    // Update scrubber info
    const scrubberInfo = document.getElementById('scrubber-info');
    if (scrubberInfo) {
        const date = new Date(commit.date).toLocaleDateString();
        scrubberInfo.textContent = `Commit ${index + 1} of ${testData.length} • ${date}`;
    }

    // Update summary cards (instant, no animation)
    document.getElementById('latest-commit').textContent = commit.commit;
    document.getElementById('latest-message').textContent = commit.message;
    document.getElementById('total-tests').textContent = commit.stats.total;
    document.getElementById('pass-count').textContent = commit.stats.pass;
    document.getElementById('fail-count').textContent = commit.stats.fail;

    const passPercent = ((commit.stats.pass / commit.stats.total) * 100).toFixed(1);
    const failPercent = ((commit.stats.fail / commit.stats.total) * 100).toFixed(1);

    document.getElementById('pass-percent').textContent = `${passPercent}%`;
    document.getElementById('fail-percent').textContent = `${failPercent}%`;

    if (commit.newTests !== 0) {
        const sign = commit.newTests > 0 ? '+' : '';
        document.getElementById('new-tests').textContent = `${sign}${commit.newTests} new`;
    } else {
        document.getElementById('new-tests').textContent = '';
    }

    // Update detailed commit info
    updateCommitDetails(commit, index);

    // Update category chart (instant)
    renderCategoryChart(commit);

    // Update vertical line on timeline
    if (timelineChart && timelineChart.options.plugins.annotation) {
        timelineChart.options.plugins.annotation.annotations.selectedCommit.xMin = index;
        timelineChart.options.plugins.annotation.annotations.selectedCommit.xMax = index;
        timelineChart.update('none'); // No animation
    }
}

// Update detailed commit information
function updateCommitDetails(commit, index) {
    document.getElementById('detail-hash').textContent = commit.commit;
    document.getElementById('detail-date').textContent = new Date(commit.date).toLocaleString();
    document.getElementById('detail-author').textContent = commit.author || 'Unknown';
    document.getElementById('detail-message').textContent = commit.message;

    // Calculate test changes from previous commit
    const prev = index > 0 ? testData[index - 1] : null;
    const changesDiv = document.getElementById('detail-changes');

    if (!prev) {
        changesDiv.innerHTML = '<span style="color: #888">First commit in history</span>';
        return;
    }

    const changes = [];
    const totalDelta = commit.stats.total - prev.stats.total;
    const passDelta = commit.stats.pass - prev.stats.pass;
    const failDelta = commit.stats.fail - prev.stats.fail;

    if (totalDelta !== 0) {
        const sign = totalDelta > 0 ? '+' : '';
        changes.push(`<div class="change-item"><span class="change-category">Total:</span><span class="change-delta ${totalDelta > 0 ? 'delta-positive' : 'delta-negative'}">${sign}${totalDelta}</span></div>`);
    }
    if (passDelta !== 0) {
        const sign = passDelta > 0 ? '+' : '';
        changes.push(`<div class="change-item"><span class="change-category">Passing:</span><span class="change-delta ${passDelta > 0 ? 'delta-positive' : 'delta-negative'}">${sign}${passDelta}</span></div>`);
    }
    if (failDelta !== 0) {
        const sign = failDelta > 0 ? '+' : '';
        changes.push(`<div class="change-item"><span class="change-category">Failing:</span><span class="change-delta ${failDelta > 0 ? 'delta-negative' : 'delta-positive'}">${sign}${failDelta}</span></div>`);
    }

    // Category changes
    if (commit.categories && prev.categories) {
        const allCategories = new Set([...Object.keys(commit.categories), ...Object.keys(prev.categories)]);
        allCategories.forEach(cat => {
            const curr = commit.categories[cat] || { pass: 0, fail: 0, total: 0 };
            const prevCat = prev.categories[cat] || { pass: 0, fail: 0, total: 0 };
            const catPassDelta = curr.pass - prevCat.pass;
            const catFailDelta = curr.fail - prevCat.fail;

            if (catPassDelta !== 0 || catFailDelta !== 0) {
                const passSign = catPassDelta > 0 ? '+' : '';
                const failSign = catFailDelta > 0 ? '+' : '';
                changes.push(`<div class="change-item"><span class="change-category">${cat}:</span><span class="change-delta">${passSign}${catPassDelta}p ${failSign}${catFailDelta}f</span></div>`);
            }
        });
    }

    if (changes.length === 0) {
        changesDiv.innerHTML = '<span style="color: #888">No test count changes</span>';
    } else {
        changesDiv.innerHTML = changes.join('');
    }
}

// Render timeline with draggable vertical line
function renderTimelineChart() {
    const ctx = document.getElementById('timeline-chart').getContext('2d');

    const labels = testData.map((d, i) => {
        const date = new Date(d.date);
        return `${d.commit.substring(0, 7)}`;
    });

    const passData = testData.map(d => d.stats.pass);
    const failData = testData.map(d => d.stats.fail);

    if (timelineChart) {
        timelineChart.destroy();
    }

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Passing',
                    data: passData,
                    borderColor: '#5a5',
                    backgroundColor: 'rgba(85, 170, 85, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 4
                },
                {
                    label: 'Failing',
                    data: failData,
                    borderColor: '#d55',
                    backgroundColor: 'rgba(221, 85, 85, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // No animation
            interaction: {
                mode: 'index',
                intersect: false
            },
            onClick: (event, elements, chart) => {
                const canvasPosition = Chart.helpers.getRelativePosition(event, chart);
                const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
                if (dataX >= 0 && dataX < testData.length) {
                    updateForCommit(Math.round(dataX));
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#aaa', font: { size: 11 } }
                },
                annotation: {
                    annotations: {
                        selectedCommit: {
                            type: 'line',
                            xMin: currentIndex,
                            xMax: currentIndex,
                            borderColor: '#da5',
                            borderWidth: 2,
                            label: {
                                display: false
                            }
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const idx = context[0].dataIndex;
                            const commit = testData[idx];
                            const date = new Date(commit.date).toLocaleDateString();
                            return `${commit.commit} (${date})`;
                        },
                        afterTitle: function(context) {
                            const idx = context[0].dataIndex;
                            const commit = testData[idx];
                            return commit.message;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#333' },
                    ticks: { color: '#888', font: { size: 10 } }
                },
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#888', maxRotation: 45, font: { size: 9 } }
                }
            }
        },
        plugins: [window.ChartAnnotation || {}]
    });
}

// Render category chart
function renderCategoryChart(commit) {
    const ctx = document.getElementById('category-chart').getContext('2d');

    const categories = commit.categories || {};
    const labels = Object.keys(categories);
    const passData = labels.map(cat => categories[cat].pass);
    const failData = labels.map(cat => categories[cat].fail);

    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Pass',
                    data: passData,
                    backgroundColor: '#5a5'
                },
                {
                    label: 'Fail',
                    data: failData,
                    backgroundColor: '#d55'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // No animation
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#aaa', font: { size: 10 } }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { color: '#333' },
                    ticks: { color: '#888', font: { size: 10 } }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: '#333' },
                    ticks: { color: '#888', font: { size: 10 } }
                }
            }
        }
    });
}

// Render commits table
function renderCommitsTable() {
    const tbody = document.getElementById('commits-tbody');
    tbody.innerHTML = '';

    const recentData = testData.slice(-20).reverse();

    recentData.forEach((commit, index) => {
        const prevIndex = testData.length - index - 2;
        const prev = prevIndex >= 0 ? testData[prevIndex] : null;

        const row = document.createElement('tr');

        if (commit.regression) {
            row.classList.add('regression-row');
        } else if (prev && commit.stats.pass > prev.stats.pass) {
            row.classList.add('improvement-row');
        }

        const date = new Date(commit.date).toLocaleDateString();
        const passPercent = ((commit.stats.pass / commit.stats.total) * 100).toFixed(1);

        let delta = '';
        let deltaClass = 'delta-neutral';
        if (prev) {
            const diff = commit.stats.pass - prev.stats.pass;
            if (diff > 0) {
                delta = `+${diff}`;
                deltaClass = 'delta-positive';
            } else if (diff < 0) {
                delta = `${diff}`;
                deltaClass = 'delta-negative';
            } else {
                delta = '–';
            }
        }

        row.innerHTML = `
            <td><span class="commit-hash">${commit.commit}</span></td>
            <td>${date}</td>
            <td>${commit.author}</td>
            <td>${commit.message}</td>
            <td>${commit.stats.total}</td>
            <td>${commit.stats.pass}</td>
            <td>${commit.stats.fail}</td>
            <td>${passPercent}%</td>
            <td><span class="${deltaClass}">${delta || '–'}</span></td>
        `;

        tbody.appendChild(row);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTestData();
});
