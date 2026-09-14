const GRAPH_VERSION = "v19.0";

async function graphJson(fetchImpl, path, token, params = {}) {
  const query = new URLSearchParams({ ...params, access_token: token });
  const response = await fetchImpl(`https://graph.facebook.com/${GRAPH_VERSION}/${path}?${query}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message || `Facebook Graph API failed (${response.status}).`);
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

function metricTotal(metric) {
  return (metric.values || []).reduce((total, point) => total + (typeof point.value === "number" ? point.value : 0), 0);
}

function insightValues(items = []) {
  return Object.fromEntries(items.map(item => [item.name, metricTotal(item)]));
}

export function createFacebookInsightsIntegration({ repository, fetchImpl = fetch }) {
  return {
    async research({ tenant, since, until, limit = 25 }) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(since || "") || !/^\d{4}-\d{2}-\d{2}$/.test(until || "") || since > until) {
        throw new Error("Facebook Insights requires a valid YYYY-MM-DD range.");
      }
      const pages = await repository.listFacebookPages(tenant);
      const rowLimit = Math.max(1, Math.min(100, Number(limit) || 25));
      const results = [];
      for (const page of pages) {
        if (!page.page_id || !page.access_token) continue;
        try {
          const [profileResult, insightsResult, postsResult] = await Promise.allSettled([
            graphJson(fetchImpl, page.page_id, page.access_token, { fields: "id,name,link,fan_count,followers_count" }),
            graphJson(fetchImpl, `${page.page_id}/insights`, page.access_token, {
              metric: "page_impressions,page_impressions_unique,page_post_engagements,page_views_total",
              period: "day", since, until,
            }),
            graphJson(fetchImpl, `${page.page_id}/posts`, page.access_token, {
              fields: "id,message,created_time,permalink_url,insights.metric(post_impressions,post_impressions_unique,post_engaged_users,post_clicks,post_reactions_by_type_total)",
              since, until, limit: String(rowLimit),
            }),
          ]);
          if (profileResult.status === "rejected" && insightsResult.status === "rejected" && postsResult.status === "rejected") {
            throw profileResult.reason;
          }
          const profile = profileResult.status === "fulfilled" ? profileResult.value : {};
          const insights = insightsResult.status === "fulfilled" ? insightsResult.value : { data: [] };
          const posts = postsResult.status === "fulfilled" ? postsResult.value : { data: [] };
          const warnings = [profileResult, insightsResult, postsResult]
            .filter(result => result.status === "rejected")
            .map(result => result.reason?.message || "Facebook Graph API request failed.");
          const trend = (insights.data || []).reduce((days, metric) => {
            for (const point of metric.values || []) {
              const date = String(point.end_time || "").slice(0, 10);
              const row = days.get(date) || { date };
              row[metric.name] = point.value;
              days.set(date, row);
            }
            return days;
          }, new Map());
          results.push({
            id: page.id, pageId: page.page_id, label: page.label || profile.name, profile,
            summary: insightValues(insights.data), trend: [...trend.values()].sort((a,b) => a.date.localeCompare(b.date)),
            warnings,
            posts: (posts.data || []).map(post => ({
              id: post.id, message: post.message || "", createdTime: post.created_time, permalinkUrl: post.permalink_url,
              metrics: Object.fromEntries((post.insights?.data || []).map(metric => [metric.name, metric.values?.[0]?.value ?? 0])),
            })),
          });
        } catch (error) {
          results.push({ id: page.id, pageId: page.page_id, label: page.label || page.page_id, error: error.message, code: error.code || null });
        }
      }
      return { generatedAt: new Date().toISOString(), since, until, pages: results };
    },
  };
}
