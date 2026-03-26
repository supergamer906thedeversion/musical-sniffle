const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = {
  window: { MediaHorde: {} },
  console,
  setTimeout,
  clearTimeout,
};
vm.createContext(context);

for (const file of ['assets/js/config.js', 'assets/js/utils.js', 'assets/js/playlist.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
}

const parser = context.window.MediaHorde.playlist.parsePlaylistText;

{
  const result = parser(`music/a.mp3\nmusic/a.mp3\ninvalid|title`);
  assert.equal(result.items.filter(item => item.path === 'music/a.mp3').length, 1, 'duplicate path should be dropped');
  assert.ok(result.diagnostics.duplicateEntries.length === 1, 'duplicate should be diagnosed');
}

{
  const result = parser('..\\escape.mp3');
  assert.equal(result.items.length, 0, 'parent path should be rejected');
  assert.ok(result.diagnostics.errors.length > 0, 'should emit error for malformed path');
}

console.log('playlist parser tests passed');
