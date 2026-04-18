## Bolt's Journal
## 2024-04-11 - Missing memoization on large list filter
**Learning:** In React Native applications, filtering large arrays directly in the render method without `useMemo` (like filtering a large list of songs on every keystroke) causes performance issues, specifically UI thread lagging and unnecessary processing on every re-render.
**Action:** Use `useMemo` to memoize the result of computationally expensive array operations (like filtering or sorting) so they only run when their dependencies (e.g., search term or the original array) change. Also, move invariant logic (like `search.toLowerCase()`) outside of the filter loop.
## Array Performance
- Avoid using `Object.values().flatMap().find()` for simple lookups, as it allocates numerous intermediate arrays and closure functions. Instead, use nested `for...in` and `for` loops which provide significant performance gains.
## 2024-11-20 - O(N*M) Lookup in Array Filtering
**Learning:** Checking for item existence inside a `.filter` block over a large list using `Array.includes` on another array leads to O(N * M) time complexity and measurable lag.
**Action:** Before filtering, always convert the array of selected items into a `Set` and use `Set.has()` for O(1) lookups, bringing complexity down to O(N + M). Always run local micro-benchmarks or check React Profiler to verify the bottleneck.
