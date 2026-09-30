import { Activity } from "lucide-react";
import { ActivityFeed } from "../components/ActivityFeed";
import { EmptyState, PageHeader } from "../components/ui";
import { dayLabel } from "../lib/format";
import { EventRow, useWorkspace } from "../lib/workspace";

export default function ActivityPage() {
  const { events } = useWorkspace();
  const groups = events.reduce<Array<{ day: string; items: EventRow[] }>>((acc, e) => {
    const day = dayLabel(e.created_at);
    const last = acc[acc.length - 1];
    if (last?.day === day) last.items.push(e);
    else acc.push({ day, items: [e] });
    return acc;
  }, []);
  return (
    <>
      <PageHeader title="Activity" description="Everything that’s happened across your clients and projects." />
      {groups.length ? (
        groups.map((g) => (
          <section key={g.day} className="card activity-group">
            <h3 className="group-label">{g.day}</h3>
            <ActivityFeed events={g.items} />
          </section>
        ))
      ) : (
        <div className="card">
          <EmptyState
            icon={<Activity size={26} />}
            title="No activity yet"
            body="When you upload content or your clients approve and comment, it’ll show up here."
          />
        </div>
      )}
    </>
  );
}
