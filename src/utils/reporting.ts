export function countRecentMonths(items: { created_at: string }[], now = new Date()) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    date: new Date(now.getFullYear(), now.getMonth() - 11 + index, 1),
    count: 0,
  }));
  const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();
  const first = monthIndex(months[0].date);

  for (const item of items) {
    const date = new Date(item.created_at);
    const month = months[monthIndex(date) - first];
    if (month && date <= now) month.count += 1;
  }

  return months;
}
