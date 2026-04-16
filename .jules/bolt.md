## Bolt's Journal
## 2024-04-11 - Missing memoization on large list filter
**Learning:** In React Native applications, filtering large arrays directly in the render method without `useMemo` (like filtering a large list of songs on every keystroke) causes performance issues, specifically UI thread lagging and unnecessary processing on every re-render.
**Action:** Use `useMemo` to memoize the result of computationally expensive array operations (like filtering or sorting) so they only run when their dependencies (e.g., search term or the original array) change. Also, move invariant logic (like `search.toLowerCase()`) outside of the filter loop.
## Array Performance
- Avoid using `Object.values().flatMap().find()` for simple lookups, as it allocates numerous intermediate arrays and closure functions. Instead, use nested `for...in` and `for` loops which provide significant performance gains.
## 2024-05-18 - [Optimization] Array vs Set Lookups in nested loops
**Learning:** React native code frequently loops over datasets, and performing `Array.prototype.includes` checks inside `Array.prototype.filter` or `Array.prototype.forEach` causes O(N*M) time complexity. Using `Array.includes()` for an array lookup inside loops is a common source of performance bottlenecks in large lists (like song libraries).
**Action:** When filtering or iterating over a list based on an array of identifiers, convert the array of identifiers into a `Set` before the loop and use `Set.has()` to ensure O(N+M) time complexity.
