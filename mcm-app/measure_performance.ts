const data = {
  cat1: {
    songs: Array.from({ length: 1000 }, (_, i) => ({
      filename: `song_1_${i}`,
    })),
  },
  cat2: {
    songs: Array.from({ length: 1000 }, (_, i) => ({
      filename: `song_2_${i}`,
    })),
  },
  cat3: {
    songs: Array.from({ length: 1000 }, (_, i) => ({
      filename: `song_3_${i}`,
    })),
  },
  cat4: {
    songs: Array.from({ length: 1000 }, (_, i) => ({
      filename: `song_4_${i}`,
    })),
  },
  cat5: {
    songs: Array.from({ length: 1000 }, (_, i) => ({
      filename: `song_5_${i}`,
    })),
  },
};

const searchFor = 'song_5_999';

// Method 1: flatMap + find
console.time('flatMap + find');
for (let i = 0; i < 1000; i++) {
  const completeSong = Object.values(data)
    .flatMap((cat) => cat.songs)
    .find((s) => s.filename === searchFor);
}
console.timeEnd('flatMap + find');

// Method 2: nested loop
console.time('nested loop');
for (let i = 0; i < 1000; i++) {
  let completeSong;
  for (const cat of Object.values(data)) {
    for (const s of cat.songs) {
      if (s.filename === searchFor) {
        completeSong = s;
        break;
      }
    }
    if (completeSong) break;
  }
}
console.timeEnd('nested loop');
