// Calendar days belong to the bakery's own time zone. Slicing an ISO timestamp
// yields the UTC day, which is one day behind for anything recorded between
// midnight and 03:00 East Africa Time — that is how payments and journal
// entries ended up dated the day before they were taken.
export function localDay(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
//# sourceMappingURL=local-day.js.map