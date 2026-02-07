/**
 * ShipLint Analytics Worker
 * 
 * Cloudflare Worker with D1 (SQLite) for Pieter Levels-style analytics
 * 
 * Endpoints:
 * - POST /api/ping    - Receive anonymous CLI pings
 * - GET  /api/stats   - Public stats JSON
 * - GET  /stats       - Public stats page
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // POST /api/ping - receive CLI telemetry
      if (url.pathname === '/api/ping' && request.method === 'POST') {
        const data = await request.json();
        
        // Validate payload
        if (!data.v || typeof data.findings !== 'number') {
          return new Response('Invalid payload', { status: 400, headers: corsHeaders });
        }

        // Insert into D1
        await env.DB.prepare(`
          INSERT INTO pings (version, findings, errors, warnings, rules, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          data.v,
          data.findings,
          data.errors || 0,
          data.warnings || 0,
          JSON.stringify(data.rules || []),
          data.ts || Date.now()
        ).run();

        return new Response('ok', { status: 200, headers: corsHeaders });
      }

      // GET /api/stats - public stats JSON
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        const stats = await getStats(env.DB);
        return new Response(JSON.stringify(stats, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /stats - public stats page
      if (url.pathname === '/stats' && request.method === 'GET') {
        const stats = await getStats(env.DB);
        const html = renderStatsPage(stats);
        return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error(error);
      return new Response('Internal Error', { status: 500, headers: corsHeaders });
    }
  },
};

async function getStats(db) {
  // Total scans
  const totalResult = await db.prepare('SELECT COUNT(*) as count FROM pings').first();
  
  // Today's scans
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayResult = await db.prepare(
    'SELECT COUNT(*) as count FROM pings WHERE timestamp >= ?'
  ).bind(today.getTime()).first();

  // This week
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekResult = await db.prepare(
    'SELECT COUNT(*) as count FROM pings WHERE timestamp >= ?'
  ).bind(weekAgo).first();

  // Total issues found
  const issuesResult = await db.prepare(
    'SELECT SUM(findings) as total, SUM(errors) as errors, SUM(warnings) as warnings FROM pings'
  ).first();

  // Top rules (most triggered)
  const rulesResult = await db.prepare('SELECT rules FROM pings').all();
  const ruleCounts = {};
  for (const row of rulesResult.results || []) {
    const rules = JSON.parse(row.rules || '[]');
    for (const rule of rules) {
      ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
    }
  }
  const topRules = Object.entries(ruleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rule, count]) => ({ rule, count }));

  // Version distribution
  const versionsResult = await db.prepare(
    'SELECT version, COUNT(*) as count FROM pings GROUP BY version ORDER BY count DESC LIMIT 5'
  ).all();

  return {
    scans: {
      total: totalResult?.count || 0,
      today: todayResult?.count || 0,
      thisWeek: weekResult?.count || 0,
    },
    issues: {
      total: issuesResult?.total || 0,
      errors: issuesResult?.errors || 0,
      warnings: issuesResult?.warnings || 0,
    },
    topRules,
    versions: versionsResult?.results || [],
    updatedAt: new Date().toISOString(),
  };
}

function renderStatsPage(stats) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShipLint Stats</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: #0d0d0f; color: #e5e5e5; }
    .stat-card { background: #141418; border: 1px solid #26262e; }
    .accent { color: #10b981; }
  </style>
</head>
<body class="min-h-screen p-8">
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center gap-3 mb-8">
      <svg class="w-8 h-8 accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <h1 class="text-2xl font-bold">ShipLint Stats</h1>
      <span class="text-gray-500 text-sm ml-auto">Updated: ${stats.updatedAt}</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="stat-card rounded-xl p-6 text-center">
        <div class="text-4xl font-bold accent mb-2">${stats.scans.total.toLocaleString()}</div>
        <div class="text-gray-400">Total Scans</div>
      </div>
      <div class="stat-card rounded-xl p-6 text-center">
        <div class="text-4xl font-bold accent mb-2">${stats.scans.today.toLocaleString()}</div>
        <div class="text-gray-400">Today</div>
      </div>
      <div class="stat-card rounded-xl p-6 text-center">
        <div class="text-4xl font-bold accent mb-2">${stats.scans.thisWeek.toLocaleString()}</div>
        <div class="text-gray-400">This Week</div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <div class="stat-card rounded-xl p-6">
        <h2 class="font-semibold mb-4">Issues Found</h2>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="text-gray-400">Total</span>
            <span class="font-mono">${stats.issues.total.toLocaleString()}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-red-400">Errors</span>
            <span class="font-mono">${stats.issues.errors.toLocaleString()}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-yellow-400">Warnings</span>
            <span class="font-mono">${stats.issues.warnings.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div class="stat-card rounded-xl p-6">
        <h2 class="font-semibold mb-4">Top Rules Triggered</h2>
        <div class="space-y-2">
          ${stats.topRules.map(r => `
            <div class="flex justify-between">
              <span class="text-gray-400 font-mono text-sm">${r.rule}</span>
              <span class="font-mono">${r.count}</span>
            </div>
          `).join('')}
          ${stats.topRules.length === 0 ? '<div class="text-gray-500">No data yet</div>' : ''}
        </div>
      </div>
    </div>

    <div class="stat-card rounded-xl p-6">
      <h2 class="font-semibold mb-4">Version Distribution</h2>
      <div class="flex flex-wrap gap-3">
        ${stats.versions.map(v => `
          <div class="bg-gray-800 rounded-lg px-3 py-1 text-sm">
            <span class="font-mono accent">${v.version}</span>
            <span class="text-gray-500 ml-2">${v.count}</span>
          </div>
        `).join('')}
        ${stats.versions.length === 0 ? '<div class="text-gray-500">No data yet</div>' : ''}
      </div>
    </div>

    <div class="mt-8 text-center text-gray-500 text-sm">
      <p>Anonymous, aggregate data only. <a href="https://shiplint.app" class="accent hover:underline">shiplint.app</a></p>
      <p class="mt-1">Opt-out: <code class="bg-gray-800 px-2 py-0.5 rounded">SHIPLINT_NO_TELEMETRY=1</code></p>
    </div>
  </div>
</body>
</html>`;
}
