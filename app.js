/**
 * WellManifest Projects Landing Page & GitHub Cache Engine
 */

let appState = {
  projects: {},
  filteredProjects: [],
  categories: [],
  tags: {},
  selectedCategory: 'all',
  selectedTag: null,
  searchQuery: '',
  activeView: 'grid', // 'grid' | 'graph' | 'matrix'
  activeModalProject: null,
  activeModalTab: 'task',
  cyGraph: null,
  cacheInfo: {
    lastUpdated: null,
    source: 'Local Cache',
    ttlHours: 24
  }
};

const CATEGORY_COLORS = {
  'Core Runtime': '#06b6d4',
  'Core State & SSOT': '#0284c7',
  'Architecture & Workflow': '#8b5cf6',
  'Languages & Standards': '#a855f7',
  'AI & Autonomy': '#f43f5e',
  'Security & Identity': '#10b981',
  'Security & Isolation': '#059669',
  'Governance & Policy': '#e11d48',
  'Infrastructure & DevOps': '#3b82f6',
  'Lifecycle Management': '#f59e0b',
  'Observability & Audit': '#6366f1',
  'Product & Business': '#ec4899'
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  await loadProjectData();
  setupEventListeners();
  renderMetrics();
  renderTagsCloud();
  renderProjectsGrid();
  renderDependencyMatrix();
  initCytoscapeGraph();
});

/**
 * Load project data with 24h Daily GitHub Cache logic
 */
async function loadProjectData(forceRefresh = false) {
  const LOCAL_CACHE_KEY = 'wm_github_daily_cache_v1';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

  updateSyncStatusIndicator('syncing', 'Ładowanie cache...');

  try {
    let cacheData = null;

    if (!forceRefresh) {
      const stored = localStorage.getItem(LOCAL_CACHE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const age = Date.now() - new Date(parsed.last_updated).getTime();
          if (age < CACHE_TTL_MS) {
            cacheData = parsed;
            console.log('[Cache] Loading from valid localStorage cache (Age:', Math.round(age / 1000 / 60), 'minutes)');
          } else {
            console.log('[Cache] localStorage cache expired (>24h). Fetching fresh daily cache.');
          }
        } catch (e) {
          console.warn('[Cache] Corrupted localStorage cache, clearing.');
        }
      }
    }

    if (!cacheData) {
      // Fetch bundled projects_cache.json
      const resp = await fetch('projects_cache.json?t=' + Date.now());
      if (!resp.ok) throw new Error('Nie można pobrać pliku projects_cache.json');
      cacheData = await resp.json();

      // Save to localStorage
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cacheData));
    }

    appState.projects = cacheData.projects || {};
    appState.cacheInfo.lastUpdated = cacheData.last_updated;
    appState.cacheInfo.source = cacheData.source || 'GitHub API Cache';

    // Calculate categories and tags
    processTagsAndCategories();

    // Update UI status
    const updateDate = new Date(appState.cacheInfo.lastUpdated);
    const timeFormatted = updateDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = updateDate.toLocaleDateString();

    updateSyncStatusIndicator('success', `Cache z GitHub: ${dateFormatted} ${timeFormatted}`);

    filterProjects();

  } catch (err) {
    console.error('[Error] błąd podczas ładowania danych:', err);
    updateSyncStatusIndicator('error', 'Błąd ładowania cache');
  }
}

function updateSyncStatusIndicator(type, message) {
  const dot = document.getElementById('cache-status-dot');
  const text = document.getElementById('cache-status-text');
  if (text) text.textContent = message;

  if (dot) {
    if (type === 'syncing') {
      dot.style.backgroundColor = '#f59e0b';
      dot.style.boxShadow = '0 0 8px #f59e0b';
    } else if (type === 'error') {
      dot.style.backgroundColor = '#f43f5e';
      dot.style.boxShadow = '0 0 8px #f43f5e';
    } else {
      dot.style.backgroundColor = '#10b981';
      dot.style.boxShadow = '0 0 8px #10b981';
    }
  }
}

/**
 * Process tags cloud counters
 */
function processTagsAndCategories() {
  appState.tags = {};
  const catSet = new Set();

  Object.values(appState.projects).forEach(p => {
    if (p.category) catSet.add(p.category);
    if (p.tags && Array.isArray(p.tags)) {
      p.tags.forEach(tag => {
        appState.tags[tag] = (appState.tags[tag] || 0) + 1;
      });
    }
  });

  appState.categories = Array.from(catSet);
}

/**
 * Filter projects based on Search Query, Category, and Tag
 */
function filterProjects() {
  const query = appState.searchQuery.toLowerCase().trim();

  appState.filteredProjects = Object.values(appState.projects).filter(p => {
    // Category check
    if (appState.selectedCategory !== 'all' && p.category !== appState.selectedCategory) {
      return false;
    }
    // Tag check
    if (appState.selectedTag && (!p.tags || !p.tags.includes(appState.selectedTag))) {
      return false;
    }
    // Search query check
    if (query) {
      const matchName = p.name.toLowerCase().includes(query);
      const matchId = p.id.toLowerCase().includes(query);
      const matchTask = p.task && p.task.toLowerCase().includes(query);
      const matchTags = p.tags && p.tags.some(t => t.toLowerCase().includes(query));
      return matchName || matchId || matchTask || matchTags;
    }

    return true;
  });

  renderProjectsGrid();
  if (appState.cyGraph) {
    updateCytoscapeHighlights();
  }
}

/**
 * Render Header Metrics
 */
function renderMetrics() {
  document.getElementById('metric-total-repos').textContent = Object.keys(appState.projects).length;

  let totalDeps = 0;
  Object.values(appState.projects).forEach(p => {
    totalDeps += (p.dependencies ? p.dependencies.length : 0);
  });

  document.getElementById('metric-total-deps').textContent = totalDeps;
  document.getElementById('metric-total-tags').textContent = Object.keys(appState.tags).length;
}

/**
 * Render Tag Cloud
 */
function renderTagsCloud() {
  const container = document.getElementById('tag-cloud-container');
  if (!container) return;

  const sortedTags = Object.entries(appState.tags).sort((a, b) => b[1] - a[1]);

  let html = `<button class="tag-pill ${!appState.selectedTag ? 'active' : ''}" onclick="selectTag(null)">
    Wszystkie tagi <span class="tag-count">${Object.keys(appState.projects).length}</span>
  </button>`;

  sortedTags.forEach(([tag, count]) => {
    const isActive = appState.selectedTag === tag ? 'active' : '';
    html += `<button class="tag-pill ${isActive}" onclick="selectTag('${tag}')">
      #${tag} <span class="tag-count">${count}</span>
    </button>`;
  });

  container.innerHTML = html;
}

function selectTag(tag) {
  appState.selectedTag = appState.selectedTag === tag ? null : tag;
  renderTagsCloud();
  filterProjects();
}

function selectCategory(cat) {
  appState.selectedCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  filterProjects();
}

/**
 * Render Projects Cards Grid
 */
function renderProjectsGrid() {
  const container = document.getElementById('projects-grid-container');
  const countEl = document.getElementById('showing-projects-count');
  if (!container) return;

  if (countEl) countEl.textContent = appState.filteredProjects.length;

  if (appState.filteredProjects.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: var(--text-muted);">
        <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h3>Brak projektów spełniających kryteria wyszukiwania</h3>
        <p>Spróbuj zmienić słowo kluczowe lub wyczyścić filtry tagów.</p>
        <button class="btn btn-secondary" style="margin-top: 1rem;" onclick="resetFilters()">Wyczyść filtry</button>
      </div>`;
    return;
  }

  let html = '';
  appState.filteredProjects.forEach(p => {
    const catColor = CATEGORY_COLORS[p.category] || '#6366f1';

    const tagsHtml = (p.tags || []).map(t =>
      `<span class="card-tag" onclick="event.stopPropagation(); selectTag('${t}')">#${t}</span>`
    ).join(' ');

    const depsPills = (p.dependencies || []).map(d =>
      `<span class="dep-pill" onclick="event.stopPropagation(); openProjectModal('${d}')">${d}</span>`
    ).join(' ');

    const usedByPills = (p.used_by || []).map(u =>
      `<span class="dep-pill" style="background: rgba(16,185,129,0.15); color: #10b981;" onclick="event.stopPropagation(); openProjectModal('${u}')">${u}</span>`
    ).join(' ');

    html += `
      <div class="project-card" style="--cat-color: ${catColor}" onclick="openProjectModal('${p.id}')">
        <div>
          <div class="card-header">
            <span class="category-badge">
              <span style="width:8px; height:8px; border-radius:50%; background:${catColor}; display:inline-block;"></span>
              ${p.category}
            </span>
            <span class="status-badge">${p.status}</span>
          </div>

          <h3 class="project-title">${p.name}</h3>

          <div class="task-box">
            <span class="task-label"><i class="fas fa-bullseye"></i> Zadanie Projektu:</span>
            ${p.task}
          </div>

          <div class="card-tags">
            ${tagsHtml}
          </div>

          <div class="dependencies-summary">
            ${p.dependencies && p.dependencies.length > 0 ? `
              <div class="dep-row">
                <strong style="font-size:0.75rem; color:var(--text-muted)">Wymaga:</strong> ${depsPills}
              </div>
            ` : ''}
            ${p.used_by && p.used_by.length > 0 ? `
              <div class="dep-row">
                <strong style="font-size:0.75rem; color:var(--text-muted)">Używany przez:</strong> ${usedByPills}
              </div>
            ` : ''}
          </div>
        </div>

        <div class="card-footer">
          <div class="github-stats">
            <span class="stat-item" title="Stars"><i class="far fa-star"></i> ${p.stars || 0}</span>
            <span class="stat-item" title="Forks"><i class="fas fa-code-branch"></i> ${p.forks || 0}</span>
            <span class="stat-item" title="Language"><i class="fas fa-circle" style="font-size: 0.5rem; color: ${catColor}"></i> ${p.language || 'Python'}</span>
          </div>

          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openProjectModal('${p.id}')">
            Szczegóły & README <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Initialize Cytoscape.js Dependency Graph
 */
function initCytoscapeGraph() {
  const container = document.getElementById('cy');
  if (!container) return;

  const elements = [];

  // Add Nodes
  Object.values(appState.projects).forEach(p => {
    const catColor = CATEGORY_COLORS[p.category] || '#6366f1';
    elements.push({
      data: {
        id: p.id,
        label: p.id,
        name: p.name,
        category: p.category,
        task: p.task,
        color: catColor
      }
    });
  });

  // Add Directed Edges (Dependencies: Source depends on Target)
  Object.values(appState.projects).forEach(p => {
    if (p.dependencies && Array.isArray(p.dependencies)) {
      p.dependencies.forEach(targetId => {
        if (appState.projects[targetId]) {
          elements.push({
            data: {
              id: `${p.id}->${targetId}`,
              source: p.id,
              target: targetId
            }
          });
        }
      });
    }
  });

  appState.cyGraph = cytoscape({
    container: container,
    elements: elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'label': 'data(label)',
          'color': '#f8fafc',
          'font-family': 'Outfit, sans-serif',
          'font-size': '12px',
          'font-weight': 'bold',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': '65px',
          'height': '65px',
          'border-width': '2px',
          'border-color': 'rgba(255,255,255,0.3)',
          'text-outline-color': '#090d16',
          'text-outline-width': '3px',
          'box-shadow': '0 0 15px data(color)'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': 'rgba(99, 102, 241, 0.4)',
          'target-arrow-color': 'rgba(99, 102, 241, 0.8)',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 1.2
        }
      },
      {
        selector: 'node.highlighted',
        style: {
          'border-width': '5px',
          'border-color': '#fff',
          'width': '80px',
          'height': '80px',
          'font-size': '14px'
        }
      },
      {
        selector: 'edge.highlighted-out',
        style: {
          'width': 4,
          'line-color': '#f43f5e',
          'target-arrow-color': '#f43f5e'
        }
      },
      {
        selector: 'edge.highlighted-in',
        style: {
          'width': 4,
          'line-color': '#10b981',
          'target-arrow-color': '#10b981'
        }
      },
      {
        selector: 'node.dimmed',
        style: {
          'opacity': 0.25
        }
      },
      {
        selector: 'edge.dimmed',
        style: {
          'opacity': 0.1
        }
      }
    ],
    layout: {
      name: 'cose',
      animate: true,
      animationDuration: 800,
      nodeRepulsion: function( node ){ return 650000; },
      idealEdgeLength: function( edge ){ return 120; },
      edgeElasticity: function( edge ){ return 100; },
      gravity: 0.25
    }
  });

  // Node Interaction: Highlight Upstream & Downstream on hover/click
  appState.cyGraph.on('tap', 'node', function(evt){
    const node = evt.target;
    const nodeId = node.id();
    openProjectModal(nodeId);
  });

  appState.cyGraph.on('mouseover', 'node', function(evt){
    const node = evt.target;
    highlightNodeConnections(node);
  });

  appState.cyGraph.on('mouseout', 'node', function(evt){
    resetGraphHighlights();
  });
}

function highlightNodeConnections(node) {
  if (!appState.cyGraph) return;

  const cy = appState.cyGraph;
  cy.elements().addClass('dimmed');

  node.removeClass('dimmed').addClass('highlighted');

  // Direct outgoing dependencies (What this node requires) -> RED
  node.outgoers().removeClass('dimmed');
  node.outgoers('edge').addClass('highlighted-out');

  // Direct incoming dependants (Who depends on this node) -> GREEN
  node.incomers().removeClass('dimmed');
  node.incomers('edge').addClass('highlighted-in');
}

function resetGraphHighlights() {
  if (!appState.cyGraph) return;
  appState.cyGraph.elements().removeClass('dimmed highlighted highlighted-out highlighted-in');
}

function updateCytoscapeHighlights() {
  if (!appState.cyGraph) return;
  const cy = appState.cyGraph;
  const filteredIds = new Set(appState.filteredProjects.map(p => p.id));

  cy.nodes().forEach(n => {
    if (filteredIds.has(n.id())) {
      n.removeClass('dimmed');
    } else {
      n.addClass('dimmed');
    }
  });
}

function resetGraphLayout() {
  if (appState.cyGraph) {
    appState.cyGraph.layout({
      name: 'cose',
      animate: true,
      animationDuration: 500
    }).run();
  }
}

/**
 * Render Dependency Matrix Table
 */
function renderDependencyMatrix() {
  const container = document.getElementById('matrix-table-container');
  if (!container) return;

  const allProjects = Object.values(appState.projects);

  let html = `
    <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
      <thead>
        <tr style="background: rgba(30,41,59,0.8); text-align:left; border-bottom: 1px solid var(--glass-border);">
          <th style="padding:0.75rem; border:1px solid var(--glass-border);">Projekt</th>
          <th style="padding:0.75rem; border:1px solid var(--glass-border);">Kategoria</th>
          <th style="padding:0.75rem; border:1px solid var(--glass-border);">Zadanie Projektu</th>
          <th style="padding:0.75rem; border:1px solid var(--glass-border);">Wymaga (Dependencies)</th>
          <th style="padding:0.75rem; border:1px solid var(--glass-border);">Wykorzystywany przez</th>
        </tr>
      </thead>
      <tbody>
  `;

  allProjects.forEach(p => {
    const depsPills = (p.dependencies || []).map(d =>
      `<span class="dep-pill" onclick="openProjectModal('${d}')">${d}</span>`
    ).join(' ');

    const usedByPills = (p.used_by || []).map(u =>
      `<span class="dep-pill" style="background: rgba(16,185,129,0.15); color: #10b981;" onclick="openProjectModal('${u}')">${u}</span>`
    ).join(' ');

    html += `
      <tr style="border-bottom: 1px solid var(--glass-border); transition: background 0.2s ease;" onmouseover="this.style.background='rgba(30,41,59,0.4)'" onmouseout="this.style.background='transparent'">
        <td style="padding:0.75rem; border:1px solid var(--glass-border); font-weight:bold;">
          <a href="javascript:void(0)" onclick="openProjectModal('${p.id}')">${p.name}</a>
        </td>
        <td style="padding:0.75rem; border:1px solid var(--glass-border); font-size:0.8rem; color:${CATEGORY_COLORS[p.category] || '#fff'}">
          ${p.category}
        </td>
        <td style="padding:0.75rem; border:1px solid var(--glass-border); color:#cbd5e1;">
          ${p.task}
        </td>
        <td style="padding:0.75rem; border:1px solid var(--glass-border);">
          ${depsPills || '<span style="color:var(--text-muted);">-</span>'}
        </td>
        <td style="padding:0.75rem; border:1px solid var(--glass-border);">
          ${usedByPills || '<span style="color:var(--text-muted);">-</span>'}
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

/**
 * Open Project Details Modal Drawer
 */
function openProjectModal(projId) {
  const p = appState.projects[projId];
  if (!p) return;

  appState.activeModalProject = p;
  appState.activeModalTab = 'task';

  document.getElementById('modal-project-name').textContent = p.name;
  document.getElementById('modal-project-cat').textContent = p.category;
  document.getElementById('modal-project-cat').style.color = CATEGORY_COLORS[p.category] || '#6366f1';
  document.getElementById('modal-github-link').href = p.github_url || `https://github.com/wellmanifest/${p.id}`;

  renderModalTabContent();

  const backdrop = document.getElementById('project-modal-backdrop');
  backdrop.classList.add('open');
}

function closeProjectModal() {
  const backdrop = document.getElementById('project-modal-backdrop');
  backdrop.classList.remove('open');
}

function switchModalTab(tabName) {
  appState.activeModalTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  renderModalTabContent();
}

function renderModalTabContent() {
  const body = document.getElementById('modal-body-content');
  const p = appState.activeModalProject;
  if (!body || !p) return;

  if (appState.activeModalTab === 'task') {
    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1.5rem;">
        <div style="background: rgba(15,23,42,0.8); border: 1px solid var(--glass-border); padding: 1.5rem; border-radius: var(--border-radius-md);">
          <h3 style="color:var(--accent-cyan); margin-bottom: 0.5rem;"><i class="fas fa-bullseye"></i> Główne Zadanie Projektu:</h3>
          <p style="font-size:1.1rem; color:#f8fafc; line-height: 1.6;">${p.task}</p>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div style="background: rgba(15,23,42,0.6); padding: 1.25rem; border-radius: var(--border-radius-md); border:1px solid var(--glass-border);">
            <h4 style="margin-bottom:0.75rem; color:var(--text-secondary);">Status & Metryki</h4>
            <p><strong>Status:</strong> ${p.status}</p>
            <p><strong>Język:</strong> ${p.language}</p>
            <p><strong>Gwiazdki GitHub:</strong> ⭐ ${p.stars}</p>
            <p><strong>Forks:</strong> 🍴 ${p.forks}</p>
            <p><strong>Otwórz zgłoszenia:</strong> 🐛 ${p.issues}</p>
          </div>

          <div style="background: rgba(15,23,42,0.6); padding: 1.25rem; border-radius: var(--border-radius-md); border:1px solid var(--glass-border);">
            <h4 style="margin-bottom:0.75rem; color:var(--text-secondary);">Tagi Zastosowania</h4>
            <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
              ${(p.tags || []).map(t => `<span class="card-tag">#${t}</span>`).join(' ')}
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (appState.activeModalTab === 'readme') {
    if (window.marked && p.readme) {
      body.innerHTML = `<div class="markdown-body">${marked.parse(p.readme)}</div>`;
    } else {
      body.innerHTML = `<pre style="white-space: pre-wrap; font-family: var(--font-code); color: #cbd5e1;">${escapeHtml(p.readme || 'Brak pliku README.md')}</pre>`;
    }
  } else if (appState.activeModalTab === 'deps') {
    const depsHtml = (p.dependencies || []).map(d =>
      `<div class="metric-card" onclick="openProjectModal('${d}')" style="cursor:pointer;">
        <strong>${d}</strong>
        <p style="font-size:0.8rem; color:var(--text-muted);">${appState.projects[d]?.task || ''}</p>
       </div>`
    ).join('');

    const usedByHtml = (p.used_by || []).map(u =>
      `<div class="metric-card" onclick="openProjectModal('${u}')" style="cursor:pointer;">
        <strong style="color:var(--accent-emerald);">${u}</strong>
        <p style="font-size:0.8rem; color:var(--text-muted);">${appState.projects[u]?.task || ''}</p>
       </div>`
    ).join('');

    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1.5rem;">
        <div>
          <h4 style="color:var(--accent-indigo); margin-bottom:0.75rem;">Wymagane Zależności (Upstream):</h4>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:1rem;">
            ${depsHtml || '<p style="color:var(--text-muted)">Brak wymagań zewnętrznych (moduł autonomiczny/bazowy).</p>'}
          </div>
        </div>

        <div>
          <h4 style="color:var(--accent-emerald); margin-bottom:0.75rem;">Moduły Zależne Od Tego Projektu (Downstream):</h4>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:1rem;">
            ${usedByHtml || '<p style="color:var(--text-muted)">Żaden inny moduł nie odwołuje się do tego projektu bezpośrednio.</p>'}
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Switch Active View Mode
 */
function switchView(viewName) {
  appState.activeView = viewName;

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  const gridContainer = document.getElementById('projects-grid-container');
  const graphContainer = document.getElementById('graph-view-wrapper');
  const matrixContainer = document.getElementById('matrix-view-wrapper');

  if (gridContainer) gridContainer.style.display = viewName === 'grid' ? 'grid' : 'none';
  if (graphContainer) graphContainer.style.display = viewName === 'graph' ? 'block' : 'none';
  if (matrixContainer) matrixContainer.style.display = viewName === 'matrix' ? 'block' : 'none';

  if (viewName === 'graph' && appState.cyGraph) {
    setTimeout(() => {
      appState.cyGraph.resize();
      resetGraphLayout();
    }, 100);
  }
}

function setupEventListeners() {
  // Search Input listener
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value;
      filterProjects();
    });
  }

  // Keyboard shortcut Ctrl+K to search
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });
}

function resetFilters() {
  appState.searchQuery = '';
  appState.selectedTag = null;
  appState.selectedCategory = 'all';

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  renderTagsCloud();
  filterProjects();
}

function forceRefreshCache() {
  loadProjectData(true);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
