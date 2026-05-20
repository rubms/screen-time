import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";
import { createEmptyRules } from "@/lib/rulesDefaults";
import { validateUrlPattern, testUrlAgainstPattern } from "@/lib/urlPattern";
import type { AppTarget, RuleTarget, RulesDocument, UrlTarget } from "@/lib/types";
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function RulesEditorPage() {
  const { childId } = useParams<{ childId: string }>();
  const { familyId, user } = useAuth();
  const [rules, setRules] = useState<RulesDocument>(createEmptyRules());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [urlTest, setUrlTest] = useState("");
  const [editingUrl, setEditingUrl] = useState<Partial<UrlTarget> | null>(null);

  useEffect(() => {
    if (!familyId || !childId) return;
    const db = getDb();
    getDoc(doc(db, "families", familyId, "children", childId, "rules", "current"))
      .then((snap) => {
        if (snap.exists()) {
          setRules(snap.data() as RulesDocument);
        }
      })
      .finally(() => setLoading(false));
  }, [familyId, childId]);

  const urlValidation = editingUrl?.pattern
    ? validateUrlPattern(editingUrl.pattern)
    : { valid: true };

  const canSave =
    !editingUrl?.pattern || urlValidation.valid;

  const save = async () => {
    if (!familyId || !childId || !user || !canSave) return;
    const db = getDb();
    const next: RulesDocument = {
      ...rules,
      version: (rules.version ?? 0) + 1,
      updatedByUid: user.uid,
      updatedAt: serverTimestamp() as RulesDocument["updatedAt"],
    };
    await setDoc(
      doc(db, "families", familyId, "children", childId, "rules", "current"),
      next,
    );
    setRules(next);
    setToast("Rules updated. Devices syncing…");
    setTimeout(() => setToast(null), 4000);
  };

  const addAppTarget = () => {
    const t: AppTarget = {
      kind: "app",
      id: newId(),
      displayName: "New app",
      platform: "any",
      matchers: [{ platform: "windows", matcher: "app.exe" }],
      category: "LIMITED",
    };
    setRules({ ...rules, targets: [...rules.targets, t] });
  };

  const addUrlTarget = () => {
    setEditingUrl({
      kind: "url",
      id: newId(),
      displayName: "New site",
      pattern: "",
      category: "LIMITED",
    });
  };

  const commitUrlTarget = () => {
    if (!editingUrl?.pattern || !urlValidation.valid) return;
    const t = editingUrl as UrlTarget;
    const exists = rules.targets.some((x) => x.id === t.id);
    setRules({
      ...rules,
      targets: exists
        ? rules.targets.map((x) => (x.id === t.id ? t : x))
        : [...rules.targets, t],
    });
    setEditingUrl(null);
    setUrlTest("");
  };

  const removeTarget = (id: string) => {
    setRules({ ...rules, targets: rules.targets.filter((t) => t.id !== id) });
  };

  const updateTarget = (id: string, patch: Partial<RuleTarget>) => {
    setRules({
      ...rules,
      targets: rules.targets.map((t) =>
        t.id === id ? ({ ...t, ...patch } as RuleTarget) : t,
      ),
    });
  };

  if (loading) return <p className="text-slate-500">Loading rules…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/children/${childId}`} className="text-sm text-brand-600">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold flex-1">Rules editor</h1>
        <Button onClick={save} disabled={!canSave}>
          Save rules
        </Button>
      </div>

      {toast && (
        <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          {toast}
        </p>
      )}

      <Card>
        <h2 className="font-medium mb-3">Defaults</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Warning lead (minutes)"
            type="number"
            value={rules.defaults.warningLeadMinutes}
            onChange={(e) =>
              setRules({
                ...rules,
                defaults: {
                  ...rules.defaults,
                  warningLeadMinutes: Number(e.target.value),
                },
              })
            }
          />
          <Input
            label="Grace period (seconds)"
            type="number"
            value={rules.defaults.gracePeriodSeconds}
            onChange={(e) =>
              setRules({
                ...rules,
                defaults: {
                  ...rules.defaults,
                  gracePeriodSeconds: Number(e.target.value),
                },
              })
            }
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-medium mb-3">Weekly schedule & budgets</h2>
        <div className="space-y-4">
          {WEEKDAYS.map((day: Weekday) => (
            <div key={day} className="border-b border-slate-100 pb-3">
              <p className="text-sm font-medium text-slate-700 mb-2">
                {WEEKDAY_LABELS[day]}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  label="Window start"
                  value={rules.weekly[day].schedule[0]?.start ?? "08:00"}
                  onChange={(e) => {
                    const schedule = [...rules.weekly[day].schedule];
                    schedule[0] = {
                      ...schedule[0],
                      start: e.target.value,
                      end: schedule[0]?.end ?? "21:00",
                    };
                    setRules({
                      ...rules,
                      weekly: {
                        ...rules.weekly,
                        [day]: { ...rules.weekly[day], schedule },
                      },
                    });
                  }}
                />
                <Input
                  label="Window end"
                  value={rules.weekly[day].schedule[0]?.end ?? "21:00"}
                  onChange={(e) => {
                    const schedule = [...rules.weekly[day].schedule];
                    schedule[0] = {
                      start: schedule[0]?.start ?? "08:00",
                      end: e.target.value,
                    };
                    setRules({
                      ...rules,
                      weekly: {
                        ...rules.weekly,
                        [day]: { ...rules.weekly[day], schedule },
                      },
                    });
                  }}
                />
                <Input
                  label="Daily budget (min)"
                  type="number"
                  value={rules.weekly[day].dailyTotalMinutes ?? ""}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      weekly: {
                        ...rules.weekly,
                        [day]: {
                          ...rules.weekly[day],
                          dailyTotalMinutes: e.target.value
                            ? Number(e.target.value)
                            : null,
                        },
                      },
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-medium">Targets</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={addAppTarget}>
              Add app
            </Button>
            <Button size="sm" variant="secondary" onClick={addUrlTarget}>
              Add URL
            </Button>
          </div>
        </div>

        {editingUrl && (
          <div className="mb-4 p-3 rounded-lg border border-brand-200 bg-brand-50 space-y-2">
            <Input
              label="Display name"
              value={editingUrl.displayName ?? ""}
              onChange={(e) =>
                setEditingUrl({ ...editingUrl, displayName: e.target.value })
              }
            />
            <Input
              label="URL pattern"
              value={editingUrl.pattern ?? ""}
              error={urlValidation.valid ? undefined : urlValidation.error}
              onChange={(e) =>
                setEditingUrl({ ...editingUrl, pattern: e.target.value })
              }
            />
            <Input
              label="Test URL"
              value={urlTest}
              onChange={(e) => setUrlTest(e.target.value)}
            />
            {editingUrl.pattern && urlTest && (
              <p className="text-xs text-slate-600">
                Match:{" "}
                {testUrlAgainstPattern(editingUrl.pattern, urlTest) ? "yes" : "no"}
              </p>
            )}
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={editingUrl.category ?? "LIMITED"}
              onChange={(e) =>
                setEditingUrl({
                  ...editingUrl,
                  category: e.target.value as UrlTarget["category"],
                })
              }
            >
              <option value="BLOCKED">Blocked</option>
              <option value="LIMITED">Limited</option>
              <option value="ALLOWED">Allowed</option>
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={commitUrlTarget} disabled={!urlValidation.valid}>
                Add URL target
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingUrl(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <ul className="space-y-3">
          {rules.targets.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-2 border border-slate-100 rounded-lg p-3 sm:flex-row sm:items-start"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {t.displayName}{" "}
                  <span className="text-xs text-slate-400">({t.kind})</span>
                </p>
                {t.kind === "url" && (
                  <p className="text-xs text-slate-500 truncate">{t.pattern}</p>
                )}
                {t.kind === "app" && (
                  <p className="text-xs text-slate-500">
                    {t.matchers.map((m) => m.matcher).join(", ")}
                  </p>
                )}
              </div>
              <select
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={t.category}
                onChange={(e) =>
                  updateTarget(t.id, {
                    category: e.target.value as RuleTarget["category"],
                  })
                }
              >
                <option value="BLOCKED">Blocked</option>
                <option value="LIMITED">Limited</option>
                <option value="ALLOWED">Allowed</option>
              </select>
              <Button size="sm" variant="danger" onClick={() => removeTarget(t.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
