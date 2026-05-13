## 2024-05-03 - [List Performance] Schwartzian transforms and memoization
**Learning:** For screens rendering lists of objects that must be sorted or filtered based on combined or mutated string properties (e.g., lowercasing title and author), performing these string operations inside the filter loop causes O(N) operations on *every keystroke* and triggers thousands of unnecessary garbage collections.
**Action:** When filtering large datasets against user input, pre-compute a single `searchableText` string on the objects during the initial data load mapping phase. Then, simply perform an `.includes()` check against that pre-computed string during the filter loop.

## 2024-05-03 - [React Native Performance] FlatList virtualization props
**Learning:** Default FlatList virtualization can result in rendering too many items upfront, delaying the initial render. Furthermore, passing an inline `renderItem` function causes new function references on every render, which can defeat `React.memo` on list items.
**Action:** Always provide `initialNumToRender`, `maxToRenderPerBatch`, and `windowSize` props to FlatLists rendering complex items. Wrap the `renderItem` function in `useCallback` to preserve function references and ensure list items wrapped in `React.memo` actually benefit from memoization.

## 2024-05-13 - [React Performance] Inner component anti-pattern
**Learning:** Defining React functional components inside other component render scopes (e.g., `const ListHeader = () => <View>...</View>`) forces React to see the inner component as a completely new type on every render. This causes React to completely unmount and remount the element rather than reconciling it, destroying local state (such as input focus) and causing significant re-render performance jank.
**Action:** When a piece of UI needs to be rendered dynamically but relies on closure variables, instead of creating an inner component, use `useMemo` to memoize the returned JSX element (e.g., `const listHeaderElement = useMemo(() => <View>...</View>, [deps])`).
