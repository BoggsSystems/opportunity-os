const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const typesPath = path.join(root, 'src', 'types.ts');
const appPath = path.join(root, 'src', 'App.tsx');

const typesSource = fs.readFileSync(typesPath, 'utf8');
const appSource = fs.readFileSync(appPath, 'utf8');

const canvasTypeMatch = typesSource.match(/export type CanvasAction =([\s\S]*?);/);
if (!canvasTypeMatch) {
  throw new Error('CanvasAction type was not found in src/types.ts');
}

const actions = Array.from(canvasTypeMatch[1].matchAll(/'([^']+)'/g)).map((match) => match[1]);
const missingRenderBranches = actions.filter((action) => {
  if (action === 'idle') return !appSource.includes("props.view.action === 'idle'");
  return !appSource.includes(`props.view.action === '${action}'`);
});

if (missingRenderBranches.length > 0) {
  throw new Error(`Missing Canvas render branches: ${missingRenderBranches.join(', ')}`);
}

const requiredHelpers = [
  'CanvasActionSummary',
  'CanvasEmptyState',
  'CycleTimeline',
  'actionFromMode',
];
const missingHelpers = requiredHelpers.filter((helper) => !appSource.includes(helper));
if (missingHelpers.length > 0) {
  throw new Error(`Missing Canvas helper coverage: ${missingHelpers.join(', ')}`);
}

console.log(JSON.stringify({
  ok: true,
  canvasActionsCovered: actions,
}, null, 2));
