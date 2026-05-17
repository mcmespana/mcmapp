const { performance } = require('perf_hooks');

const allSongsData = {};
for (let i = 0; i < 50; i++) {
  const songs = [];
  for (let j = 0; j < 100; j++) {
    songs.push({ filename: `song_${i}_${j}.cho` });
  }
  allSongsData[`cat_${i}`] = { songs };
}
const songToFind = { filename: 'song_49_99.cho' };

function currentLoop(song) {
  let completeSong;
  for (const cat of Object.values(allSongsData)) {
    completeSong = cat.songs.find((s) => s.filename === song.filename);
    if (completeSong) break;
  }
  return completeSong;
}

function optimizedLoop(song) {
  let completeSong;
  for (const catKey in allSongsData) {
    const songs = allSongsData[catKey].songs;
    for (let i = 0; i < songs.length; i++) {
      if (songs[i].filename === song.filename) {
        completeSong = songs[i];
        break;
      }
    }
    if (completeSong) break;
  }
  return completeSong;
}

function veryOptimized(song) {
  return song; // Just return song because it's already the same reference!
}

const iterations = 100000;
let start = performance.now();
for (let i = 0; i < iterations; i++) currentLoop(songToFind);
console.log(`Current: ${(performance.now() - start).toFixed(2)} ms`);

start = performance.now();
for (let i = 0; i < iterations; i++) optimizedLoop(songToFind);
console.log(`Optimized loop: ${(performance.now() - start).toFixed(2)} ms`);
