## 2024-05-03 - [List Performance] Schwartzian transforms and memoization
**Learning:** For screens rendering lists of objects that must be sorted or filtered based on combined or mutated string properties (e.g., lowercasing title and author), performing these string operations inside the filter loop causes O(N) operations on *every keystroke* and triggers thousands of unnecessary garbage collections.
**Action:** When filtering large datasets against user input, pre-compute a single `searchableText` string on the objects during the initial data load mapping phase. Then, simply perform an `.includes()` check against that pre-computed string during the filter loop.

## 2024-05-03 - [React Native Performance] FlatList virtualization props
**Learning:** Default FlatList virtualization can result in rendering too many items upfront, delaying the initial render. Furthermore, passing an inline `renderItem` function causes new function references on every render, which can defeat `React.memo` on list items.
**Action:** Always provide `initialNumToRender`, `maxToRenderPerBatch`, and `windowSize` props to FlatLists rendering complex items. Wrap the `renderItem` function in `useCallback` to preserve function references and ensure list items wrapped in `React.memo` actually benefit from memoization.

## 2024-05-07 - [React Performance] Inline Component Definitions Anti-pattern
**Learning:** Defining a functional component inside another component's scope (e.g., `const ListHeader = () => ...` inside `SongListScreen`) creates a new component type on every render. This forces React to completely unmount and remount the DOM subtree instead of simply updating it, destroying local state like input focus and harming performance, especially in `FlatList` headers.
**Action:** Never define components inside other components. Either extract the component to the module scope and pass props, or, if it heavily relies on local state, simply render it as a memoized JSX element (`const listHeader = useMemo(() => <View>...</View>, [...])`) and pass that element directly (e.g., `ListHeaderComponent={listHeader}`).
