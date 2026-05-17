import { performance } from 'perf_hooks';

interface Notification {
  id?: string;
  createdAt: string;
  receivedAt?: string;
}

function generateData(size: number, duplicateRatio: number): Notification[] {
  const data: Notification[] = [];
  const baseDate = Date.now();

  for (let i = 0; i < size; i++) {
    const isDuplicate = Math.random() < duplicateRatio;
    const id = isDuplicate && i > 0
      ? data[Math.floor(Math.random() * i)].id
      : `id-${i}`;

    data.push({
      id,
      createdAt: new Date(baseDate - Math.random() * 1000000).toISOString(),
    });
  }
  return data;
}

const localNotifications = generateData(5000, 0);
const firebaseNotifications = generateData(5000, 0.5);

function testBaseline() {
  const start = performance.now();
  const allNotifications = [...localNotifications, ...firebaseNotifications]
    .sort((a, b) => {
      const dateA = new Date('receivedAt' in a ? a.receivedAt : a.createdAt);
      const dateB = new Date('receivedAt' in b ? b.receivedAt : b.createdAt);
      return dateB.getTime() - dateA.getTime();
    })
    .filter((notification, index, self) => {
      if (!notification.id) return true;
      return index === self.findIndex((n) => n.id === notification.id);
    });
  const end = performance.now();
  return end - start;
}

function testOptimized() {
  const start = performance.now();

  const allNotifications = [...localNotifications, ...firebaseNotifications]
    .sort((a, b) => {
      const dateA = new Date('receivedAt' in a ? a.receivedAt : a.createdAt);
      const dateB = new Date('receivedAt' in b ? b.receivedAt : b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

  const seenIds = new Set<string>();
  const deduplicated = allNotifications.filter((notification) => {
    if (!notification.id) return true;
    if (seenIds.has(notification.id)) return false;
    seenIds.add(notification.id);
    return true;
  });

  const end = performance.now();
  return end - start;
}

// Warmup
testBaseline();
testOptimized();

let baselineTotal = 0;
let optimizedTotal = 0;
const iterations = 10;

for (let i = 0; i < iterations; i++) {
  baselineTotal += testBaseline();
  optimizedTotal += testOptimized();
}

console.log(`Baseline avg: ${baselineTotal / iterations} ms`);
console.log(`Optimized avg: ${optimizedTotal / iterations} ms`);
