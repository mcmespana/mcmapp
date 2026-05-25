export function buildWebcalUrl(httpsIcsUrl: string): string {
  return httpsIcsUrl.replace(/^https?:\/\//i, 'webcal://');
}

export function buildGoogleCalendarSubscribeUrl(httpsIcsUrl: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsIcsUrl)}`;
}

export function isValidIcsUrl(url: string): boolean {
  return /^https?:\/\/.+/i.test(url);
}
