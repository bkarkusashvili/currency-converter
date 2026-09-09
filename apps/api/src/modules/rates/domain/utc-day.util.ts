const MS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;

// The archive is keyed by UTC day and by nothing else. A local day would key
// the same snapshot differently on two instances in two regions, which is a
// collection with two documents for what the contract calls one day — and the
// upstream publishes in UTC anyway.
export function toUtcDay(instant: Date): string {
  return instant.toISOString().slice(0, ISO_DATE_LENGTH);
}

// The oldest day a window of `days` covers, counting the day of `instant` as
// the first: `days = 1` is today alone and `days = 7` is today and the six
// before it, which is what "the last seven days" means to whoever asked.
export function utcWindowStart(days: number, instant: Date): string {
  return toUtcDay(new Date(instant.getTime() - (days - 1) * MS_PER_DAY));
}

// How many UTC days ago a day key is: 0 for today, 1 for yesterday. Both sides
// are exact UTC midnights, so this is whole days and never a fraction of one —
// which is what lets an age be compared against a configured number of days
// without a clock time entering into it.
export function utcDayAge(day: string, instant: Date): number {
  return (Date.parse(toUtcDay(instant)) - Date.parse(day)) / MS_PER_DAY;
}
