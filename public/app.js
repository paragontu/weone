const ALL_REGIONS = [
  '전체', '서울', '경기', '인천', '부산', '대구', '광주', '대전',
  '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
];

let state = {
  notices: [],
  meta: {},
  syncState: {},
  filters: {
    quick: 'all', // 'all' | 'today' | 'urgent' | 'council' | 'recent' | 'bookmarked'
    region: '전체',
    subRegion: '전체',
    orgType: '전체',
    category: '전체',
    field: '전체',
    search: '',
    userStatus: 'all',
    sort: 'deadline'
  },
  activeDrawerNoticeId: null
};

let syncPollTimer = null;

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysDiff(targetDateStr) {
  if (!targetDateStr) return null;
  const todayStr = getTodayStr();
  const t1 = new Date(todayStr + 'T00:00:00').getTime();
  const t2 = new Date(targetDateStr + 'T00:00:00').getTime();
  if (isNaN(t2)) return null;
  return Math.round((t2 - t1) / 86400000);
}

function isNoticeRecent(publishedDate) {
  const diff = getDaysDiff(publishedDate);
  return diff !== null && diff >= -3;
}

function isNoticeActive(notice) {
  if (!notice || !notice.deadline) return false;
  const dDiff = getDaysDiff(notice.deadline);
  return dDiff !== null && dDiff >= 0;
}

function isNoticeToday(notice) {
  if (!notice || !notice.deadline) return false;
  return getDaysDiff(notice.deadline) === 0;
}

function isNoticeUrgent(notice) {
  if (!notice || !notice.deadline) return false;
  const dDiff = getDaysDiff(notice.deadline);
  return dDiff !== null && dDiff >= 0 && dDiff <= 3;
}

function getDdayBadgeHtml(notice) {
  const diff = getDaysDiff(notice.deadline);
  if (diff === 0) {
    return `<span class="badge badge-dday-urgent">🔥 오늘 마감 (D-Day · ${notice.deadline})</span>`;
  } else if (diff > 0 && diff <= 3) {
    return `<span class="badge badge-dday-urgent">⏰ 마감 D-${diff} (${notice.deadline})</span>`;
  } else if (diff > 3) {
    return `<span class="badge badge-dday-open">모집중 · 마감 D-${diff} (${notice.deadline})</span>`;
  }
  return '';
}

function getOrgBadgeClass(orgType = '') {
  if (orgType.includes('의회')) return 'badge-org-council';
  if (orgType === '광역지자체') return 'badge-org-metro';
  return 'badge-org-basic';
}

function showToast(msg) {
  const el = document.getElementById('toastBox');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.add('hidden');
  }, 3200);
}

let isStaticMode = false;
const LOCAL_STORAGE_KEY = 'weone_user_state_v1';

function loadLocalUserState() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLocalUserState(map) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

function applyLocalUserStateToNotices(notices = []) {
  const userMap = loadLocalUserState();
  return notices.map(n => {
    const localPatch = userMap[n.id];
    if (!localPatch) return n;
    return { ...n, ...localPatch };
  });
}

async function fetchNoticesData() {
  try {
    const res = await fetch('./api/notices');
    if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
      const data = await res.json();
      isStaticMode = false;
      state.notices = applyLocalUserStateToNotices(data.notices || []);
      state.meta = data.meta || {};
      state.syncState = data.syncState || {};
      updateSyncUI();
      renderAll();
      return;
    }
  } catch {}

  // Fallback to static JSON data (GitHub Pages / Static Hosting)
  isStaticMode = true;
  const ts = Date.now();
  const [nRes, mRes] = await Promise.all([
    fetch(`./data/notices.json?t=${ts}`),
    fetch(`./data/meta.json?t=${ts}`).catch(() => null)
  ]);
  const notices = nRes.ok ? await nRes.json() : [];
  const meta = (mRes && mRes.ok) ? await mRes.json() : {};
  state.notices = applyLocalUserStateToNotices(notices);
  state.meta = meta;
  state.syncState = { isRunning: false };
  updateSyncUI();
  renderAll();
}

function updateSyncUI() {
  const { syncState, meta } = state;
  const banner = document.getElementById('syncBanner');
  const lastSyncText = document.getElementById('lastSyncText');
  const autoSelect = document.getElementById('autoRefreshSelect');

  if (meta.autoRefreshMinutes !== undefined) {
    autoSelect.value = String(meta.autoRefreshMinutes);
  }

  if (meta.lastSyncAt) {
    const dt = new Date(meta.lastSyncAt);
    const timeStr = dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    lastSyncText.textContent = `최근 업데이트: ${timeStr} (신규 +${meta.lastAddedCount || 0}건)`;
  } else {
    lastSyncText.textContent = '초기 수집 진행 중...';
  }

  if (syncState && syncState.isRunning) {
    banner.classList.remove('hidden');
    document.getElementById('syncStatusLabel').textContent = syncState.currentLabel || '실시간 공고 수집 중...';
    document.getElementById('syncCountLabel').textContent =
      `(${syncState.completed || 0} / ${syncState.total || 1} 단계 · 발견 ${syncState.foundCount || 0}건)`;
    const pct = syncState.total ? Math.min(100, Math.round((syncState.completed / syncState.total) * 100)) : 20;
    document.getElementById('syncProgressBar').style.width = `${Math.max(8, pct)}%`;

    if (!syncPollTimer) {
      syncPollTimer = setInterval(pollSyncStatus, 1000);
    }
  } else {
    banner.classList.add('hidden');
    if (syncPollTimer) {
      clearInterval(syncPollTimer);
      syncPollTimer = null;
    }
  }
}

async function pollSyncStatus() {
  try {
    const res = await fetch('/api/sync/status');
    const data = await res.json();
    const wasRunning = state.syncState?.isRunning;
    state.syncState = data.syncState;
    state.meta = data.meta;
    updateSyncUI();
    if (wasRunning && !state.syncState.isRunning) {
      await fetchNoticesData();
      showToast(`✅ 실시간 업데이트 완료! 총 ${state.notices.length}건의 공고가 정리되었습니다.`);
    }
  } catch {}
}

async function startSync(mode = 'standard', options = {}) {
  if (isStaticMode) {
    await fetchNoticesData();
    if (mode === 'council') {
      state.filters.quick = 'council';
      renderAll();
    } else if (mode === 'region' && options.region) {
      state.filters.region = options.region;
      renderAll();
    }
    showToast(`✅ 클라우드 자동수집 최신 데이터(${state.notices.filter(isNoticeActive).length}건)를 불러왔습니다.`);
    return;
  }
  try {
    const res = await fetch('./api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, ...options })
    });
    const data = await res.json();
    state.syncState = data.syncState || { isRunning: true, currentLabel: '수집 시작 중...' };
    updateSyncUI();
    if (!syncPollTimer) {
      syncPollTimer = setInterval(pollSyncStatus, 1000);
    }
  } catch (err) {
    showToast('수집 요청 중 오류가 발생했습니다.');
  }
}

function getFilteredNotices() {
  const f = state.filters;
  const kw = f.search.trim().toLowerCase();

  let list = state.notices.filter(n => {
    // 0. Strictly exclude any notice whose deadline has passed based on today's date
    if (!isNoticeActive(n)) return false;

    // 1. User status filter
    if (f.userStatus === 'ignored') {
      if (n.userStatus !== 'ignored') return false;
    } else {
      if (n.userStatus === 'ignored') return false;
      if (f.userStatus === 'bookmarked' && !n.bookmarked) return false;
      if (['interested', 'preparing', 'applied'].includes(f.userStatus) && n.userStatus !== f.userStatus) {
        return false;
      }
    }

    // 2. Quick KPI filter
    if (f.quick === 'today' && !isNoticeToday(n)) return false;
    if (f.quick === 'urgent' && !isNoticeUrgent(n)) return false;
    if (f.quick === 'council' && !(n.orgType || '').includes('의회') && n.category !== '의회위원') return false;
    if (f.quick === 'recent' && !isNoticeRecent(n.publishedDate)) return false;
    if (f.quick === 'bookmarked' && !n.bookmarked && (!n.userStatus || n.userStatus === 'none')) return false;

    // 3. Region & SubRegion
    if (f.region !== '전체' && n.region !== f.region) return false;
    if (f.subRegion !== '전체' && n.subRegion !== f.subRegion && n.orgName !== f.subRegion) return false;

    // 4. OrgType
    if (f.orgType !== '전체') {
      if (f.orgType === '의회전체') {
        if (!(n.orgType || '').includes('의회') && n.category !== '의회위원') return false;
      } else if (n.orgType !== f.orgType) {
        return false;
      }
    }

    // 5. Category
    if (f.category !== '전체' && n.category !== f.category) return false;

    // 6. Specialty Field
    if (f.field !== '전체' && !(n.fields || []).includes(f.field)) return false;

    // 7. Search Keyword
    if (kw) {
      const hay = `${n.title} ${n.orgName} ${n.subRegion} ${n.region} ${n.snippet} ${n.category} ${(n.fields || []).join(' ')} ${n.contact || ''} ${n.userMemo || ''}`.toLowerCase();
      const tokens = kw.split(/\s+/).filter(Boolean);
      if (!tokens.every(t => hay.includes(t))) return false;
    }

    return true;
  });

  // Sort
  list.sort((a, b) => {
    if (f.sort === 'deadline') {
      const da = getDaysDiff(a.deadline);
      const db = getDaysDiff(b.deadline);
      if (da !== db) return da - db;
    } else if (f.sort === 'org') {
      const cmp = (a.orgName || '').localeCompare(b.orgName || '', 'ko');
      if (cmp !== 0) return cmp;
    }
    return (b.publishedDate || '').localeCompare(a.publishedDate || '');
  });

  return list;
}

function renderKPIs() {
  const todayBadge = document.getElementById('todayFilterBadge');
  if (todayBadge) {
    todayBadge.textContent = `✅ 당일(${getTodayStr()}) 기준 마감경과 공고 자동 제외`;
  }

  const validNotices = state.notices.filter(n => n.userStatus !== 'ignored' && isNoticeActive(n));
  const total = validNotices.length;
  const todayCount = validNotices.filter(isNoticeToday).length;
  const urgent = validNotices.filter(isNoticeUrgent).length;
  const council = validNotices.filter(n => (n.orgType || '').includes('의회') || n.category === '의회위원').length;
  const recent = validNotices.filter(n => isNoticeRecent(n.publishedDate)).length;
  const bookmarked = validNotices.filter(n => n.bookmarked || (n.userStatus && n.userStatus !== 'none')).length;

  document.getElementById('valTotal').textContent = total.toLocaleString();
  document.getElementById('valToday').textContent = todayCount.toLocaleString();
  document.getElementById('valUrgent').textContent = urgent.toLocaleString();
  document.getElementById('valCouncil').textContent = council.toLocaleString();
  document.getElementById('valRecent').textContent = recent.toLocaleString();
  document.getElementById('valBookmarked').textContent = bookmarked.toLocaleString();

  document.querySelectorAll('.kpi-card').forEach(card => {
    const qf = card.getAttribute('data-QuickFilter');
    card.classList.toggle('active', state.filters.quick === qf);
  });
}

function renderRegionTabs() {
  const validNotices = state.notices.filter(n => n.userStatus !== 'ignored' && isNoticeActive(n));
  const counts = { 전체: validNotices.length };
  for (const r of ALL_REGIONS.slice(1)) counts[r] = 0;
  for (const n of validNotices) {
    if (counts[n.region] !== undefined) {
      counts[n.region]++;
    }
  }

  const container = document.getElementById('regionTabs');
  container.innerHTML = ALL_REGIONS.map(reg => {
    const isActive = state.filters.region === reg;
    const cnt = counts[reg] || 0;
    return `
      <button class="region-tab ${isActive ? 'active' : ''}" data-region="${reg}">
        <span>${reg}</span>
        <span class="region-count">${cnt}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.region-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const reg = btn.getAttribute('data-region');
      state.filters.region = reg;
      state.filters.subRegion = '전체';
      renderAll();
    });
  });

  // Render SubRegion row if a specific region is selected
  const subRow = document.getElementById('subRegionRow');
  const subChips = document.getElementById('subRegionChips');
  if (state.filters.region === '전체') {
    subRow.classList.add('hidden');
  } else {
    const regionItems = validNotices.filter(n => n.region === state.filters.region);
    const subMap = new Map();
    for (const item of regionItems) {
      const key = item.subRegion || item.orgName;
      if (key) subMap.set(key, (subMap.get(key) || 0) + 1);
    }
    const subEntries = Array.from(subMap.entries()).sort((a, b) => b[1] - a[1]);
    subRow.classList.remove('hidden');
    subChips.innerHTML = [
      `<button class="chip ${state.filters.subRegion === '전체' ? 'active' : ''}" data-sub="전체">${state.filters.region} 전체 (${regionItems.length})</button>`,
      ...subEntries.map(([subName, c]) =>
        `<button class="chip ${state.filters.subRegion === subName ? 'active' : ''}" data-sub="${subName}">${subName} (${c})</button>`
      )
    ].join('');

    subChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        state.filters.subRegion = chip.getAttribute('data-sub');
        renderAll();
      });
    });
  }
}

function renderFilterSummary(filteredLen) {
  document.getElementById('filteredCount').textContent = filteredLen.toLocaleString();
  const f = state.filters;
  const parts = [];
  if (f.region !== '전체') parts.push(`지역: ${f.region}${f.subRegion !== '전체' ? ' > ' + f.subRegion : ''}`);
  if (f.orgType !== '전체') parts.push(`기관: ${f.orgType}`);
  if (f.category !== '전체') parts.push(`분류: ${f.category}`);
  if (f.field !== '전체') parts.push(`분야: ${f.field}`);
  if (f.search) parts.push(`검색어: "${f.search}"`);
  document.getElementById('activeFilterSummary').textContent = parts.length ? `[${parts.join(' · ')}]` : '';
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderNoticeList() {
  const filtered = getFilteredNotices();
  renderFilterSummary(filtered.length);

  const listEl = document.getElementById('noticeList');
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <h3>조건에 해당하는 민간위원 모집 공고가 없습니다.</h3>
        <p>상단 <strong>[🌐 입력 키워드로 전국 공고 실시간 원격수집]</strong> 또는 <strong>[현재 선택 지역 정밀 재수집]</strong> 버튼을 눌러 전국 지자체·의회 웹에서 즉시 공고를 가져올 수 있습니다.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(n => {
    const isCouncil = (n.orgType || '').includes('의회') || n.category === '의회위원';
    const isNew = isNoticeRecent(n.publishedDate);
    const ddayHtml = getDdayBadgeHtml(n);
    const orgClass = getOrgBadgeClass(n.orgType);
    const fieldsHtml = (n.fields || []).map(f => `<span class="badge badge-field">${escapeHtml(f)}</span>`).join('');
    const dDiff = getDaysDiff(n.deadline);
    const isUrgent = dDiff !== null && dDiff >= 0 && dDiff <= 3;
    const ddayText = dDiff === 0 ? '오늘 마감 (D-Day)' : `D-${dDiff}`;

    return `
      <article class="notice-card ${n.bookmarked ? 'is-bookmarked' : ''} ${isCouncil ? 'is-council' : ''}" data-id="${escapeHtml(n.id)}">
        <div class="notice-main">
          <div class="badge-row">
            ${isNew ? '<span class="badge badge-new">NEW</span>' : ''}
            ${ddayHtml}
            <span class="badge badge-region">${escapeHtml(n.region)} · ${escapeHtml(n.subRegion || n.orgName)}</span>
            <span class="badge ${orgClass}">[${escapeHtml(n.orgType)}] ${escapeHtml(n.orgName)}</span>
            <span class="badge badge-category">${escapeHtml(n.category)}</span>
            ${fieldsHtml}
          </div>

          <h3 class="notice-title" data-open-detail="${escapeHtml(n.id)}">
            ${escapeHtml(n.title)}
          </h3>

          <div class="deadline-banner-box ${isUrgent ? 'is-urgent' : ''}">
            <span class="dl-date">⏰ 마감기한: ${escapeHtml(n.deadline)} (${ddayText})</span>
            <span>|</span>
            <span class="dl-period">🗓️ 모집·접수기간: ${escapeHtml(n.periodText || `${n.publishedDate || ''} ~ ${n.deadline}`)}</span>
          </div>

          <p class="notice-snippet">${escapeHtml(n.snippet || '')}</p>

          <div class="notice-meta-Strip">
            <span>📅 <strong>공고등록일:</strong> ${escapeHtml(n.publishedDate || '-')}</span>
            ${n.quota ? `<span>👥 <strong>모집인원:</strong> ${escapeHtml(n.quota)}</span>` : ''}
            ${n.applyMethod ? `<span>📩 <strong>접수:</strong> ${escapeHtml(n.applyMethod.slice(0, 28))}</span>` : ''}
            ${n.contact ? `<span>🏢 <strong>담당/문의:</strong> ${escapeHtml(n.contact.slice(0, 30))}</span>` : ''}
            ${n.userMemo ? `<span>📝 <strong>내 메모:</strong> ${escapeHtml(n.userMemo.slice(0, 25))}</span>` : ''}
          </div>
        </div>

        <div class="notice-actions">
          <div class="action-top-row">
            <button class="btn-star ${n.bookmarked ? 'active' : ''}" data-bookmark="${escapeHtml(n.id)}" title="관심 공고 북마크">
              ${n.bookmarked ? '★ 스크랩됨' : '☆ 스크랩'}
            </button>
            <select class="status-mini-select" data-status-id="${escapeHtml(n.id)}">
              <option value="none" ${(!n.userStatus || n.userStatus === 'none') ? 'selected' : ''}>상태 지정</option>
              <option value="interested" ${n.userStatus === 'interested' ? 'selected' : ''}>👀 관심/검토</option>
              <option value="preparing" ${n.userStatus === 'preparing' ? 'selected' : ''}>📝 지원준비</option>
              <option value="applied" ${n.userStatus === 'applied' ? 'selected' : ''}>✅ 지원완료</option>
              <option value="ignored" ${n.userStatus === 'ignored' ? 'selected' : ''}>🚫 숨김/제외</option>
            </select>
          </div>
          <div class="action-btn-row">
            <button class="btn-detail" data-open-detail="${escapeHtml(n.id)}">
              🔍 상세·첨부 분석
            </button>
            <a href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer" class="btn-orig">
              원문 바로가기 ↗
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Bind card events
  listEl.querySelectorAll('[data-open-detail]').forEach(el => {
    el.addEventListener('click', () => openDetailDrawer(el.getAttribute('data-open-detail')));
  });

  listEl.querySelectorAll('[data-bookmark]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-bookmark');
      const target = state.notices.find(x => x.id === id);
      if (!target) return;
      await updateNoticeUserState(id, { bookmarked: !target.bookmarked });
    });
  });

  listEl.querySelectorAll('[data-status-id]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.getAttribute('data-status-id');
      await updateNoticeUserState(id, { userStatus: sel.value });
    });
  });
}

async function updateNoticeUserState(id, patch) {
  // Always save to browser localStorage so state persists on both static cloud and local server
  const userMap = loadLocalUserState();
  userMap[id] = { ...(userMap[id] || {}), ...patch };
  saveLocalUserState(userMap);

  const idx = state.notices.findIndex(x => x.id === id);
  if (idx !== -1) {
    state.notices[idx] = { ...state.notices[idx], ...patch };
  }

  if (!isStaticMode) {
    try {
      const res = await fetch(`./api/notices/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (data.ok && data.notice && idx !== -1) {
        state.notices[idx] = { ...data.notice, ...userMap[id] };
      }
    } catch {}
  }

  renderAll();
  if (state.activeDrawerNoticeId === id && idx !== -1) {
    populateDrawerFields(state.notices[idx], state.notices[idx].detail);
  }
}

async function openDetailDrawer(id) {
  const notice = state.notices.find(x => x.id === id);
  if (!notice) return;
  state.activeDrawerNoticeId = id;

  document.getElementById('drawerBackdrop').classList.remove('hidden');
  document.getElementById('detailDrawer').classList.remove('hidden');

  populateDrawerFields(notice, notice.detail);

  if (isStaticMode) return;

  // Fetch live deep detail from .go.kr
  const pill = document.getElementById('drawerLoadingPill');
  pill.classList.remove('hidden');
  try {
    const res = await fetch(`./api/notices/${encodeURIComponent(id)}/detail`);
    const data = await res.json();
    if (data.notice) {
      const idx = state.notices.findIndex(x => x.id === id);
      if (idx !== -1) state.notices[idx] = data.notice;
      if (state.activeDrawerNoticeId === id) {
        populateDrawerFields(data.notice, data.detail);
        renderAll();
      }
    }
  } catch (e) {
    // Keep snippet fallback
  } finally {
    pill.classList.add('hidden');
  }
}

function populateDrawerFields(notice, detail) {
  const d = detail || notice.detail || {};
  const orgClass = getOrgBadgeClass(notice.orgType);

  document.getElementById('drawerBadges').innerHTML = `
    ${getDdayBadgeHtml(notice)}
    <span class="badge badge-region">${escapeHtml(notice.region)} · ${escapeHtml(notice.subRegion || '')}</span>
    <span class="badge ${orgClass}">[${escapeHtml(notice.orgType)}] ${escapeHtml(notice.orgName)}</span>
    <span class="badge badge-category">${escapeHtml(notice.category)}</span>
    ${(notice.fields || []).map(f => `<span class="badge badge-field">${escapeHtml(f)}</span>`).join('')}
  `;

  document.getElementById('drawerTitle').textContent = notice.title;
  document.getElementById('drawerOrigLink').href = notice.url;

  const bmBtn = document.getElementById('drawerBookmarkBtn');
  bmBtn.textContent = notice.bookmarked ? '★ 북마크됨' : '☆ 북마크';
  bmBtn.classList.toggle('btn-primary', !!notice.bookmarked);

  document.getElementById('drawerStatusSelect').value = notice.userStatus || 'none';

  document.getElementById('dOrgName').textContent = `${notice.orgName} (${notice.region} ${notice.subRegion || ''})`;
  document.getElementById('dDocNo').textContent = notice.docNo || d.docNo || '원문 참조';
  document.getElementById('dPubDate').textContent = notice.publishedDate || '-';
  document.getElementById('dPeriod').textContent =
    notice.periodText || d.periodText || (notice.deadline ? `~ ${notice.deadline}` : '원문 공고문 참조');
  document.getElementById('dDeadlineInput').value = notice.deadline || '';
  document.getElementById('dQuota').textContent = notice.quota || d.quota || '공고문 참조';

  const emails = (d.emails && d.emails.length) ? ` (${d.emails.join(', ')})` : '';
  document.getElementById('dApplyMethod').textContent = (notice.applyMethod || d.applyMethod || '공고문 참조') + emails;

  const phones = (d.phones && d.phones.length) ? ` / ☎ ${d.phones.join(', ')}` : '';
  document.getElementById('dContact').textContent = (notice.contact || d.contact || '담당부서 (원문 참조)') + phones;

  document.getElementById('dUserMemo').value = notice.userMemo || '';

  // Attachments
  const attList = document.getElementById('dAttachments');
  const attachments = d.attachments || [];
  if (attachments.length === 0) {
    attList.innerHTML = `<li style="font-size:0.82rem;color:#64748b;">첨부파일은 상단 [지자체/의회 공고 원문 페이지 열기 ↗]를 통해 공식 홈페이지에서 직접 다운로드하실 수 있습니다.</li>`;
  } else {
    attList.innerHTML = attachments.map(a => `
      <li>
        <a href="${escapeHtml(a.downloadUrl || notice.url)}" target="_blank" rel="noopener noreferrer">
          📄 ${escapeHtml(a.fileName)}
        </a>
      </li>
    `).join('');
  }

  document.getElementById('dBodyText').textContent =
    d.bodyText || notice.snippet || '본문을 불러오는 중입니다...';
}

function closeDetailDrawer() {
  state.activeDrawerNoticeId = null;
  document.getElementById('drawerBackdrop').classList.add('hidden');
  document.getElementById('detailDrawer').classList.add('hidden');
}

function exportFilteredToCsv() {
  const rows = getFilteredNotices();
  if (!rows.length) {
    showToast('내보낼 공고가 없습니다.');
    return;
  }
  const headers = ['지역', '세부지역', '기관유형', '기관명', '위원회구분', '전문분야', '공고제목', '등록일', '마감일', '모집기간', '모집인원', '접수방법', '담당부서/연락처', '내상태', '내메모', '원문URL'];
  const csvLines = [
    headers.join(','),
    ...rows.map(n => [
      n.region,
      n.subRegion,
      n.orgType,
      n.orgName,
      n.category,
      (n.fields || []).join('/'),
      n.title,
      n.publishedDate,
      n.deadline || '',
      n.periodText || '',
      n.quota || '',
      n.applyMethod || '',
      n.contact || '',
      n.userStatus || '',
      n.userMemo || '',
      n.url
    ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
  ];

  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `전국_민간위원_모집공고_${getTodayStr()}.csv`;
  link.click();
  showToast(`📥 ${rows.length}건의 공고를 엑셀(CSV) 파일로 저장했습니다.`);
}

function renderAll() {
  renderKPIs();
  renderRegionTabs();
  renderNoticeList();
}

function bindEvents() {
  // KPI Quick Filters
  document.querySelectorAll('.kpi-card').forEach(card => {
    card.addEventListener('click', () => {
      state.filters.quick = card.getAttribute('data-QuickFilter');
      renderAll();
    });
  });

  // Chip groups
  function setupChipGroup(containerId, filterKey) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.filters[filterKey] = chip.getAttribute('data-val');
        renderAll();
      });
    });
  }
  setupChipGroup('orgTypeChips', 'orgType');
  setupChipGroup('categoryChips', 'category');
  setupChipGroup('fieldChips', 'field');

  // Search Input
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  searchInput.addEventListener('input', () => {
    state.filters.search = searchInput.value;
    btnClearSearch.classList.toggle('hidden', !searchInput.value);
    renderAll();
  });
  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    state.filters.search = '';
    btnClearSearch.classList.add('hidden');
    renderAll();
  });

  // Watch keyword tags
  document.querySelectorAll('.watch-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const kw = tag.getAttribute('data-kw');
      searchInput.value = kw;
      state.filters.search = kw;
      btnClearSearch.classList.remove('hidden');
      renderAll();
    });
  });

  // Selects
  document.getElementById('statusFilterSelect').addEventListener('change', e => {
    state.filters.userStatus = e.target.value;
    renderAll();
  });
  document.getElementById('sortSelect').addEventListener('change', e => {
    state.filters.sort = e.target.value;
    renderAll();
  });

  // Reset Filters
  document.getElementById('btnResetFilters').addEventListener('click', () => {
    state.filters = {
      quick: 'all',
      region: '전체',
      subRegion: '전체',
      orgType: '전체',
      category: '전체',
      field: '전체',
      search: '',
      userStatus: 'all',
      sort: 'deadline'
    };
    searchInput.value = '';
    btnClearSearch.classList.add('hidden');
    document.getElementById('statusFilterSelect').value = 'all';
    document.getElementById('sortSelect').value = 'deadline';
    ['orgTypeChips', 'categoryChips', 'fieldChips'].forEach(id => {
      const c = document.getElementById(id);
      c.querySelectorAll('.chip').forEach((ch, idx) => ch.classList.toggle('active', idx === 0));
    });
    renderAll();
  });

  // Sync Buttons
  document.getElementById('btnSyncStandard').addEventListener('click', () => {
    showToast('🔄 전국 지자체·의회 실시간 통합 수집을 시작합니다.');
    startSync('standard');
  });
  document.getElementById('btnSyncCouncil').addEventListener('click', () => {
    showToast('🏛️ 전국 광역·기초의회(도의회·시의회·구의회·군의회) 집중 수집을 시작합니다.');
    startSync('council');
  });
  document.getElementById('btnSyncFull').addEventListener('click', () => {
    showToast('🗺️ 전국 17개 광역시·도 전체 순회 정밀 수집을 시작합니다.');
    startSync('nationwide_full');
  });
  document.getElementById('btnSyncSelectedRegion').addEventListener('click', () => {
    const reg = state.filters.region;
    if (reg === '전체') {
      showToast('🗺️ 전국 17개 시·도 정밀 수집을 시작합니다.');
      startSync('nationwide_full');
    } else {
      showToast(`📍 [${reg}] 지역 지자체 및 지방의회 공고 정밀 수집을 시작합니다.`);
      startSync('region', { region: reg });
    }
  });
  document.getElementById('btnLiveKeywordHarvest').addEventListener('click', () => {
    const kw = searchInput.value.trim();
    if (!kw) {
      showToast('검색창에 원격 수집할 키워드(예: 건축위원회, 민간위탁, 결산검사)를 먼저 입력해 주세요.');
      searchInput.focus();
      return;
    }
    showToast(`🌐 전국 '.go.kr'에서 '${kw}' 관련 민간위원 모집 공고를 실시간 수집합니다.`);
    startSync('custom', { keyword: kw });
  });

  // Auto-refresh interval select
  document.getElementById('autoRefreshSelect').addEventListener('change', async e => {
    const mins = Number(e.target.value);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoRefreshMinutes: mins })
    });
    showToast(mins > 0 ? `⏰ ${mins}분마다 백그라운드 자동 업데이트가 실행됩니다.` : '자동 업데이트를 중지했습니다.');
  });

  // CSV Export
  document.getElementById('btnExportCsv').addEventListener('click', exportFilteredToCsv);

  // Drawer controls
  document.getElementById('btnCloseDrawer').addEventListener('click', closeDetailDrawer);
  document.getElementById('drawerBackdrop').addEventListener('click', closeDetailDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDetailDrawer();
  });

  document.getElementById('drawerBookmarkBtn').addEventListener('click', async () => {
    if (!state.activeDrawerNoticeId) return;
    const n = state.notices.find(x => x.id === state.activeDrawerNoticeId);
    if (n) await updateNoticeUserState(n.id, { bookmarked: !n.bookmarked });
  });

  document.getElementById('drawerStatusSelect').addEventListener('change', async e => {
    if (!state.activeDrawerNoticeId) return;
    await updateNoticeUserState(state.activeDrawerNoticeId, { userStatus: e.target.value });
  });

  document.getElementById('dDeadlineInput').addEventListener('change', async e => {
    if (!state.activeDrawerNoticeId) return;
    await updateNoticeUserState(state.activeDrawerNoticeId, { deadline: e.target.value });
    showToast('📅 마감일이 업데이트되었습니다.');
  });

  document.getElementById('btnSaveMemo').addEventListener('click', async () => {
    if (!state.activeDrawerNoticeId) return;
    const memo = document.getElementById('dUserMemo').value;
    await updateNoticeUserState(state.activeDrawerNoticeId, { userMemo: memo });
    showToast('📝 메모가 저장되었습니다.');
  });

  // Manual URL Modal
  const manualModal = document.getElementById('manualModalBackdrop');
  document.getElementById('btnOpenManualModal').addEventListener('click', () => {
    manualModal.classList.remove('hidden');
  });
  const closeManual = () => manualModal.classList.add('hidden');
  document.getElementById('btnCloseManualModal').addEventListener('click', closeManual);
  document.getElementById('btnCancelManual').addEventListener('click', closeManual);

  document.getElementById('btnSubmitManual').addEventListener('click', async () => {
    const url = document.getElementById('manualUrlInput').value.trim();
    const title = document.getElementById('manualTitleInput').value.trim();
    if (!url) {
      showToast('URL을 입력해 주세요.');
      return;
    }
    const btn = document.getElementById('btnSubmitManual');
    btn.disabled = true;
    btn.textContent = '분석 및 등록 중...';
    try {
      const res = await fetch('/api/notices/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title })
      });
      const data = await res.json();
      if (data.ok) {
        closeManual();
        document.getElementById('manualUrlInput').value = '';
        document.getElementById('manualTitleInput').value = '';
        await fetchNoticesData();
        showToast('✅ 공고 원문을 분석하여 대시보드에 등록했습니다.');
      } else {
        showToast(data.error || '등록 실패');
      }
    } catch (e) {
      showToast('URL 분석 중 오류가 발생했습니다.');
    } finally {
      btn.disabled = false;
      btn.textContent = '자동 분석 및 등록';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  fetchNoticesData();
});
