## 2024-05-03 - [List Performance] Schwartzian transforms and memoization
**Learning:** For screens rendering lists of objects that must be sorted or filtered based on combined or mutated string properties (e.g., lowercasing title and author), performing these string operations inside the filter loop causes O(N) operations on *every keystroke* and triggers thousands of unnecessary garbage collections.
**Action:** When filtering large datasets against user input, pre-compute a single `searchableText` string on the objects during the initial data load mapping phase. Then, simply perform an `.includes()` check against that pre-computed string during the filter loop.

## 2024-05-03 - [React Native Performance] FlatList virtualization props
**Learning:** Default FlatList virtualization can result in rendering too many items upfront, delaying the initial render. Furthermore, passing an inline `renderItem` function causes new function references on every render, which can defeat `React.memo` on list items.
**Action:** Always provide `initialNumToRender`, `maxToRenderPerBatch`, and `windowSize` props to FlatLists rendering complex items. Wrap the `renderItem` function in `useCallback` to preserve function references and ensure list items wrapped in `React.memo` actually benefit from memoization.

## 2024-05-12 - [FlatList Performance] Memoizing Render Props and Headers
**Learning:** Defining inline functional components (like `ListHeader = () => ...`) within a parent component's render scope and passing them to `FlatList.ListHeaderComponent` causes the header to be unmounted and remounted entirely on every render. Additionally, an inline `renderItem` function breaks `React.memo` for list items.
**Action:** Extract list headers outside the component or convert them to stable memoized elements using `useMemo`. Always wrap `renderItem` functions with `useCallback` to maintain referential stability.
