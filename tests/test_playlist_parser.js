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

{
  const result = parser('music\\\\track.mp3 | title="Quoted Title" | type=unknown | added=2026-01-02T03:04:05Z');
  assert.equal(result.items[0].path, 'music/track.mp3', 'slashes should normalize');
  assert.equal(result.items[0].title, 'Quoted Title', 'quoted metadata should parse');
  assert.equal(result.items[0].type, 'other', 'unsupported types should fallback to other');
  assert.ok(result.items[0].addedAt > 0, 'added date should parse to epoch');
}

{
  const result = parser('music/song.mp3\nMUSIC/song.mp3');
  assert.equal(result.items.length, 1, 'duplicate paths should be case-insensitive');
}

{
  const result = parser('music/song.mp3 | cover=art/custom.png');
  assert.equal(result.items[0].artPath, 'art/custom.png', 'cover metadata should take precedence');
  assert.equal(result.items[0].artCandidates[0], 'art/custom.png', 'explicit cover should be first candidate');
}

console.log('playlist parser tests passed');
