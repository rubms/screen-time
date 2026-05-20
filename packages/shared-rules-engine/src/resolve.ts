import { isBrowserApp } from "./browsers.js";
import { matchUrlPattern, normalizeUrl, patternSpecificity } from "./url.js";
import type {
  Activity,
  AppTarget,
  Platform,
  ResolvedTarget,
  Rules,
  RulesTarget,
  UrlTarget,
} from "./types.js";

const UNKNOWN_TARGET_ID = "__unknown__";

function matchAppTarget(
  activity: Activity,
  target: AppTarget,
): boolean {
  for (const m of target.matchers) {
    if (m.platform !== activity.platform) continue;
    const appMatch =
      activity.app.toLowerCase() === m.matcher.toLowerCase();
    if (!appMatch) continue;
    if (m.windowTitlePattern && activity.windowTitle) {
      try {
        const re = new RegExp(m.windowTitlePattern, "i");
        if (!re.test(activity.windowTitle)) continue;
      } catch {
        continue;
      }
    } else if (m.windowTitlePattern && !activity.windowTitle) {
      continue;
    }
    return true;
  }
  return false;
}

function resolveAppTarget(
  activity: Activity,
  rules: Rules,
): AppTarget | null {
  let best: AppTarget | null = null;
  for (const t of rules.targets) {
    if (t.kind !== "app") continue;
    if (matchAppTarget(activity, t)) {
      best = t;
      break;
    }
  }
  return best;
}

function resolveUrlTarget(
  normalizedUrl: string,
  rules: Rules,
): UrlTarget | null {
  const urlTargets = rules.targets.filter(
    (t): t is UrlTarget => t.kind === "url",
  );
  urlTargets.sort(
    (a, b) => patternSpecificity(b.pattern) - patternSpecificity(a.pattern),
  );
  for (const t of urlTargets) {
    if (matchUrlPattern(normalizedUrl, t.pattern)) return t;
  }
  return null;
}

export function resolveActivity(
  activity: Activity,
  rules: Rules,
): ResolvedTarget {
  const appTarget = resolveAppTarget(activity, rules);

  if (appTarget?.category === "BLOCKED") {
    return { targetId: appTarget.id, category: "BLOCKED", target: appTarget };
  }

  let urlTarget: UrlTarget | null = null;
  if (
    activity.url &&
    isBrowserApp(activity.app, activity.platform)
  ) {
    const normalized = normalizeUrl(activity.url);
    urlTarget = resolveUrlTarget(normalized, rules);
  }

  if (urlTarget) {
    return {
      targetId: urlTarget.id,
      category: urlTarget.category,
      target: urlTarget,
    };
  }

  if (appTarget) {
    return {
      targetId: appTarget.id,
      category: appTarget.category,
      target: appTarget,
    };
  }

  return {
    targetId: UNKNOWN_TARGET_ID,
    category: "LIMITED",
    target: null,
  };
}

export function getTargetQuotaMinutes(
  target: RulesTarget | null,
  dayOfWeek: import("./types.js").DayOfWeek,
): number | null {
  if (!target?.dailyQuotaMinutes) return null;
  const q = target.dailyQuotaMinutes;
  const dayVal = q[dayOfWeek];
  if (dayVal != null) return dayVal;
  if (q.default != null) return q.default;
  return null;
}

export function getWarningLead(
  target: RulesTarget | null,
  defaults: Rules["defaults"],
): number {
  return target?.warningLeadMinutes ?? defaults.warningLeadMinutes;
}

export function getGracePeriod(
  target: RulesTarget | null,
  defaults: Rules["defaults"],
): number {
  return target?.gracePeriodSeconds ?? defaults.gracePeriodSeconds;
}
