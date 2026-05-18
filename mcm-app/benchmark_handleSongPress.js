const { performance } = require('perf_hooks');

// Generate large mock data
const allSongsData = {};
for (let i = 0; i < 50; i++) {
  const songs = [];
  for (let j = 0; j < 100; j++) {
    songs.push({
      filename: `song_${i}_${j}.cho`,
      title: `Song ${i} ${j}`,
      content: 'Hello world',
      originalCategoryKey: `cat_${i}`,
    });
  }
  allSongsData[`cat_${i}`] = {
    categoryTitle: `Category ${i}`,
    songs,
  };
}

const categorizedSelectedSongs = [
  {
    categoryTitle: 'Category 49',
    data: [allSongsData['cat_49'].songs[99]],
  },
];

const songToFind = allSongsData['cat_49'].songs[99];

// Current approach
function currentHandleSongPress(song) {
  let completeSong;
  for (const cat of Object.values(allSongsData)) {
    completeSong = cat.songs.find((s) => s.filename === song.filename);
    if (completeSong) break;
  }
  return completeSong;
}

// FlatMap approach (from the prompt)
function flatMapHandleSongPress(song) {
  return Object.values(allSongsData)
    .flatMap((cat) => cat.songs)
    .find((s) => s.filename === song.filename);
}

// Optimized approach (just using the song directly)
function optimizedHandleSongPress(song) {
  return song;
}

function runBenchmark(name, fn) {
  const iterations = 10000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn(songToFind);
  }
  const end = performance.now();
  console.log(
    `${name}: ${(end - start).toFixed(2)} ms for ${iterations} iterations`,
  );
}

console.log('--- Benchmark Results ---');
runBenchmark('FlatMap Approach (Prompt)', flatMapHandleSongPress);
runBenchmark('Current Approach (In codebase)', currentHandleSongPress);
runBenchmark('Optimized Approach (Direct use)', optimizedHandleSongPress);
