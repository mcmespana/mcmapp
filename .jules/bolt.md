## 2024-05-03 - [List Performance] Schwartzian transforms and memoization
**Learning:** For screens rendering lists of objects that must be sorted or filtered based on combined or mutated string properties (e.g., lowercasing title and author), performing these string operations inside the filter loop causes O(N) operations on *every keystroke* and triggers thousands of unnecessary garbage collections.
**Action:** When filtering large datasets against user input, pre-compute a single `searchableText` string on the objects during the initial data load mapping phase. Then, simply perform an `.includes()` check against that pre-computed string during the filter loop.

## 2024-05-03 - [React Native Performance] FlatList virtualization props
**Learning:** Default FlatList virtualization can result in rendering too many items upfront, delaying the initial render. Furthermore, passing an inline `renderItem` function causes new function references on every render, which can defeat `React.memo` on list items.
**Action:** Always provide `initialNumToRender`, `maxToRenderPerBatch`, and `windowSize` props to FlatLists rendering complex items. Wrap the `renderItem` function in `useCallback` to preserve function references and ensure list items wrapped in `React.memo` actually benefit from memoization.
## 2024-05-04 - [React Native Performance] FlatList header unmounting
**Learning:** Defining a functional component for a `FlatList` header *inside* the parent component's scope (e.g., `const ListHeader = () => ...`) causes the header's component type reference to change on every parent render. This forces React to completely unmount and remount the header element, triggering unnecessary garbage collection, losing state (like input focus), and degrading scroll performance.
**Action:** Always either define sub-components outside the parent scope, or memoize the rendered JSX element using `useMemo` (e.g., `const listHeaderComponent = useMemo(() => (...), [...])`) before passing it to `ListHeaderComponent`.

## 2026-05-24 - [React Native Context Performance] Avoid context consumption deep in list items
**Learning:** Consuming context (e.g., `useSelectedSongs()`) inside list item components (like `SongListItem`) completely defeats `React.memo`. When the context changes (e.g. a user adds a song to the list), *every single item* in the `FlatList` re-renders, causing an O(N) performance bottleneck for simple list interactions.
**Action:** Keep list item components pure. Extract context consumption to the parent list component (e.g., `SongListScreen`) and pass only the necessary scalar values or stable callbacks down to the list items via props. This allows `React.memo` to successfully prevent re-renders for the N-1 untouched items.
## 2026-05-29 - [JS Performance] Array pushing vs concatenation in loops
**Learning:** In JavaScript loops, using `array = array.concat(newItems)` creates a new array in memory on every iteration, leading to O(N²) memory allocations and triggering excessive garbage collection pauses.
**Action:** Replace `concat` in loops with `array.push(...newItems)` to mutate the existing array in-place, achieving O(N) performance.

## 2026-05-29 - [React Anti-Pattern] Context stability via refs
**Learning:** Attempting to stabilize Context callback functions (like `isSongSelected`) by reading from a mutable `useRef` that is updated via `useEffect` is a dangerous anti-pattern. It guarantees that any components consuming the context will read stale state during the render cycle immediately following an update.
**Action:** Accept that Context functions relying on changing state must change references. If list items are re-rendering excessively, extract the context consumption to a parent component and pass scalar values as props, relying on `React.memo` to prevent unnecessary component updates.
## 2024-05-30 - [Array Performance] Chained array methods on unbounded sets
**Learning:** Using chained array methods (like `.entries().filter().sort().forEach()`) to find a limited subset of items (e.g. top N events) forces iteration over the *entire dataset* multiple times, bypassing the possibility of an early exit.
**Action:** When a function only needs to extract a limited number of items from a large list or dictionary, replace array chains with a native `for...of` or `for...in` loop that includes an explicit `if (condition) break;` or `return` statement to stop processing as soon as the limit is met.
## 2024-05-31 - [React Native Performance] Extracting List Item Render Functions
**Learning:** Defining inline `renderItem` functions directly within `FlatList` component props creates new closures on every render of the parent component. Even worse, passing inline closures as event handlers (e.g. `onPress={() => doSomething(item)}`) inside `renderItem` generates new function references for each item. This completely defeats `React.memo` for the list items, causing the entire list to re-render when unrelated state in the parent changes (like search query updates).
**Action:** Always extract `renderItem` functions into `useCallback` hooks. Furthermore, ensure list item components accept stable callback functions and pass the `item` context back up (e.g., `onPress={doSomething}` instead of `onPress={() => doSomething(item)}`), updating the component definition to pass the correct arguments to the callback internally.
