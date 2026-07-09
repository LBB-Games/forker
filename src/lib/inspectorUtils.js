export function diffContextLineCount(preferences = {}) {
  const value = Number.parseInt(String(preferences.diffContextLines ?? '3'), 10);
  return Number.isFinite(value) ? Math.max(0, Math.min(20, value)) : 3;
}

export function diffRowsToText(rows = []) {
  return rows.map((row) => row?.text ?? '').join('\n');
}

export function shortHash(value = '') {
  return String(value || '').slice(0, 8);
}

export function lineStatsFromRows(rows = []) {
  return rows.reduce((totals, row) => {
    if (row?.type === 'add') totals.additions += 1;
    if (row?.type === 'remove') totals.deletions += 1;
    if (row?.type === 'hunk') totals.hunks += 1;
    return totals;
  }, { additions: 0, deletions: 0, hunks: 0 });
}

export function statMeta(insertions = 0, deletions = 0) {
  return [
    { label: 'Additions', value: `+${insertions}`, tone: 'success' },
    { label: 'Deletions', value: `−${deletions}`, tone: 'danger' },
  ];
}

export function commitMetadataText(info) {
  if (!info) return '';
  return [
    `Commit: ${info.id}`,
    `Subject: ${info.subject}`,
    `Author: ${info.author}${info.authorEmail ? ` <${info.authorEmail}>` : ''}`,
    `Date: ${info.date}`,
    `Parents: ${(info.parents ?? []).join(', ') || 'root commit'}`,
    `Files: ${info.files}`,
    `Stats: +${info.insertions} −${info.deletions}`,
  ].join('\n');
}

export function changedPathKey(file) {
  return `${file?.section ?? ''}:${file?.path ?? ''}:${file?.status ?? ''}`;
}

export function sameChangedFile(left, right) {
  return !!left && !!right && left.path === right.path && left.section === right.section && left.status === right.status;
}

export function statusSummary(file) {
  if (!file) return '';
  return [file.section, file.label, file.lines].filter(Boolean).join(' · ');
}

export function branchKindLabel(kind = '') {
  if (kind === 'local') return 'Local branch';
  if (kind === 'remote') return 'Remote branch';
  return 'Unknown ref';
}
