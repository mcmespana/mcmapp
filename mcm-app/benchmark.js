const { performance } = require('perf_hooks');

// Setup mock data
const allSongsData = {};
for (let i = 0; i < 50; i++) {
  const songs = [];
  for (let j = 0; j < 100; j++) {
    songs.push({ filename: `song_${i}_${j}.cho`, title: `Song ${i} ${j}` });
  }
  allSongsData[`cat_${i}`] = { categoryTitle: `Cat ${i}`, songs };
}
const songToFind = { filename: 'song_49_99.cho' };

// 1. FlatMap Approach (The original issue)
function flatMapApproach() {
  return Object.values(allSongsData)
    .flatMap((cat) => cat.songs)
    .find((s) => s.filename === songToFind.filename);
}

// 2. Object.values + find Approach (Current codebase state)
function objectValuesFindApproach() {
  let completeSong;
  for (const cat of Object.values(allSongsData)) {
    completeSong = cat.songs.find((s) => s.filename === songToFind.filename);
    if (completeSong) break;
  }
  return completeSong;
}

// 3. Nested Loop Approach (Zero allocation, optimal search)
function nestedLoopApproach() {
  let completeSong;
  for (const key in allSongsData) {
    if (Object.prototype.hasOwnProperty.call(allSongsData, key)) {
      const songs = allSongsData[key].songs;
      for (let i = 0; i < songs.length; i++) {
        if (songs[i].filename === songToFind.filename) {
          completeSong = songs[i];
          break;
        }
      }
    }
    if (completeSong) break;
  }
  return completeSong;
}

const iterations = 10000;

function runBenchmark(name, fn) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  console.log(`${name}: ${(end - start).toFixed(2)} ms`);
}

console.log('--- Benchmarking handleSongPress lookup (10,000 iterations) ---');
runBenchmark('FlatMap Approach (Baseline)', flatMapApproach);
runBenchmark('Object.values + find', objectValuesFindApproach);
runBenchmark('Nested Loop (Optimized)', nestedLoopApproach);
