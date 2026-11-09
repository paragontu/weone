const fs = require('fs');
const path = require('path');
const {
  scrapeGwacheonSaeol,
  runQueryBatch,
  buildHarvestQueries
} = require('../src/collector');
const { extractNoticeDetail } = require('../src/detailExtractor');
const { isValidCommitteeNotice } = require('../src/classifier');
const {
  getTodayKstStr,
  loadNotices,
  saveNotices,
  loadMeta,
  saveMeta,
  upsertNotices
} = require('../src/db');

const PUBLIC_DATA_DIR = path.join(__dirname, '..', 'public', 'data');

function syncToPublicData() {
  if (!fs.existsSync(PUBLIC_DATA_DIR)) {
    fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  }
  const notices = loadNotices();
  const meta = loadMeta();
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, 'notices.json'), JSON.stringify(notices, null, 2), 'utf-8');
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
  console.log(`[sync-static] Exported ${notices.length} active notices to public/data/notices.json`);
}

async function main() {
  const mode = process.argv[2] || 'all';
  console.log(`[sync-static] Starting collection (mode=${mode}, today=${getTodayKstStr()})...`);

  if (mode !== 'export-only') {
    const gwItems = await scrapeGwacheonSaeol(3);
    const qStandard = buildHarvestQueries('standard');
    const qCouncil = buildHarvestQueries('council');
    const qFull = mode === 'full' ? buildHarvestQueries('nationwide_full') : [];

    const queryMap = new Map();
    for (const q of [...qStandard, ...qCouncil, ...qFull]) {
      queryMap.set(q.query, q);
    }
    const uniqueQueries = Array.from(queryMap.values());
    const searchItems = await runQueryBatch(uniqueQueries, { concurrency: 4, delayMs: 180 });

    upsertNotices([...gwItems, ...searchItems]);
  }

  // Ensure every active notice has its detail page fetched so static hosting has full text & attachments
  const todayStr = getTodayKstStr();
  const currentNotices = loadNotices().filter(
    n => isValidCommitteeNotice(n.title, n.snippet) && n.deadline && n.deadline >= todayStr
  );

  const needDetail = currentNotices.filter(n => !n.detail || !n.detail.bodyText);
  if (needDetail.length > 0) {
    console.log(`[sync-static] Fetching full details for ${needDetail.length} active notices...`);
    const concurrency = 6;
    for (let i = 0; i < needDetail.length; i += concurrency) {
      const batch = needDetail.slice(i, i + concurrency);
      await Promise.all(batch.map(async (n) => {
        try {
          n.detail = await extractNoticeDetail(n.url);
        } catch {}
      }));
    }
  }

  saveNotices(currentNotices);

  const meta = loadMeta();
  meta.lastSyncAt = new Date().toISOString();
  meta.totalSyncRuns = (meta.totalSyncRuns || 0) + 1;
  saveMeta(meta);

  syncToPublicData();
}

main().catch(err => {
  console.error('[sync-static] Error:', err);
  process.exit(1);
});
