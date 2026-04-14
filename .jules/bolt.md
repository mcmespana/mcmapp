## Bolt's Journal
## 2024-04-11 - Missing memoization on large list filter
**Learning:** In React Native applications, filtering large arrays directly in the render method without `useMemo` (like filtering a large list of songs on every keystroke) causes performance issues, specifically UI thread lagging and unnecessary processing on every re-render.
**Action:** Use `useMemo` to memoize the result of computationally expensive array operations (like filtering or sorting) so they only run when their dependencies (e.g., search term or the original array) change. Also, move invariant logic (like `search.toLowerCase()`) outside of the filter loop.
## Array Performance
- Avoid using `Object.values().flatMap().find()` for simple lookups, as it allocates numerous intermediate arrays and closure functions. Instead, use nested `for...in` and `for` loops which provide significant performance gains.
## 2024-04-11 - Selected Songs List O(N*M) complexity
**Learning:** Derived state in functional components () shouldn't use  and  as it forces a double render. Furthermore, using  inside a large array  results in O(N*M) complexity, freezing the UI thread when selecting/unselecting songs.
**Action:** Use  for computationally derived state and transform arrays into s for O(1) lookups when filtering.
## 2024-04-11 - Selected Songs List O(N*M) complexity
**Learning:** Derived state in functional components (`categorizedSelectedSongs`) shouldn't use `useEffect` and `useState` as it forces a double render. Furthermore, using `Array.includes` inside a large array `.filter` results in O(N*M) complexity, freezing the UI thread when selecting/unselecting songs.
**Action:** Use `useMemo` for computationally derived state and transform arrays into `Set`s for O(1) lookups when filtering.
