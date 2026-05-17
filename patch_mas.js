const fs = require('fs');
const path = 'mcm-app/app/(tabs)/mas.tsx';
let content = fs.readFileSync(path, 'utf8');

// Import useNavigation
if (!content.includes("import { useNavigation }")) {
  content = content.replace("import { View, Platform } from 'react-native';", "import { View, Platform } from 'react-native';\nimport { useNavigation } from 'expo-router';");
}

// Ensure useEffect is imported
if (!content.includes("useEffect")) {
  content = content.replace("import React, { useState, useRef }", "import React, { useState, useRef, useEffect }");
}

const tabPressEffect = `
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.getParent()?.addListener('tabPress' as any, (e: any) => {
      if (stackNavRef.current?.canGoBack()) {
        e.preventDefault?.();
        stackNavRef.current.popToTop();
      }
    });

    return unsubscribe;
  }, [navigation]);
`;

if (!content.includes("navigation.getParent()?.addListener('tabPress'")) {
  content = content.replace(
    "  const stackNavRef = useRef<any>(null);\n",
    "  const stackNavRef = useRef<any>(null);\n" + tabPressEffect + "\n"
  );
}

fs.writeFileSync(path, content);
console.log("mas.tsx patched successfully");
