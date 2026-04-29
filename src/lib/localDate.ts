function normalizeTimeZone(value?: string): string {
  const trimmed = (value || '').trim();
  return trimmed || 'UTC';
}

export function formatLocalDate(date: Date, timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

export function formatLocalDateFromIso(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatLocalDate(date, timeZone);
}

export function resolveDeliveryTimeZone(profile: any): string {
  const metaTz =
    profile && profile.dailyJobsMeta && typeof profile.dailyJobsMeta.deliveryTimezone === 'string'
      ? profile.dailyJobsMeta.deliveryTimezone
      : '';
  const profileTz = profile && typeof profile.deliveryTimezone === 'string' ? profile.deliveryTimezone : '';
  return normalizeTimeZone(metaTz || profileTz);
}

export function resolveTodayLocalDateKey(now: Date, profile: any): string {
  return formatLocalDate(now, resolveDeliveryTimeZone(profile));
}

export function resolveLocalDateForLastFetch(profile: any, now: Date = new Date()): string | null {
  const metaDate =
    profile && profile.dailyJobsMeta && typeof profile.dailyJobsMeta.deliveryLocalDate === 'string'
      ? profile.dailyJobsMeta.deliveryLocalDate.trim()
      : '';

  if (metaDate) return metaDate;

  const fetchTime = profile && typeof profile.lastJobFetchTime === 'string' ? profile.lastJobFetchTime : '';
  if (!fetchTime) return null;

  const date = formatLocalDateFromIso(fetchTime, resolveDeliveryTimeZone(profile));
  return date || null;
}
