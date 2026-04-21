## Bolt's Journal
## 2024-04-11 - Missing memoization on large list filter
**Learning:** In React Native applications, filtering large arrays directly in the render method without `useMemo` (like filtering a large list of songs on every keystroke) causes performance issues, specifically UI thread lagging and unnecessary processing on every re-render.
**Action:** Use `useMemo` to memoize the result of computationally expensive array operations (like filtering or sorting) so they only run when their dependencies (e.g., search term or the original array) change. Also, move invariant logic (like `search.toLowerCase()`) outside of the filter loop.
## Array Performance
- Avoid using `Object.values().flatMap().find()` for simple lookups, as it allocates numerous intermediate arrays and closure functions. Instead, use nested `for...in` and `for` loops which provide significant performance gains.
## 2025-02-12 - Context Memoization

**Learning:** When using React Context (like `SelectedSongsContext`), returning unmemoized arrays, values, and functions in the Provider's `value` prop will cause all consuming components to re-render every time the Provider's state changes. This is a common performance bottleneck, especially if consumers are part of large lists. Also, checking for inclusion in a large array using `.includes()` inside a frequently called function (like `isSongSelected`) is O(N) and can be optimized.
**Action:** Always memoize the context `value` object using `useMemo`, wrap context functions in `useCallback`, and consider converting array state to a `Set` (memoized via `useMemo`) for O(1) lookups in derived selection functions.
