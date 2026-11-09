const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const {
  REGIONS,
  classifyOrganization,
  classifyCommittee,
  extractDatesAndMeta
} = require('./src/classifier');
const { extractNoticeDetail } = require('./src/detailExtractor');
const {
  makeNoticeId,
  scrapeGwacheonSaeol,
  runQueryBatch,
  buildHarvestQueries
} = require('./src/collector');
const {
  loadNotices,
  saveNotices,
  loadMeta,
  saveMeta,
  upsertNotices
} = require('./src/db');

const PORT = process.env.PORT || 3400;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Live sync progress state
let syncState = {
  isRunning: false,
  mode: '',
  completed: 0,
  total: 0,
  currentLabel: '',
  foundCount: 0,
  startedAt: null,
  lastResult: null
};

let autoSyncTimer = null;

/**
 * Runs a full or targeted collection job
 */
async function triggerCollection(mode = 'standard', options = {}) {
  if (syncState.isRunning) {
    return { alreadyRunning: true, syncState };
  }

  const queries = buildHarvestQueries(mode, options);
  const includeGwacheonDirect = (mode === 'standard' || mode === 'nationwide_full' || (mode === 'region' && options.region === '경기'));

  syncState = {
    isRunning: true,
    mode,
    completed: 0,
    total: queries.length + (includeGwacheonDirect ? 1 : 0),
    currentLabel: includeGwacheonDirect ? '과천시청 새올 고시/공고 직접 수집 중...' : (queries[0]?.label || '수집 준비 중...'),
    foundCount: 0,
    startedAt: new Date().toISOString(),
    lastResult: null
  };

  try {
    const collected = [];

    if (includeGwacheonDirect) {
      const gwItems = await scrapeGwacheonSaeol(3);
      collected.push(...gwItems);
      syncState.completed = 1;
      syncState.foundCount = collected.length;
    }

    const searchItems = await runQueryBatch(queries, {
      concurrency: 3,
      delayMs: 200,
      onProgress: (prog) => {
        syncState.completed = (includeGwacheonDirect ? 1 : 0) + prog.completed;
        syncState.currentLabel = prog.currentLabel;
        syncState.foundCount = collected.length + prog.foundCount;
      }
    });

    collected.push(...searchItems);

    const upsertRes = upsertNotices(collected);
    const meta = loadMeta();
    meta.lastSyncAt = new Date().toISOString();
    meta.totalSyncRuns = (meta.totalSyncRuns || 0) + 1;
    meta.lastAddedCount = upsertRes.addedCount;
    saveMeta(meta);

    syncState.isRunning = false;
    syncState.currentLabel = '수집 완료';
    syncState.lastResult = {
      ...upsertRes,
      finishedAt: meta.lastSyncAt
    };

    return { ok: true, ...upsertRes, meta };
  } catch (err) {
    syncState.isRunning = false;
    syncState.currentLabel = `오류: ${err.message}`;
    throw err;
  }
}

function setupAutoRefresh() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  const meta = loadMeta();
  const mins = Number(meta.autoRefreshMinutes) || 30;
  if (mins > 0) {
    autoSyncTimer = setInterval(() => {
      if (!syncState.isRunning) {
        triggerCollection('standard').catch(() => {});
      }
    }, mins * 60 * 1000);
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // 1. GET /api/notices
    if (req.method === 'GET' && pathname === '/api/notices') {
      const notices = loadNotices();
      const meta = loadMeta();
      return sendJson(res, 200, {
        notices,
        meta,
        syncState,
        regions: REGIONS
      });
    }

    // 2. GET /api/sync/status
    if (req.method === 'GET' && pathname === '/api/sync/status') {
      const meta = loadMeta();
      return sendJson(res, 200, { syncState, meta });
    }

    // 3. POST /api/sync
    if (req.method === 'POST' && pathname === '/api/sync') {
      const body = await readBody(req);
      const mode = body.mode || 'standard';
      const options = {
        region: body.region,
        keyword: body.keyword
      };
      // Trigger asynchronously so UI can poll progress smoothly, or await if requested
      if (body.wait) {
        const result = await triggerCollection(mode, options);
        return sendJson(res, 200, result);
      } else {
        triggerCollection(mode, options).catch(console.error);
        return sendJson(res, 200, { started: true, syncState });
      }
    }

    // 4. GET /api/notices/:id/detail
    const detailMatch = pathname.match(/^\/api\/notices\/([^/]+)\/detail$/);
    if (req.method === 'GET' && detailMatch) {
      const id = decodeURIComponent(detailMatch[1]);
      const notices = loadNotices();
      const target = notices.find(n => n.id === id);
      if (!target) {
        return sendJson(res, 404, { error: '공고를 찾을 수 없습니다.' });
      }

      try {
        const detail = await extractNoticeDetail(target.url);
        target.detail = detail;
        if (detail.deadline && !target.deadline) target.deadline = detail.deadline;
        if (detail.periodText && !target.periodText) target.periodText = detail.periodText;
        if (detail.quota && !target.quota) target.quota = detail.quota;
        if (detail.applyMethod && !target.applyMethod) target.applyMethod = detail.applyMethod;
        if (detail.contact && !target.contact) target.contact = detail.contact;
        if (detail.docNo && !target.docNo) target.docNo = detail.docNo;
        saveNotices(notices);
        return sendJson(res, 200, { notice: target, detail });
      } catch (err) {
        return sendJson(res, 200, {
          notice: target,
          detail: target.detail || {
            bodyText: target.snippet || '원문 페이지가 외부 연결을 제한하거나 응답이 지연되고 있습니다. 상단 [원문 바로가기] 버튼을 눌러 지자체 홈페이지에서 직접 확인해 주세요.',
            attachments: [],
            emails: [],
            phones: [],
            error: err.message
          }
        });
      }
    }

    // 5. PATCH /api/notices/:id (bookmark, userStatus, userMemo)
    const patchMatch = pathname.match(/^\/api\/notices\/([^/]+)$/);
    if (req.method === 'PATCH' && patchMatch) {
      const id = decodeURIComponent(patchMatch[1]);
      const body = await readBody(req);
      const notices = loadNotices();
      const target = notices.find(n => n.id === id);
      if (!target) {
        return sendJson(res, 404, { error: '공고를 찾을 수 없습니다.' });
      }
      if (typeof body.bookmarked === 'boolean') target.bookmarked = body.bookmarked;
      if (typeof body.userStatus === 'string') target.userStatus = body.userStatus;
      if (typeof body.userMemo === 'string') target.userMemo = body.userMemo;
      if (typeof body.deadline === 'string') target.deadline = body.deadline;
      target.updatedAt = new Date().toISOString();
      saveNotices(notices);
      return sendJson(res, 200, { ok: true, notice: target });
    }

    // 6. POST /api/notices/manual (Add a notice by direct URL)
    if (req.method === 'POST' && pathname === '/api/notices/manual') {
      const body = await readBody(req);
      const url = (body.url || '').trim();
      if (!url) return sendJson(res, 400, { error: 'URL을 입력해 주세요.' });

      const detail = await extractNoticeDetail(url);
      // Extract title from first line or body
      const firstLine = (detail.bodyText || '').split('\n').map(l => l.trim()).find(l => l.length > 6) || '수동 등록 위원 모집 공고';
      const title = body.title || firstLine;
      const orgInfo = classifyOrganization(url, body.orgName || '', title, detail.bodyText || '');
      const commInfo = classifyCommittee(title, detail.bodyText || '', orgInfo.orgType);

      const newNotice = {
        id: makeNoticeId(url, title),
        url,
        title,
        snippet: (detail.bodyText || '').replace(/\s+/g, ' ').slice(0, 260),
        region: orgInfo.region,
        subRegion: orgInfo.subRegion,
        orgName: orgInfo.orgName,
        orgType: orgInfo.orgType,
        category: commInfo.category,
        fields: commInfo.fields,
        publishedDate: detail.publishedDate,
        deadline: detail.deadline,
        periodText: detail.periodText,
        quota: detail.quota,
        applyMethod: detail.applyMethod,
        contact: detail.contact,
        docNo: detail.docNo,
        detail,
        sourceType: 'URL 직접 등록',
        collectedAt: new Date().toISOString()
      };

      const resUpsert = upsertNotices([newNotice]);
      return sendJson(res, 200, { ok: true, notice: newNotice, ...resUpsert });
    }

    // 7. PATCH /api/settings
    if (req.method === 'PATCH' && pathname === '/api/settings') {
      const body = await readBody(req);
      const meta = loadMeta();
      if (typeof body.autoRefreshMinutes === 'number') {
        meta.autoRefreshMinutes = body.autoRefreshMinutes;
      }
      if (Array.isArray(body.watchKeywords)) {
        meta.watchKeywords = body.watchKeywords;
      }
      saveMeta(meta);
      setupAutoRefresh();
      return sendJson(res, 200, { ok: true, meta });
    }

    // Serve static frontend files
    let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, async () => {
  console.log(`[WE-ONE] 전국 지자체·지방의회 민간위원 모집 통합 허브 서버 가동: http://localhost:${PORT}`);
  setupAutoRefresh();

  const existing = loadNotices();
  if (existing.length === 0) {
    console.log('[WE-ONE] 초기 데이터를 실시간 수집합니다...');
    try {
      const res = await triggerCollection('standard');
      console.log(`[WE-ONE] 초기 수집 완료: 총 ${res.total}건 저장됨`);
    } catch (e) {
      console.error('[WE-ONE] 초기 수집 오류:', e.message);
    }
  }
});
