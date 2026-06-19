## 2026-06-16 - [ListHeaderComponent React Element Memory Leak]
**Learning:** [Defining a React Element for \`ListHeaderComponent\` directly inside the parent render loop without memoization causes the `FlatList` to unmount and remount the header entirely on every parent re-render (like keystrokes in a search input). This also forces the \`FlatList\` internal layout mechanics to recalculate.]
**Action:** [Always wrap \`ListHeaderComponent\` elements defined inside functional components with \`useMemo\`, or extract them into separate memoized components outside the main render loop.]
