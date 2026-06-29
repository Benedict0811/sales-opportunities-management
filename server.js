const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const BASE_DIR = path.resolve(__dirname);

function sanitize(name) {
  if (/[\/\\]|\.\./.test(name)) throw new Error('Invalid name');
  return name;
}

function readDir(dirPath) {
  try { return fs.readdirSync(dirPath); } catch { return []; }
}

function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendHtml(res, filePath) {
  const content = readFile(filePath);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
  res.end(content);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let len = 0;
    req.on('data', chunk => {
      len += chunk.length;
      if (len > 5 * 1024 * 1024) { req.destroy(); reject(new Error('Body too large')); }
      else body += chunk;
    });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

// --- Markdown Parsers ---

function parseOpportunityMd(content) {
  const data = { fields: {}, stakeholders: [], notes: '' };
  const lines = content.split('\n');
  let section = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('## Overview')) { section = 'overview'; continue; }
    if (trimmed.startsWith('## Stakeholders')) { section = 'stakeholders'; continue; }
    if (trimmed.startsWith('## Notes')) { section = 'notes'; continue; }

    // Header fields (before any ## section): **Key:** Value or **Key** Value
    if (!section && /^\*\*(.+?)\*\*:?\s*(.*)/.test(trimmed)) {
      const m = trimmed.match(/^\*\*(.+?)\*\*:?\s*(.*)/);
      if (m) data.fields[m[1].replace(/:$/, '')] = m[2].trim();
      continue;
    }

    if (section === 'overview' && /^- \*\*Stage History:\*\*/.test(trimmed)) {
      const hm = trimmed.match(/^- \*\*Stage History:\*\*\s*(.*)/);
      if (hm && hm[1]) {
        data.stageHistory = hm[1].split(',').map(e => {
          const [stage, date] = e.trim().split(':');
          return { stage: stage.trim(), date: (date||'').trim() };
        }).filter(e => e.stage && e.date);
      }
      continue;
    }

    if (section === 'overview' && trimmed.startsWith('- **')) {
      const m = trimmed.match(/^- \*\*(.+?):\*\*\s*(.*)/);
      if (m) data.fields[m[1]] = m[2].trim();
      continue;
    }

    if (section === 'stakeholders' && trimmed.startsWith('|') && !trimmed.includes('---')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 4 && cells[0] !== 'Name') {
        data.stakeholders.push({ name: cells[0], role: cells[1], influence: cells[2], attitude: cells[3] });
      }
      continue;
    }

    if (section === 'notes' && trimmed && !trimmed.startsWith('#')) {
      data.notes += (data.notes ? '\n' : '') + trimmed;
    }
  }

  return data;
}

function parseMeetingMd(content) {
  const data = { fields: {}, agenda: [], requirements: [], questions: [], risks: [], actionItems: [] };
  const lines = content.split('\n');
  let section = '';

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith('## Agenda')) { section = 'agenda'; continue; }
    if (trimmed.startsWith('## Requirements')) { section = 'requirements'; continue; }
    if (trimmed.startsWith('## Questions')) { section = 'questions'; continue; }
    if (trimmed.startsWith('## Risks')) { section = 'risks'; continue; }
    if (trimmed.startsWith('## Action Items')) { section = 'actions'; continue; }

    if (section === 'agenda' && trimmed.startsWith('- ')) {
      data.agenda.push(trimmed.replace(/^- /, ''));
      continue;
    }

    if (section === 'requirements' && trimmed.startsWith('- ')) {
      const statusMatch = trimmed.match(/—\s*\[(Open|Confirmed|Gap)\]/);
      const status = statusMatch ? statusMatch[1] : 'Open';
      const dueMatch = trimmed.match(/—\s*Due\s+(\d{4}-\d{2}-\d{2})/);
      const due = dueMatch ? dueMatch[1] : '';
      const text = trimmed.replace(/^- /, '').replace(/—\s*\[(Open|Confirmed|Gap)\]/, '').replace(/—\s*Due\s+\d{4}-\d{2}-\d{2}/, '').trim();
      data.requirements.push({ text, status, due });
      continue;
    }

    if (section === 'questions' && trimmed.startsWith('### Q:')) {
      const q = trimmed.replace(/^### Q:\s*/, '');
      const aLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const a = aLine.startsWith('A:') ? aLine.replace(/^A:\s*/, '') : '';
      data.questions.push({ question: q, answer: a });
      continue;
    }

    if (section === 'risks' && trimmed.startsWith('- ')) {
      const rm = trimmed.replace(/^- /, '').match(/^\*\*(.+?):\*\*\s*(.*)/);
      if (rm) {
        data.risks.push({ risk: rm[1], mitigation: rm[2].trim() || '' });
      } else {
        data.risks.push({ risk: trimmed.replace(/^- /, ''), mitigation: '' });
      }
      continue;
    }

    if (section === 'actions' && trimmed.startsWith('- ')) {
      const statusMatch = trimmed.match(/—\s*\[(Open|In Progress|Completed|Delayed|Cancelled)\]\s*$/);
      const status = statusMatch ? statusMatch[1] : (trimmed.startsWith('- [x]') ? 'Completed' : 'Open');
      const cleaned = trimmed.replace(/^- /, '').replace(/^\[[ x]\]\s*/, '').replace(/—\s*\[(Open|In Progress|Completed|Delayed|Cancelled)\]\s*$/, '').trim();
      const ownerMatch = cleaned.match(/^—\s*(.*?)\s*—\s*/);
      const dueMatch = cleaned.match(/—\s*Due\s+(\d{4}-\d{2}-\d{2})/);
      const cleanText = cleaned.replace(/^—\s*.*?\s*—\s*/, '').replace(/—\s*Due\s+\d{4}-\d{2}-\d{2}/, '').replace(/—\s*Completed.*/, '').trim();
      data.actionItems.push({
        text: cleanText,
        status,
        due: dueMatch ? dueMatch[1] : '',
        owner: ownerMatch ? ownerMatch[1].trim() : ''
      });
      continue;
    }
  }

  const headerMatch = content.match(/\*\*(Date|Opportunity|Title|Attendees|Venue)(?::\*\*|\*\*:?)\s+(.+)/g);
  if (headerMatch) {
    headerMatch.forEach(m => {
      const kv = m.match(/\*\*(.+?)(?::\*\*|\*\*:?)\s+(.*)/);
      if (kv) data.fields[kv[1]] = kv[2].trim();
    });
  }

  return data;
}


function parseClientMd(content) {
  const data = { fields: {}, contacts: [], notes: '' };
  const lines = content.split('\n');
  let section = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('## Contacts')) { section = 'contacts'; continue; }
    if (trimmed.startsWith('## Notes')) { section = 'notes'; continue; }

    if (!section && /^\*\*(.+?)\*\*:?\s*(.*)/.test(trimmed)) {
      const m = trimmed.match(/^\*\*(.+?)\*\*:?\s*(.*)/);
      if (m) data.fields[m[1].replace(/:$/, '')] = m[2].trim();
      continue;
    }

    if (section === 'contacts' && trimmed.startsWith('|') && !trimmed.includes('---')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 1 && cells[0] !== 'Name') {
        data.contacts.push({ name: cells[0] || '', role: cells[1] || '', email: cells[2] || '', phone: cells[3] || '' });
      }
      continue;
    }

    if (section === 'notes' && trimmed && !trimmed.startsWith('#')) {
      data.notes += (data.notes ? '\n' : '') + trimmed;
    }
  }

  return data;
}

// --- Data Loaders ---

function listOpportunities() {
  const opps = [];
  const oppDir = path.join(BASE_DIR, '01-Opportunities');
  const dirs = readDir(oppDir).filter(d => d.startsWith('OPP-'));

  for (const dir of dirs) {
    const oppPath = path.join(oppDir, dir);
    const oppMd = readFile(path.join(oppPath, 'Opportunity.md'));
    if (!oppMd) continue;

    const parsed = parseOpportunityMd(oppMd);

    const meetings = [];
    const briefings = [];
    const meetDir = path.join(oppPath, 'Meetings');
    for (const f of readDir(meetDir).filter(f => f.endsWith('.md'))) {
      if (f.startsWith('Briefing-')) {
        briefings.push({ filename: f, content: readFile(path.join(meetDir, f)) });
      } else {
        const parsed = parseMeetingMd(readFile(path.join(meetDir, f)));
        parsed.filename = f;
        meetings.push(parsed);
      }
    }

    const sh = parsed.stageHistory || [];
    const lastStageDate = sh.length ? sh[sh.length - 1].date : (parsed.fields.Created || '');
    const daysInStage = lastStageDate ? Math.floor((Date.now() - new Date(lastStageDate + 'T00:00:00').getTime()) / 86400000) : 0;

    opps.push({
      id: dir,
      client: parsed.fields.Client || '',
      name: parsed.fields.Opportunity || '',
      owner: parsed.fields.Owner || '',
      created: parsed.fields.Created || '',
      updated: parsed.fields.Updated || '',
      budget: parsed.fields.Budget || '',
      need: parsed.fields.Need || '',
      targetClose: parsed.fields.Timeline || '',
      stage: parsed.fields.Stage || '',
      probability: parsed.fields.Probability || ({Discovery:'10%',Proposal:'30%',Negotiation:'60%','Verbal Commit':'85%'}[parsed.fields.Stage]||'0%'),
      product: parsed.fields.Product || '',
      nextAction: parsed.fields['Next Action'] || '',
      nextActionDue: (parsed.fields['Next Action']||'').match(/by\s*(\d{4}-\d{2}-\d{2})/)?.[1] || '',
      nextActionStatus: (parsed.fields['Next Action']||'').match(/—\s*\[(Planned|In Progress|Done)\]/)?.[1] || 'Planned',
      stakeholders: parsed.stakeholders,
      notes: parsed.notes,
      meetings,
      briefings,
      stageHistory: sh,
      daysInStage
    });
  }

  return opps;
}

function listResources() {
  const resources = [];
  // 02-Resources directory (existing)
  const resDir = path.join(BASE_DIR, '02-Resources');
  for (const cat of readDir(resDir)) {
    const catDir = path.join(resDir, cat);
    try { if (!fs.statSync(catDir).isDirectory()) continue; } catch { continue; }
    for (const f of readDir(catDir).filter(f => f.endsWith('.md'))) {
      resources.push({ category: cat, filename: f, content: readFile(path.join(catDir, f)), client: '' });
    }
  }
  // 00-Clients
  const clientDir = path.join(BASE_DIR, '00-Clients');
  for (const d of readDir(clientDir)) {
    const dPath = path.join(clientDir, d);
    try { if (!fs.statSync(dPath).isDirectory()) continue; } catch { continue; }
    const md = readFile(path.join(dPath, 'Client.md'));
    if (md) {
      const parsed = parseClientMd(md);
      const clientName = parsed.fields.Name || d.replace(/^Client-/, '');
      resources.push({ category: 'Clients', filename: `${d}.md`, content: md, client: clientName });
    }
  }
  // 01-Opportunities
  const oppDir = path.join(BASE_DIR, '01-Opportunities');
  for (const d of readDir(oppDir).filter(d => d.startsWith('OPP-'))) {
    const dPath = path.join(oppDir, d);
    try { if (!fs.statSync(dPath).isDirectory()) continue; } catch { continue; }
    const md = readFile(path.join(dPath, 'Opportunity.md'));
    if (md) {
      const parsed = parseOpportunityMd(md);
      const clientName = parsed.fields.Client || '';
      resources.push({ category: 'Opportunities', filename: `${d}.md`, content: md, client: clientName, oppFolder: d });
    }
    const meetDir = path.join(dPath, 'Meetings');
    // Get client name from opportunity
    const oppParsed = md ? parseOpportunityMd(md) : null;
    const oppClientName = oppParsed ? (oppParsed.fields.Client || '') : '';
    for (const f of readDir(meetDir).filter(f => f.endsWith('.md'))) {
      const meetMd = readFile(path.join(meetDir, f));
      resources.push({ category: 'Meeting Notes', filename: f, content: meetMd, client: oppClientName, oppFolder: d });
    }
  }
  return resources;
}

function listClients() {
  const clients = [];
  const clientDir = path.join(BASE_DIR, '00-Clients');
  for (const d of readDir(clientDir)) {
    const dPath = path.join(clientDir, d);
    try { if (!fs.statSync(dPath).isDirectory()) continue; } catch { continue; }
    const md = readFile(path.join(dPath, 'Client.md'));
    if (!md) continue;
    const parsed = parseClientMd(md);
    clients.push({
      id: d,
      name: parsed.fields.Name || '',
      industry: parsed.fields.Industry || '',
      region: parsed.fields.Region || '',
      size: parsed.fields.Size || '',
      business: parsed.fields.Business || '',
      created: parsed.fields.Created || '',
      updated: parsed.fields.Updated || '',
      contacts: parsed.contacts,
      notes: parsed.notes
    });
  }
  return clients;
}

function listArchive() {
  const result = { won: [], lost: [] };
  const arcDir = path.join(BASE_DIR, '03-Archive');
  for (const resultType of readDir(arcDir)) {
    const typeDir = path.join(arcDir, resultType);
    try { if (!fs.statSync(typeDir).isDirectory()) continue; } catch { continue; }
    const list = resultType === 'Won' ? result.won : resultType === 'Lost' ? result.lost : null;
    if (!list) continue;
    for (const year of readDir(typeDir)) {
      const yearDir = path.join(typeDir, year);
      try { if (!fs.statSync(yearDir).isDirectory()) continue; } catch { continue; }
      for (const client of readDir(yearDir)) {
        const clientDir = path.join(yearDir, client);
        try { if (!fs.statSync(clientDir).isDirectory()) continue; } catch { continue; }
        for (const folder of readDir(clientDir)) {
          const oppDir = path.join(clientDir, folder);
          try { if (!fs.statSync(oppDir).isDirectory()) continue; } catch { continue; }
          const summary = readFile(path.join(oppDir, 'Archive-Summary.md'));
          const winReason = (summary.match(/\*\*Win Reason:\*\*\s*(.+)/)||[])[1] || '';
          const lossReason = (summary.match(/\*\*Loss Reason:\*\*\s*(.+)/)||[])[1] || '';
          list.push({ year, client, folder, content: summary, winReason, lossReason });
        }
      }
    }
  }
  return result;
}

// --- MD Generators ---

function generateOpportunityMd(client, name, owner, budget, stage, targetClose, product, need, stakeholders) {
  const today = new Date().toISOString().split('T')[0];
  const initStage = stage || 'Discovery';
  const shRows = (stakeholders && stakeholders.length > 0)
    ? stakeholders.map(s => `| ${s.name||'TBD'} | ${s.role||'TBD'} | ${s.influence||'TBD'} | ${s.attitude||'TBD'} |`).join('\n')
    : '| TBD | TBD | TBD | TBD |';
  return `# ${client} - ${name}

**Client:** ${client}
**Opportunity:** ${name}
**Owner:** ${owner || 'TBD'}
**Created:** ${today}
**Updated:** ${today}

## Overview
- **Budget:** ${budget || 'TBD'}
- **Need:** ${need || 'TBD'}
- **Timeline:** ${targetClose || 'TBD'}
- **Stage:** ${initStage}
- **Product:** ${product || 'TBD'}
- **Next Action:** TBD
- **Stage History:** ${initStage}:${today}

## Stakeholders
| Name | Role | Influence | Attitude |
|------|------|-----------|----------|
${shRows}

## Notes

`;
}

function generateMeetingMd(client, oppName, title, date, attendees, venueType, agenda, requirements, questions, risks, actionItems, venueDetail) {
  const today = date || new Date().toISOString().split('T')[0];
  const venue = venueType ? (venueDetail ? `${venueType} — ${venueDetail}` : venueType) : 'Online';
  let md = `# Meeting: ${title}

**Date:** ${today}
**Title:** ${title || oppName}
**Opportunity:** ${oppName}
**Attendees:** ${attendees || 'TBD'}
**Venue:** ${venue}

## Agenda
`;
  (agenda || ['TBD']).forEach(a => { md += `- ${a}\n`; });
  md += '\n## Requirements\n';
  (requirements || []).forEach(r => {
    const t = typeof r === 'string' ? r : r.text;
    const s = typeof r === 'string' ? 'Open' : (r.status || 'Open');
    const d = typeof r === 'string' ? '' : (r.due || '');
    md += `- ${t} — [${s}]` + (d ? ` — Due ${d}` : '') + '\n';
  });
  if (!requirements || !requirements.length) md += '- TBD — [Open]\n';
  md += '\n## Questions\n';
  (questions || []).forEach(q => { md += `### Q: ${q.question}\nA: ${q.answer || '(open)'}\n\n`; });
  if (!questions || !questions.length) md += '### Q: TBD\nA: TBD\n\n';
  md += '## Risks\n';
  (risks || []).forEach(r => { md += `- **${r.risk}:** ${r.mitigation || '(no mitigation yet)'}\n`; });
  if (!risks || !risks.length) md += '- TBD\n';
  md += '\n## Action Items\n';
  (actionItems || []).forEach(a => {
    const owner = a.owner ? `— ${a.owner} — ` : '';
    const due = a.due ? ` — Due ${a.due}` : '';
    const st = a.status || 'Open';
    md += `- ${owner}${a.text}${due} — [${st}]\n`;
  });
  if (!actionItems || !actionItems.length) md += '- TBD — [Open]\n';
  return md;
}

function rebuildMeetingMd(parsed) {
  let md = `# Meeting: ${parsed.fields.Title || parsed.fields.Opportunity || 'Meeting'}\n\n`;
  md += `**Date:** ${parsed.fields.Date || ''}\n`;
  if (parsed.fields.Title) md += `**Title:** ${parsed.fields.Title}\n`;
  md += `**Opportunity:** ${parsed.fields.Opportunity || ''}\n`;
  md += `**Attendees:** ${parsed.fields.Attendees || 'TBD'}\n`;
  md += `**Venue:** ${parsed.fields.Venue || parsed.fields.Location || 'Online'}\n\n`;

  md += `## Agenda\n`;
  (parsed.agenda || []).forEach(a => { md += `- ${a}\n`; });
  if (!parsed.agenda || !parsed.agenda.length) md += '- TBD\n';
  md += '\n## Requirements\n';
  (parsed.requirements || []).forEach(r => {
    const t = typeof r === 'string' ? r : r.text;
    const s = typeof r === 'string' ? 'Open' : (r.status || 'Open');
    const d = typeof r === 'string' ? '' : (r.due || '');
    md += `- ${t} — [${s}]` + (d ? ` — Due ${d}` : '') + '\n';
  });
  if (!parsed.requirements || !parsed.requirements.length) md += '- TBD — [Open]\n';
  md += '\n## Questions\n';
  (parsed.questions || []).forEach(q => { md += `### Q: ${q.question}\nA: ${q.answer || '(open)'}\n\n`; });
  if (!parsed.questions || !parsed.questions.length) md += '### Q: TBD\nA: TBD\n\n';
  md += '## Risks\n';
  (parsed.risks || []).forEach(r => { md += `- **${r.risk}:** ${r.mitigation || '(no mitigation yet)'}\n`; });
  if (!parsed.risks || !parsed.risks.length) md += '- TBD\n';
  md += '\n## Action Items\n';
  (parsed.actionItems || []).forEach(a => {
    const owner = a.owner ? `— ${a.owner} — ` : '';
    const due = a.due ? ` — Due ${a.due}` : '';
    const st = a.status || 'Open';
    md += `- ${owner}${a.text}${due} — [${st}]\n`;
  });
  if (!parsed.actionItems || !parsed.actionItems.length) md += '- TBD — [Open]\n';
  return md;
}


function generateWeeklyReportMd(startDate, endDate, opps, archivedWon) {
  const fmt$ = v => v && v!=='TBD' ? v : '-';
  const dStart = new Date(startDate+'T00:00:00');
  const dEnd = new Date(endDate+'T23:59:59');

  // Categorize opportunities
  const aiTokenOpps = opps.filter(o => /ai\s*tokens?/i.test(o.need||o.product||''));
  const cloudOpps = opps.filter(o => /cloud/i.test(o.need||o.product||'') && !/ai\s*tokens?/i.test(o.need||''));
  const aiTokenWon = archivedWon.filter(a => { const c = a.content||''; return /ai\s*tokens?/i.test(c); });
  const aiTokenPipeline = aiTokenOpps.length;

  // Helper: extract meeting info within date range only
  function getMeetingsInRange(opp) {
    return (opp.meetings||[]).filter(m => {
      const md = new Date((m.fields?.Date||'')+'T00:00:00');
      return md >= dStart && md <= dEnd;
    }).sort((a,b) => (a.fields?.Date||'').localeCompare(b.fields?.Date||''));
  }

  // Group AI Token by product
  const aiByProduct = {};
  aiTokenOpps.forEach(o => {
    const prod = o.product||'Other';
    if (!aiByProduct[prod]) aiByProduct[prod] = [];
    aiByProduct[prod].push(o);
  });

  let md = `# Weekly Report - ${startDate} ~ ${endDate}\n\n`;
  md += `## AI Token Opportunities\n\n`;
  md += `**Summary:** Total ${aiTokenOpps.length + aiTokenWon.length} AI Token opportunities — Won: ${aiTokenWon.length}, Pipeline: ${aiTokenPipeline}\n\n`;

  for (const [prod, list] of Object.entries(aiByProduct)) {
    md += `### Product: ${prod}\n\n`;
    list.forEach(o => {
      const meetings = getMeetingsInRange(o);
      md += `#### ${o.client} — ${o.name}\n\n`;
      md += `- **Budget:** ${fmt$(o.budget)}\n`;
      md += `- **Stage:** ${o.stage||o.product||'-'}\n\n`;

      if (meetings.length) {
        md += `**This Week Progress:**\n\n`;
        meetings.forEach(m => {
          const date = m.fields?.Date||'';
          const title = m.fields?.Title||m.fields?.Opportunity||'';
          md += `${date} — ${title}\n`;
          (m.agenda||[]).forEach(a => { md += `  - ${a}\n`; });
          md += `\n`;
        });

        const risks = [];
        const reqs = [];
        meetings.forEach(m => {
          const date = m.fields?.Date||'';
          const title = m.fields?.Title||m.fields?.Opportunity||'';
          (m.risks||[]).forEach(r => {
            const text = r.risk||r.text||r;
            const mit = r.mitigation || '';
            risks.push({date, title, text, mit});
          });
          (m.requirements||[]).forEach(r => {
            const text = typeof r==='string'?r:r.text;
            const status = r.status || 'Open';
            reqs.push({date, title, text, status});
          });
        });

        if (risks.length) {
          md += `**Risks:**\n\n`;
          risks.forEach(r => {
            md += `- ${r.date} ${r.title}: ${r.text}`;
            if (r.mit) md += ` (Mitigation: ${r.mit})`;
            md += `\n`;
          });
          md += `\n`;
        }

        if (reqs.length) {
          md += `**Requirements:**\n\n`;
          reqs.forEach(r => {
            md += `- ${r.date} ${r.title}: ${r.text} [${r.status}]\n`;
          });
          md += `\n`;
        }
      } else {
        md += `**This Week Progress:** No meetings in this period.\n\n`;
      }

      md += `**Next Week Plan:** (to be filled by sales)\n\n---\n\n`;
    });
  }

  md += `## Cloud Resell\n\n`;

  const cloudByProduct = {};
  cloudOpps.forEach(o => {
    const prod = o.product || 'Other';
    if (!cloudByProduct[prod]) cloudByProduct[prod] = [];
    cloudByProduct[prod].push(o);
  });

  for (const [prod, list] of Object.entries(cloudByProduct)) {
    md += `### Product: ${prod}\n\n`;
    list.forEach(o => {
      const meetings = getMeetingsInRange(o);
      md += `#### ${o.client} — ${o.name}\n\n`;
      md += `- **Budget:** ${fmt$(o.budget)}\n\n`;

      if (meetings.length) {
        md += `**This Week Progress:**\n\n`;
        meetings.forEach(m => {
          const date = m.fields?.Date||'';
          const title = m.fields?.Title||m.fields?.Opportunity||'';
          md += `${date} — ${title}\n`;
          (m.agenda||[]).forEach(a => { md += `  - ${a}\n`; });
          md += `\n`;
        });

        const risks = [];
        const reqs = [];
        meetings.forEach(m => {
          const date = m.fields?.Date||'';
          const title = m.fields?.Title||m.fields?.Opportunity||'';
          (m.risks||[]).forEach(r => {
            risks.push({date, title, text: r.risk||r.text||r, mit: r.mitigation||''});
          });
          (m.requirements||[]).forEach(r => {
            reqs.push({date, title, text: typeof r==='string'?r:r.text, status: r.status||'Open'});
          });
        });

        if (risks.length) {
          md += `**Risks:**\n\n`;
          risks.forEach(r => {
            md += `- ${r.date} ${r.title}: ${r.text}`;
            if (r.mit) md += ` (Mitigation: ${r.mit})`;
            md += `\n`;
          });
          md += `\n`;
        }

        if (reqs.length) {
          md += `**Requirements:**\n\n`;
          reqs.forEach(r => {
            md += `- ${r.date} ${r.title}: ${r.text} [${r.status}]\n`;
          });
          md += `\n`;
        }
      } else {
        md += `**This Week Progress:** No meetings in this period.\n\n`;
      }

      md += `**Next Week Plan:** (to be filled by sales)\n\n---\n\n`;
    });
  }

  return md;
}

function parseWeeklyReportMd(content) {
  const data = { sections: {} };
  const lines = content.split('\n');
  const titleMatch = content.match(/^# (?:Weekly Report|销售周报)[ -]+(.+)/m);
  if (titleMatch) { data.title = titleMatch[1].replace(/^[—\-]\s*/, '').trim(); data.period = data.title; }
  const periodMatch = content.match(/\*\*Period:\*\*\s*(.*)/);
  if (periodMatch) data.period = periodMatch[1].trim();

  let section = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) { section = trimmed.replace(/^## /, ''); data.sections[section] = { summary: '', rows: [] }; continue; }
    if (trimmed.startsWith('**') && section) { data.sections[section].summary = trimmed; continue; }
    if (trimmed.startsWith('|') && section && !trimmed.includes('---') && !trimmed.includes('Client') && !trimmed.includes('----')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length) data.sections[section].rows.push(cells);
    }
  }
  return data;
}

function listWeeklyReports() {
  const reports = [];
  const dir = path.join(BASE_DIR, '02-WeeklyReports');
  try { if (!fs.statSync(dir).isDirectory()) return reports; } catch { return reports; }
  for (const f of readDir(dir).filter(f => f.endsWith('.md'))) {
    const content = readFile(path.join(dir, f));
    const parsed = parseWeeklyReportMd(content);
    reports.push({ filename: f, title: parsed.title||f.replace('.md',''), period: parsed.period||'', content });
  }
  reports.sort((a,b) => (b.period||b.filename).localeCompare(a.period||a.filename));
  return reports;
}

function parseTargetsMd(content) {
  const targets = [];
  const lines = (content||'').split('\n');
  for (const line of lines) {
    const m = line.trim().match(/^\*\*(\d{4}-Q[1-4]):\*\*\s*(\d+)/);
    if (m) targets.push({ quarter: m[1], amount: parseInt(m[2]) });
  }
  return targets;
}

function generateTargetsMd(targets) {
  let md = `# Quarterly Targets\n\n`;
  (targets||[]).forEach(t => { md += `**${t.quarter}:** ${t.amount}\n`; });
  return md;
}

function rebuildOpportunityMd(parsed) {
  let md = `# ${parsed.fields.Client} - ${parsed.fields.Opportunity}\n\n`;
  md += `**Client:** ${parsed.fields.Client}\n`;
  md += `**Opportunity:** ${parsed.fields.Opportunity}\n`;
  md += `**Owner:** ${parsed.fields.Owner || 'TBD'}\n`;
  md += `**Created:** ${parsed.fields.Created}\n`;
  md += `**Updated:** ${new Date().toISOString().split('T')[0]}\n\n`;

  md += `## Overview\n`;
  md += `- **Budget:** ${parsed.fields.Budget || 'TBD'}\n`;
  md += `- **Need:** ${parsed.fields.Need || 'TBD'}\n`;
  md += `- **Timeline:** ${parsed.fields.Timeline || 'TBD'}\n`;
  md += `- **Stage:** ${parsed.fields.Stage || 'Discovery'}\n`;
  md += `- **Product:** ${parsed.fields.Product || 'TBD'}\n`;
  const na = parsed.fields['Next Action'];
  md += `- **Next Action:** ${na ? na : 'TBD'}\n`;
  const sh = parsed.stageHistory || [];
  md += `- **Stage History:** ${sh.length ? sh.map(e => `${e.stage}:${e.date}`).join(', ') : `Discovery:${parsed.fields.Created || today}`}\n\n`;

  md += `## Stakeholders\n| Name | Role | Influence | Attitude |\n|------|------|-----------|----------|\n`;
  parsed.stakeholders.forEach(s => { md += `| ${s.name} | ${s.role} | ${s.influence} | ${s.attitude} |\n`; });
  if (!parsed.stakeholders.length) md += `| TBD | TBD | TBD | TBD |\n`;
  md += '\n';

  md += `## Notes\n${parsed.notes || ''}\n`;

  return md;
}

function generateClientMd(name, industry, region, size, business) {
  const today = new Date().toISOString().split('T')[0];
  return `# ${name}

**Name:** ${name}
**Industry:** ${industry || 'TBD'}
**Region:** ${region || 'TBD'}
**Size:** ${size || 'TBD'}
**Business:** ${business || ''}
**Created:** ${today}
**Updated:** ${today}

## Contacts
| Name | Role | Email | Phone |
|------|------|-------|-------|

## Notes

`;
}

function rebuildClientMd(parsed) {
  let md = `# ${parsed.fields.Name}\n\n`;
  md += `**Name:** ${parsed.fields.Name}\n`;
  md += `**Industry:** ${parsed.fields.Industry || 'TBD'}\n`;
  md += `**Region:** ${parsed.fields.Region || 'TBD'}\n`;
  md += `**Size:** ${parsed.fields.Size || 'TBD'}\n`;
  md += `**Business:** ${parsed.fields.Business || ''}\n`;
  md += `**Created:** ${parsed.fields.Created}\n`;
  md += `**Updated:** ${new Date().toISOString().split('T')[0]}\n\n`;

  md += `## Contacts\n| Name | Role | Email | Phone |\n|------|------|-------|-------|\n`;
  parsed.contacts.forEach(c => { md += `| ${c.name} | ${c.role} | ${c.email} | ${c.phone} |\n`; });
  md += '\n';

  md += `## Notes\n${parsed.notes || ''}\n`;

  return md;
}

// --- HTTP Server ---

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Serve index.html
  if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    return sendHtml(res, path.join(BASE_DIR, 'index.html'));
  }

  // API: GET /api/summary
  if (method === 'GET' && pathname === '/api/summary') {
    const opps = listOpportunities();
    const clients = listClients();
    const resources = listResources();
    const archive = listArchive();
    const active = opps.filter(o => !['Won', 'Lost'].includes(o.stage));
    const wonFromArchive = archive.won ? archive.won.length : 0;
    const lostFromArchive = archive.lost ? archive.lost.length : 0;
    const totalValue = active.reduce((sum, o) => {
      const v = parseFloat((o.budget || '').replace(/[^0-9.]/g, '')) || 0;
      return sum + v;
    }, 0);
    const weightedValue = active.reduce((sum, o) => {
      const v = parseFloat((o.budget || '').replace(/[^0-9.]/g, '')) || 0;
      const p = {Discovery:.1,Proposal:.3,Negotiation:.6,'Verbal Commit':.85}[o.stage] || 0;
      return sum + v * p;
    }, 0);
    const winRate = (wonFromArchive + lostFromArchive) > 0
      ? Math.round(wonFromArchive / (wonFromArchive + lostFromArchive) * 100) : 0;
    const now = new Date();
    const staleDays = 20;
    const stale = active.filter(o => {
      const dates = [];
      (o.meetings || []).forEach(m => {
        if (m.fields && m.fields.Date) dates.push(m.fields.Date);
      });
      dates.sort((a, b) => b.localeCompare(a));
      const lastDate = dates[0] || '';
      if (!lastDate) {
        // no meetings: compare created date to now
        const created = o.created || '';
        if (!created) return true;
        const upd = new Date(created + 'T00:00:00');
        return (now - upd) / (1000 * 60 * 60 * 24) > staleDays;
      }
      const upd = new Date(lastDate + 'T00:00:00');
      return (now - upd) / (1000 * 60 * 60 * 24) > staleDays;
    });

    const stageCounts = {};
    const stages = ['Discovery', 'Proposal', 'Negotiation', 'Verbal Commit'];
    stages.forEach(s => stageCounts[s] = 0);
    opps.forEach(o => { if (stageCounts[o.stage] !== undefined) stageCounts[o.stage]++; else stageCounts[o.stage] = 1; });

    const recentActivity = [];
    opps.forEach(o => {
      o.meetings.forEach(m => recentActivity.push({ date: m.fields.Date || '', event: `Meeting: ${m.fields.Title || m.fields.Opportunity || ''}`, oppName: o.name, client: o.client }));
    });
    recentActivity.sort((a, b) => b.date.localeCompare(a.date));

    // Quarterly target calculation — compute per quarter
    const targetsPath = path.join(BASE_DIR, 'targets.md');
    const allTargets = parseTargetsMd(readFile(targetsPath));
    const nowQ = (() => { const d = new Date(); const q = Math.ceil((d.getMonth()+1)/3); return `${d.getFullYear()}-Q${q}`; })();
    const parseBudgetUSD = (b) => {
      if (!b || b === 'TBD') return 0;
      let v = parseFloat(b.replace(/[^0-9.]/g, '')) || 0;
      const u = (b.match(/[KkMm]$/)||[])[0];
      if (u) { if (u.toLowerCase()==='k') v *= 1000; else if (u.toLowerCase()==='m') v *= 1000000; }
      return v;
    };
    const budgetToQM = (b) => { const usd = parseBudgetUSD(b); return Math.round(usd * 3 / 1000000 * 10) / 10; };
    const quarterData = {};
    allTargets.forEach(t => { quarterData[t.quarter] = { target: t.amount, won: 0, pipeline: 0 }; });
    if (!quarterData[nowQ]) quarterData[nowQ] = { target: 0, won: 0, pipeline: 0 };
    // Archive won opps — budget is monthly, multiply by 3 for quarterly
    for (const a of archive.won) {
      const arcDir = path.join(BASE_DIR, '03-Archive', 'Won', a.year, a.client, a.folder);
      const oppMd = readFile(path.join(arcDir, 'Opportunity.md'));
      const tl = (oppMd.match(/^- \*\*Timeline:\*\*\s*(.*)/m)||[])[1]?.trim();
      if (tl && quarterData[tl]) { const b = (oppMd.match(/^- \*\*Budget:\*\*\s*(.*)/m)||[])[1]?.trim()||''; quarterData[tl].won += budgetToQM(b); }
    }
    // Active opps — budget is monthly, multiply by 3 for quarterly, no win rate
    active.forEach(o => {
      if (o.targetClose && quarterData[o.targetClose]) {
        const bQM = budgetToQM(o.budget || '');
        quarterData[o.targetClose].pipeline += bQM;
      }
    });
    Object.keys(quarterData).forEach(q => {
      quarterData[q].pipeline = Math.round(quarterData[q].pipeline * 10) / 10;
      quarterData[q].gap = Math.round((quarterData[q].target - quarterData[q].won - quarterData[q].pipeline) * 10) / 10;
    });

    return sendJson(res, {
      totalPipelineValue: totalValue,
      weightedPipelineValue: weightedValue,
      activeCount: active.length,
      wonCount: wonFromArchive,
      lostCount: lostFromArchive,
      winRate,
      staleCount: stale.length,
      stageCounts,
      recentActivity: recentActivity.slice(0, 20),
      opportunities: opps,
      clients,
      resources,
      archive,
      weeklyReports: listWeeklyReports(),
      quarterly: {
        current: nowQ,
        targets: allTargets,
        quarters: quarterData
      }
    });
  }

  // API: GET /api/opportunities
  if (method === 'GET' && pathname === '/api/opportunities') {
    const stageFilter = parsedUrl.query.stage;
    let opps = listOpportunities();
    if (stageFilter && stageFilter !== 'All') opps = opps.filter(o => o.stage === stageFilter);
    return sendJson(res, opps);
  }

  // API: POST /api/opportunities
  if (method === 'POST' && pathname === '/api/opportunities') {
    try {
      const body = await readBody(req);
      const client = sanitize(body.client || '');
      const name = sanitize(body.name || '');
      if (!client || !name) return sendJson(res, { error: 'Client and name required' }, 400);

      const allClients = listClients();
      const clientData = allClients.find(c => c.name === client);
      if (!clientData) return sendJson(res, { error: `Client "${client}" not found. Create the client first.` }, 400);
      const initStakeholders = (clientData.contacts||[]).map(c=>({name:c.name||'TBD',role:c.role||'TBD',influence:'Medium',attitude:'Neutral'}));

      const folder = `OPP-${String(listOpportunities().length + 1).padStart(3, '0')}-${client.replace(/\s+/g, '')}-${name.replace(/\s+/g, '')}`;
      const oppDir = path.join(BASE_DIR, '01-Opportunities', folder);
      if (fs.existsSync(oppDir)) return sendJson(res, { error: 'Opportunity already exists' }, 409);

      fs.mkdirSync(path.join(oppDir, 'Meetings'), { recursive: true });
      fs.writeFileSync(path.join(oppDir, 'Opportunity.md'), generateOpportunityMd(client, name, body.owner, body.budget, body.stage, body.targetClose, body.product, body.need, initStakeholders));

      return sendJson(res, { success: true, id: folder }, 201);
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: POST /api/opportunities/:id/meetings
  if (method === 'POST' && pathname.match(/^\/api\/opportunities\/(.+)\/meetings$/)) {
    try {
      const oppId = decodeURIComponent(pathname.match(/^\/api\/opportunities\/(.+)\/meetings$/)[1]);
      const body = await readBody(req);
      const meetDir = path.join(BASE_DIR, '01-Opportunities', oppId, 'Meetings');
      const oppMd = readFile(path.join(BASE_DIR, '01-Opportunities', oppId, 'Opportunity.md'));
      const oppParsed = parseOpportunityMd(oppMd);
      const filename = `${body.date || new Date().toISOString().split('T')[0]}-${sanitize(body.title || 'Meeting').replace(/\s+/g, '-')}.md`;
      fs.writeFileSync(path.join(meetDir, filename), generateMeetingMd(
        oppParsed.fields.Client, oppParsed.fields.Opportunity, body.title, body.date,
        body.attendees, body.venueType,
        body.agenda, body.requirements, body.questions, body.risks, body.actionItems,
        body.venueDetail
      ));
      return sendJson(res, { success: true, filename }, 201);
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: POST /api/opportunities/:id/briefings
  if (method === 'POST' && pathname.match(/^\/api\/opportunities\/([^/]+)\/briefings$/)) {
    try {
      const oppId = decodeURIComponent(pathname.match(/^\/api\/opportunities\/([^/]+)\/briefings$/)[1]);
      const body = await readBody(req);
      if (!body.content) return sendJson(res, { error: 'Missing briefing content' }, 400);
      const title = (body.title || 'Briefing').replace(/[^a-zA-Z0-9 -]/g, '').replace(/\s+/g, '-');
      const date = body.date || new Date().toISOString().split('T')[0];
      const filename = `Briefing-${date}-${title}.md`;
      const meetDir = path.join(BASE_DIR, '01-Opportunities', oppId, 'Meetings');
      try { fs.mkdirSync(meetDir, { recursive: true }); } catch {}
      fs.writeFileSync(path.join(meetDir, filename), body.content);
      return sendJson(res, { success: true, filename }, 201);
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: DELETE /api/opportunities/:id/briefings/:filename
  if (method === 'DELETE' && pathname.match(/^\/api\/opportunities\/([^/]+)\/briefings\/(Briefing-.+\.md)$/)) {
    try {
      const b = pathname.match(/^\/api\/opportunities\/([^/]+)\/briefings\/(Briefing-.+\.md)$/);
      const oppId = decodeURIComponent(b[1]);
      const filename = b[2];
      const filePath = path.join(BASE_DIR, '01-Opportunities', oppId, 'Meetings', filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return sendJson(res, { success: true });
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: PUT /api/opportunities/:id/meetings/:filename
  if (method === 'PUT' && pathname.match(/^\/api\/opportunities\/([^/]+)\/meetings\/(.+\.md)$/)) {
    try {
      const m = pathname.match(/^\/api\/opportunities\/([^/]+)\/meetings\/(.+\.md)$/);
      const oppId = decodeURIComponent(m[1]);
      const filename = decodeURIComponent(m[2]);
      const meetPath = path.join(BASE_DIR, '01-Opportunities', oppId, 'Meetings', filename);
      if (!fs.existsSync(meetPath)) return sendJson(res, { error: 'Meeting not found' }, 404);

      const body = await readBody(req);
      const content = readFile(meetPath);
      const parsed = parseMeetingMd(content);

      if (body.title !== undefined) parsed.fields.Title = body.title;
      if (body.date !== undefined) parsed.fields.Date = body.date;
      if (body.attendees !== undefined) parsed.fields.Attendees = body.attendees;
      if (body.venue !== undefined) parsed.fields.Venue = body.venue;
      if (body.agenda !== undefined) parsed.agenda = body.agenda;
      if (body.requirements !== undefined) parsed.requirements = body.requirements;
      if (body.questions !== undefined) parsed.questions = body.questions;
      if (body.risks !== undefined) parsed.risks = body.risks;
      if (body.actionItems !== undefined) parsed.actionItems = body.actionItems;

      fs.writeFileSync(meetPath, rebuildMeetingMd(parsed));
      return sendJson(res, { success: true });
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: POST /api/opportunities/:id/sync-contacts
  if (method === 'POST' && pathname.match(/^\/api\/opportunities\/([^/]+)\/sync-contacts$/)) {
    try {
      const oppId = decodeURIComponent(pathname.match(/^\/api\/opportunities\/([^/]+)\/sync-contacts$/)[1]);
      const oppDir = path.join(BASE_DIR, '01-Opportunities', oppId);
      const oppMdPath = path.join(oppDir, 'Opportunity.md');
      if (!fs.existsSync(oppMdPath)) return sendJson(res, { error: 'Opportunity not found' }, 404);

      const parsed = parseOpportunityMd(readFile(oppMdPath));
      const clientName = parsed.fields.Client || '';
      const clientData = listClients().find(c => c.name === clientName);
      if (!clientData) return sendJson(res, { error: 'Client not found' }, 404);

      const contacts = clientData.contacts || [];
      const existingNames = new Set((parsed.stakeholders||[]).map(s=>s.name).filter(n=>n!=='TBD'));
      const newStakeholders = contacts
        .filter(c => !existingNames.has(c.name))
        .map(c => ({name: c.name||'TBD', role: c.role||'TBD', influence: 'Medium', attitude: 'Neutral'}));

      const cleanedStakeholders = (parsed.stakeholders||[]).filter(s=>s.name!=='TBD'||s.role!=='TBD');
      if (newStakeholders.length > 0 || cleanedStakeholders.length < (parsed.stakeholders||[]).length) {
        parsed.stakeholders = [...cleanedStakeholders, ...newStakeholders];
        if(parsed.stakeholders.length===0 && contacts.length===0){
          parsed.stakeholders=[{name:'TBD',role:'TBD',influence:'TBD',attitude:'TBD'}];
        }
        parsed.fields.Updated = new Date().toISOString().split('T')[0];
        fs.writeFileSync(oppMdPath, rebuildOpportunityMd(parsed));
      }

      return sendJson(res, { success: true, added: newStakeholders.length, total: parsed.stakeholders.length });
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: PUT /api/opportunities/:id (generic — comes after all specific sub-routes)
  if (method === 'PUT' && pathname.match(/^\/api\/opportunities\/([^/]+)$/)) {
    try {
      const oppId = decodeURIComponent(pathname.match(/^\/api\/opportunities\/([^/]+)$/)[1]);
      const body = await readBody(req);
      const oppDir = path.join(BASE_DIR, '01-Opportunities', oppId);
      const oppMdPath = path.join(oppDir, 'Opportunity.md');
      if (!fs.existsSync(oppMdPath)) return sendJson(res, { error: 'Opportunity not found' }, 404);

      const content = readFile(oppMdPath);
      const parsed = parseOpportunityMd(content);

      if (body.stage) {
        const prevStage = parsed.fields.Stage;
        parsed.fields.Stage = body.stage;
        if (body.stage !== prevStage) {
          const today = new Date().toISOString().split('T')[0];
          if (!parsed.stageHistory) parsed.stageHistory = [];
          parsed.stageHistory.push({ stage: body.stage, date: today });
        }
      }
      if (body.budget) parsed.fields.Budget = body.budget;
      if (body.need) parsed.fields.Need = body.need;
      if (body.targetClose) parsed.fields.Timeline = body.targetClose;
      if (body.product) parsed.fields.Product = body.product;
      if (body.nextAction !== undefined) parsed.fields['Next Action'] = body.nextAction;
      if (body.nextActionDue !== undefined || body.nextActionStatus !== undefined) {
        const raw = parsed.fields['Next Action'] || '';
        const desc = raw.replace(/\s*—\s*by\s*\d{4}-\d{2}-\d{2}/, '').replace(/\s*—\s*\[(Planned|In Progress|Done)\]/, '').trim();
        const due = body.nextActionDue !== undefined ? body.nextActionDue : (raw.match(/by\s*(\d{4}-\d{2}-\d{2})/)?.[1] || '');
        const status = body.nextActionStatus !== undefined ? body.nextActionStatus : (raw.match(/—\s*\[(Planned|In Progress|Done)\]/)?.[1] || 'Planned');
        let na = desc;
        if (due) na += ` — by ${due}`;
        na += ` — [${status}]`;
        parsed.fields['Next Action'] = na;
      }
      if (body.notes !== undefined) parsed.notes = body.notes;
      if (body.stakeholders) parsed.stakeholders = body.stakeholders;

      fs.writeFileSync(oppMdPath, rebuildOpportunityMd(parsed));

      if (body.stage === 'Won' || body.stage === 'Lost') {
        const year = new Date().getFullYear();
        const resultType = body.stage;
        const client = parsed.fields.Client || 'Unknown';
        const archiveReason = body.archiveReason || '';
        const archiveDir = path.join(BASE_DIR, '03-Archive', resultType, String(year), client);
        fs.mkdirSync(archiveDir, { recursive: true });
        const destPath = path.join(archiveDir, oppId);
        if (!fs.existsSync(destPath)) {
          fs.renameSync(oppDir, destPath);
          const reasonSection = archiveReason
            ? `\n**${resultType === 'Won' ? 'Win' : 'Loss'} Reason:** ${archiveReason}\n`
            : '\n';
          fs.writeFileSync(path.join(destPath, 'Archive-Summary.md'),
            `# Archive - ${client} ${parsed.fields.Opportunity}\n\n**Closed:** ${new Date().toISOString().split('T')[0]}\n**Result:** ${resultType}\n**Budget:** ${parsed.fields.Budget || 'N/A'}\n**Need:** ${parsed.fields.Need || 'N/A'}\n**Timeline:** ${parsed.fields.Timeline || 'N/A'}${reasonSection}\n## Summary\n${parsed.notes || 'N/A'}\n`);
        }
      }

      return sendJson(res, { success: true });
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: GET /api/resources
  if (method === 'GET' && pathname === '/api/resources') {
    return sendJson(res, listResources());
  }

  // API: POST /api/resources
  if (method === 'POST' && pathname === '/api/resources') {
    try {
      const body = await readBody(req);
      const category = sanitize(body.category || 'General');
      const title = sanitize(body.title || 'Resource');
      const content = body.content || '';
      const catDir = path.join(BASE_DIR, '02-Resources', category);
      fs.mkdirSync(catDir, { recursive: true });
      const filename = `${title.replace(/\s+/g, '-')}.md`;
      fs.writeFileSync(path.join(catDir, filename), content);
      return sendJson(res, { success: true, filename }, 201);
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: GET /api/archive
  if (method === 'GET' && pathname === '/api/archive') {
    return sendJson(res, listArchive());
  }

  // API: GET /api/archive/:result/:year/:client/:folder (single archived opp detail)
  if (method === 'GET' && pathname.match(/^\/api\/archive\/(Won|Lost)\/\d{4}\/[^/]+\/[^/]+$/)) {
    try {
      const parts = pathname.split('/');
      const resultType = parts[3], year = parts[4], client = decodeURIComponent(parts[5]), folder = decodeURIComponent(parts[6]);
      const oppDir = path.join(BASE_DIR, '03-Archive', resultType, year, client, folder);
      if (!fs.existsSync(oppDir)) return sendJson(res, { error: 'Not found' }, 404);
      const result = { folder, client, year, result: resultType };
      result.opportunity = readFile(path.join(oppDir, 'Opportunity.md'));
      result.summary = readFile(path.join(oppDir, 'Archive-Summary.md'));
      const meetingsDir = path.join(oppDir, 'Meetings');
      result.meetings = [];
      try {
        for (const f of readDir(meetingsDir).filter(f => f.endsWith('.md'))) {
          const content = readFile(path.join(meetingsDir, f));
          const parsed = parseMeetingMd(content);
          result.meetings.push({ filename: f, fields: parsed.fields, agenda: parsed.agenda, requirements: parsed.requirements, questions: parsed.questions, risks: parsed.risks, actionItems: parsed.actionItems, content });
        }
      } catch {}
      result.meetings.sort((a, b) => (b.fields?.Date || '').localeCompare(a.fields?.Date || ''));
      return sendJson(res, result);
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: GET /api/archive/:result/:year/:client (list opps under a client)
  if (method === 'GET' && pathname.match(/^\/api\/archive\/(Won|Lost)\/\d{4}\/[^/]+$/)) {
    try {
      const m = pathname.match(/^\/api\/archive\/(Won|Lost)\/(\d{4})\/(.+)$/);
      const resultType = m[1], year = m[2], client = decodeURIComponent(m[3]);
      const clientDir = path.join(BASE_DIR, '03-Archive', resultType, year, client);
      if (!fs.existsSync(clientDir)) return sendJson(res, [], 200);
      const opps = [];
      for (const folder of readDir(clientDir)) {
        const oppDir = path.join(clientDir, folder);
        try { if (!fs.statSync(oppDir).isDirectory()) continue; } catch { continue; }
        const summary = readFile(path.join(oppDir, 'Archive-Summary.md'));
        opps.push({ folder, client, year, result: resultType, content: summary });
      }
      return sendJson(res, opps);
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: GET /api/archive/:result/:year/:client/:folder
  if (method === 'GET' && pathname.match(/^\/api\/archive\/(Won|Lost)\/\d{4}\/.+\/.+$/)) {
    try {
      const parts = pathname.split('/');
      const resultType = parts[3], year = parts[4], client = decodeURIComponent(parts[5]), folder = decodeURIComponent(parts[6]);
      const oppDir = path.join(BASE_DIR, '03-Archive', resultType, year, client, folder);
      if (!fs.existsSync(oppDir)) return sendJson(res, { error: 'Not found' }, 404);
      const result = { folder, client, year, result: resultType };
      result.opportunity = readFile(path.join(oppDir, 'Opportunity.md'));
      result.summary = readFile(path.join(oppDir, 'Archive-Summary.md'));
      const meetingsDir = path.join(oppDir, 'Meetings');
      result.meetings = [];
      try {
        for (const f of readDir(meetingsDir).filter(f => f.endsWith('.md'))) {
          const content = readFile(path.join(meetingsDir, f));
          const parsed = parseMeetingMd(content);
          result.meetings.push({ filename: f, fields: parsed.fields, agenda: parsed.agenda, requirements: parsed.requirements, questions: parsed.questions, risks: parsed.risks, actionItems: parsed.actionItems, content });
        }
      } catch {}
      result.meetings.sort((a, b) => (b.fields?.Date || '').localeCompare(a.fields?.Date || ''));
      return sendJson(res, result);
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: GET /api/clients
  if (method === 'GET' && pathname === '/api/clients') {
    return sendJson(res, listClients());
  }

  // API: POST /api/clients
  if (method === 'POST' && pathname === '/api/clients') {
    try {
      const body = await readBody(req);
      const name = sanitize(body.name || '');
      if (!name) return sendJson(res, { error: 'Client name required' }, 400);

      const folder = `Client-${name.replace(/\s+/g, '')}`;
      const clientDir = path.join(BASE_DIR, '00-Clients', folder);
      if (fs.existsSync(clientDir)) return sendJson(res, { error: 'Client already exists' }, 409);

      fs.mkdirSync(clientDir, { recursive: true });
      fs.writeFileSync(path.join(clientDir, 'Client.md'), generateClientMd(name, body.industry, body.region, body.size, body.business));

      return sendJson(res, { success: true, id: folder }, 201);
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: PUT /api/clients/:name
  if (method === 'PUT' && pathname.match(/^\/api\/clients\/(.+)$/)) {
    try {
      const clientId = decodeURIComponent(pathname.match(/^\/api\/clients\/(.+)$/)[1]);
      const body = await readBody(req);
      const clientMdPath = path.join(BASE_DIR, '00-Clients', clientId, 'Client.md');
      if (!fs.existsSync(clientMdPath)) return sendJson(res, { error: 'Client not found' }, 404);

      const content = readFile(clientMdPath);
      const parsed = parseClientMd(content);

      if (body.industry) parsed.fields.Industry = body.industry;
      if (body.region) parsed.fields.Region = body.region;
      if (body.size) parsed.fields.Size = body.size;
      if (body.business !== undefined) parsed.fields.Business = body.business;
      if (body.contacts) parsed.contacts = body.contacts;
      if (body.notes !== undefined) parsed.notes = body.notes;

      fs.writeFileSync(clientMdPath, rebuildClientMd(parsed));

      return sendJson(res, { success: true });
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: GET /api/weekly-reports
  if (method === 'GET' && pathname === '/api/weekly-reports') {
    return sendJson(res, listWeeklyReports());
  }

  // API: POST /api/weekly-reports
  if (method === 'POST' && pathname === '/api/weekly-reports') {
    try {
      const body = await readBody(req);
      const startDate = body.startDate || new Date().toISOString().split('T')[0];
      const endDate = body.endDate || startDate;
      if (!startDate || !endDate) return sendJson(res, { error: 'Start and end date required' }, 400);

      const opps = listOpportunities();
      const archivedWon = listArchive().won;
      const content = generateWeeklyReportMd(startDate, endDate, opps, archivedWon);

      const reportDir = path.join(BASE_DIR, '02-WeeklyReports');
      fs.mkdirSync(reportDir, { recursive: true });
      const filename = `Weekly Report - ${startDate} ~ ${endDate}.md`;
      fs.writeFileSync(path.join(reportDir, filename), content);

      return sendJson(res, { success: true, filename }, 201);
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // API: PUT /api/targets
  if (method === 'PUT' && pathname === '/api/targets') {
    try {
      const body = await readBody(req);
      const targets = body.targets || [];
      for (const t of targets) {
        sanitize(t.quarter || '');
        if (typeof t.amount !== 'number' || t.amount < 0) return sendJson(res, { error: 'Invalid target amount' }, 400);
      }
      fs.writeFileSync(path.join(BASE_DIR, 'targets.md'), generateTargetsMd(targets));
      return sendJson(res, { success: true });
    } catch (e) { return sendJson(res, { error: e.message }, 400); }
  }

  // 404
  return sendJson(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  console.log(`Sales Opportunities Management server running at http://localhost:${PORT}`);
});
