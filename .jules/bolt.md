## Bolt's Journal
## 2024-04-11 - Missing memoization on large list filter
**Learning:** In React Native applications, filtering large arrays directly in the render method without `useMemo` (like filtering a large list of songs on every keystroke) causes performance issues, specifically UI thread lagging and unnecessary processing on every re-render.
**Action:** Use `useMemo` to memoize the result of computationally expensive array operations (like filtering or sorting) so they only run when their dependencies (e.g., search term or the original array) change. Also, move invariant logic (like `search.toLowerCase()`) outside of the filter loop.
## Array Performance
- Avoid using `Object.values().flatMap().find()` for simple lookups, as it allocates numerous intermediate arrays and closure functions. Instead, use nested `for...in` and `for` loops which provide significant performance gains.
## 2024-04-11 - Filtering against arrays\n**Learning:** When filtering large datasets and doing an `Array.includes()` check inside the filter loop, you inadvertently introduce an O(N*M) time complexity trap. \n**Action:** Convert the array being checked against into a `Set` before the filter loop. The `Set.has()` method provides O(1) lookup performance, reducing overall time complexity to O(N+M) and noticeably improving render/processing speeds for large collections.
