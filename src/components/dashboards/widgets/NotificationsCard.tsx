import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyNotifications, markNotificationsRead } from "@/lib/dashboard.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/portal/EmptyState";
import { Bell, CheckCheck } from "lucide-react";

export function NotificationsCard() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getMyNotifications);
  const markFn = useServerFn(markNotificationsRead);
  const { data, isLoading } = useQuery({
    queryKey: ["portal", "notifications"],
    queryFn: () => fetchFn(),
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 font-serif">
            <Bell className="size-4 text-primary" /> Notifications
            {data && data.unread > 0 ? <Badge variant="secondary">{data.unread} new</Badge> : null}
          </CardTitle>
          <CardDescription>Updates from Registry and the results workflow</CardDescription>
        </div>
        {data && data.unread > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await markFn();
              qc.invalidateQueries({ queryKey: ["portal", "notifications"] });
            }}
          >
            <CheckCheck className="mr-1 size-4" /> Mark read
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Nothing yet" description="You have no notifications right now." />
        ) : (
          data!.items.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-3 text-sm ${n.is_read ? "bg-background" : "bg-muted/50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{n.title}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
              {n.body ? <p className="mt-1 text-xs text-muted-foreground">{n.body}</p> : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
