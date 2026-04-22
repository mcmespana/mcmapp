## Bolt's Journal
## 2024-04-11 - Missing memoization on large list filter
**Learning:** In React Native applications, filtering large arrays directly in the render method without `useMemo` (like filtering a large list of songs on every keystroke) causes performance issues, specifically UI thread lagging and unnecessary processing on every re-render.
**Action:** Use `useMemo` to memoize the result of computationally expensive array operations (like filtering or sorting) so they only run when their dependencies (e.g., search term or the original array) change. Also, move invariant logic (like `search.toLowerCase()`) outside of the filter loop.
## Array Performance
- Avoid using `Object.values().flatMap().find()` for simple lookups, as it allocates numerous intermediate arrays and closure functions. Instead, use nested `for...in` and `for` loops which provide significant performance gains.
## 2024-04-22 - Missing memoization on React Contexts consumed by large lists
**Learning:** In React Native applications, Contexts that are heavily consumed by large lists (like `SelectedSongsContext` in `SongListScreen`) can cause severe performance bottlenecks and widespread `O(N)` re-renders if their provider value or array methods are not memoized. Even minor state changes can trigger a cascading re-render of hundreds of `SongListItem` components. Furthermore, checking an array for existence using `Array.includes()` within the list item's render cycle creates an O(N) lookup.
**Action:** Always memoize the context `value` prop with `useMemo`, wrap provider methods with `useCallback`, and convert underlying array states to a `Set` via `useMemo` for O(1) derived lookups to prevent cascading re-renders and unnecessary CPU cycles.
