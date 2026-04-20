## Bolt's Journal
## 2024-04-11 - Missing memoization on large list filter
**Learning:** In React Native applications, filtering large arrays directly in the render method without `useMemo` (like filtering a large list of songs on every keystroke) causes performance issues, specifically UI thread lagging and unnecessary processing on every re-render.
**Action:** Use `useMemo` to memoize the result of computationally expensive array operations (like filtering or sorting) so they only run when their dependencies (e.g., search term or the original array) change. Also, move invariant logic (like `search.toLowerCase()`) outside of the filter loop.
## Array Performance
- Avoid using `Object.values().flatMap().find()` for simple lookups, as it allocates numerous intermediate arrays and closure functions. Instead, use nested `for...in` and `for` loops which provide significant performance gains.
## 2024-04-20 - React Context Memoization and O(1) Lookups for Large Lists
**Learning:** In a React Context heavily consumed by large list renderers (e.g., `SelectedSongsContext` used in `SongListScreen`), failing to memoize the context `value` and its functions causes unnecessary re-renders across all consumers on every state change. Additionally, derived state lookups like `isSongSelected` become a major O(N) bottleneck when using array `.includes()` on large collections during list rendering or keystroke events.
**Action:** Always memoize the context `value` with `useMemo` and context functions with `useCallback`. Convert array states to a memoized `Set` for derived O(1) lookups instead of using array `.includes()`, especially on critical performance paths.
