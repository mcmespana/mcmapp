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
