// In a .d.ts file (e.g., global.d.ts or assets.d.ts)
declare module '*.json' {
  const value: any;
  export default value;
}
