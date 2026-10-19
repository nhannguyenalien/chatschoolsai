// PocketBase stores date fields as "YYYY-MM-DD HH:mm:ss.SSSZ" (a space, not "T") and its filters compare them as plain
// strings. Putting an ISO "T" value in a filter makes every row of the same UTC day sort *before* it (" " < "T"), so a
// post scheduled for 21:00 looked "due" from 00:00 UTC. Always format filter timestamps with pbDateTime().
export const pbDateTime = (when = Date.now()) => new Date(when).toISOString().replace("T", " ");

// Filter for post_targets that should be published now: approved, or scheduled with a real time that has arrived.
// scheduledAt != '' matters: targets waiting for an automatic slot have an empty scheduled_at.
export function dueTargetsFilter(nowMs, tenantClause = "") {
  const due = `(status='approved' || (status='scheduled' && scheduled_at != '' && scheduled_at <= '${pbDateTime(nowMs)}'))`;
  return tenantClause ? `${tenantClause} && ${due}` : due;
}

// Targets scheduled to go out within the next windowMinutes (used for the early preflight warning).
export function upcomingTargetsFilter(nowMs, windowMinutes, tenantClause = "") {
  const f = `status='scheduled' && scheduled_at != '' && scheduled_at > '${pbDateTime(nowMs)}' && scheduled_at <= '${pbDateTime(nowMs + windowMinutes * 60 * 1000)}'`;
  return tenantClause ? `${tenantClause} && ${f}` : f;
}

// Targets stuck in "publishing" for longer than staleMs.
export function stalePublishingFilter(nowMs, staleMs, tenantClause = "") {
  const f = `status='publishing' && updated <= '${pbDateTime(nowMs - staleMs)}'`;
  return tenantClause ? `${f} && ${tenantClause}` : f;
}
