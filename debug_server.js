const { spawnSync } = require('child_process');
const result = spawnSync('node', ['web/server/server.js'], { encoding: 'utf-8' });
console.log("STDOUT:", result.stdout);
console.log("STDERR:", result.stderr);
