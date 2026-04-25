## Bolt's Journal
## 2024-04-11 - Missing memoization on large list filter
**Learning:** In React Native applications, filtering large arrays directly in the render method without `useMemo` (like filtering a large list of songs on every keystroke) causes performance issues, specifically UI thread lagging and unnecessary processing on every re-render.
**Action:** Use `useMemo` to memoize the result of computationally expensive array operations (like filtering or sorting) so they only run when their dependencies (e.g., search term or the original array) change. Also, move invariant logic (like `search.toLowerCase()`) outside of the filter loop.
## Array Performance
- Avoid using `Object.values().flatMap().find()` for simple lookups, as it allocates numerous intermediate arrays and closure functions. Instead, use nested `for...in` and `for` loops which provide significant performance gains.
## 2024-04-24 - Unmemoized React Context & O(N) derived lookups in large list renderers
**Learning:** Contexts that manage arrays (like selected items) and are heavily consumed by large list renderers can cause severe performance bottlenecks if not optimized. If the context value is not memoized, any state change re-renders all consumers. More importantly, checking if an item is selected inside list items using `array.includes()` creates an O(N) operation per item, which scales poorly when rendering many components.
**Action:** Always memoize context values with `useMemo`, wrap provider functions with `useCallback`, and convert array states to a memoized `Set` inside the provider to expose an O(1) lookup method (e.g., `isItemSelected`) for consumers, especially those in FlatLists.
## 2024-05-18 - O(N*M) nested loops in Interaction Handlers for FlatList
**Learning:** Performing deeply nested loops (e.g., `Object.values().find()`) to retrieve associated item data within a UI interaction handler (like `onPress`) causes noticeable lag before the interaction starts, severely impacting the perceived responsiveness of the app.
**Action:** Use `useMemo` to pre-calculate and cache O(1) lookup maps (e.g., `Map<Id, Item>` and `Map<Id, Index>`) from the source data. Reference these maps inside a memoized (`useCallback`) interaction handler to achieve constant-time lookups and immediate UI response.
