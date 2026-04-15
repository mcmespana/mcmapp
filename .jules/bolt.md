## Bolt's Journal
## 2024-04-11 - Missing memoization on large list filter
**Learning:** In React Native applications, filtering large arrays directly in the render method without `useMemo` (like filtering a large list of songs on every keystroke) causes performance issues, specifically UI thread lagging and unnecessary processing on every re-render.
**Action:** Use `useMemo` to memoize the result of computationally expensive array operations (like filtering or sorting) so they only run when their dependencies (e.g., search term or the original array) change. Also, move invariant logic (like `search.toLowerCase()`) outside of the filter loop.
## Array Performance
- Avoid using `Object.values().flatMap().find()` for simple lookups, as it allocates numerous intermediate arrays and closure functions. Instead, use nested `for...in` and `for` loops which provide significant performance gains.
## 2024-05-18 - Missing Set usage on array lookups
**Learning:** Using `Array.includes()` inside an array filter, especially on potentially large datasets (like `allSongsData`), causes O(N*M) time complexity. Also, managing derived state with `useState` and `useEffect` creates unnecessary cascading re-renders in React Native.
**Action:** Convert arrays to `Set` objects for O(1) `.has()` lookups before iterating/filtering. Replace chained `useState` and `useEffect` with `useMemo` for any state that can be synchronously derived from props or context.
