import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listAnnouncements, upsertAnnouncement, decideAnnouncement, deleteAnnouncement,
} from "@/lib/provost.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Check, X, Plus, Trash2, Send, Archive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/announcements")({
  component: AnnouncementsPage,
});

const CATEGORIES = ["general","academic","admissions","fees","policy","senate","event"];
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", pending_senate: "Pending Senate", published: "Published", archived: "Archived", rejected: "Rejected",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline", pending_senate: "secondary", published: "default", archived: "outline", rejected: "destructive",
};

function AnnouncementsPage() {
  const list = useServerFn(listAnnouncements);
  const upsert = useServerFn(upsertAnnouncement);
  const decide = useServerFn(decideAnnouncement);
  const remove = useServerFn(deleteAnnouncement);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => list(),
    staleTime: 15_000,
  });

  const upMut = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["announcements"] }); qc.invalidateQueries({ queryKey: ["provost","overview"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const decMut = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject" | "archive" }) => decide({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["announcements"] }); qc.invalidateQueries({ queryKey: ["provost","overview"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["announcements"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (data ?? []).filter((a: any) => a.status === "pending_senate");
  const others = (data ?? []).filter((a: any) => a.status !== "pending_senate");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-primary">Announcements</h2>
          <p className="text-sm text-muted-foreground">Draft and route announcements through senate approval before publishing.</p>
        </div>
        <AnnouncementEditor onSave={(v) => upMut.mutate(v)} triggerLabel="New announcement" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Pending senate approval</CardTitle>
          <CardDescription>Provost decides whether to publish, reject, or archive each item.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <Skeleton className="h-24" /> : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing awaits senate approval.</p>
          ) : pending.map((a: any) => (
            <Row key={a.id} a={a}
              onApprove={() => decMut.mutate({ id: a.id, decision: "approve" })}
              onReject={() => decMut.mutate({ id: a.id, decision: "reject" })}
              onArchive={() => decMut.mutate({ id: a.id, decision: "archive" })}
              onSave={(v: any) => upMut.mutate({ ...v, id: a.id })}

              onDelete={() => delMut.mutate(a.id)}
              busy={decMut.isPending || upMut.isPending || delMut.isPending}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">All announcements</CardTitle>
          <CardDescription>Every draft, published, rejected, and archived record.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <Skeleton className="h-40" /> : others.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : others.map((a: any) => (
            <Row key={a.id} a={a}
              onApprove={() => decMut.mutate({ id: a.id, decision: "approve" })}
              onReject={() => decMut.mutate({ id: a.id, decision: "reject" })}
              onArchive={() => decMut.mutate({ id: a.id, decision: "archive" })}
              onSave={(v: any) => upMut.mutate({ ...v, id: a.id })}
              onDelete={() => delMut.mutate(a.id)}
              busy={decMut.isPending || upMut.isPending || delMut.isPending}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ a, onApprove, onReject, onArchive, onSave, onDelete, busy }: any) {
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{a.title}</span>
            <Badge variant={STATUS_VARIANT[a.status]} className="capitalize">{STATUS_LABELS[a.status]}</Badge>
            <Badge variant="outline" className="capitalize">{a.category}</Badge>
            {a.is_public && <Badge variant="outline">Public</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.body}</p>
          <div className="text-[11px] text-muted-foreground mt-1">Created {new Date(a.created_at).toLocaleString()}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {a.status === "pending_senate" && (
            <>
              <Button size="sm" onClick={onApprove} disabled={busy}><Check className="h-4 w-4 mr-1" />Approve</Button>
              <Button size="sm" variant="outline" onClick={onReject} disabled={busy}><X className="h-4 w-4 mr-1" />Reject</Button>
            </>
          )}
          {a.status === "draft" && (
            <Button size="sm" variant="secondary" onClick={() => onSave({ title: a.title, body: a.body, category: a.category, status: "pending_senate", is_public: a.is_public, publish_at: a.publish_at })} disabled={busy}>
              <Send className="h-4 w-4 mr-1" />Submit
            </Button>
          )}
          {a.status !== "archived" && a.status !== "pending_senate" && (
            <Button size="sm" variant="ghost" onClick={onArchive} disabled={busy}><Archive className="h-4 w-4" /></Button>
          )}
          <AnnouncementEditor initial={a} onSave={onSave} triggerLabel="Edit" small />
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>
    </div>
  );
}

function AnnouncementEditor({ initial, onSave, triggerLabel, small }: { initial?: any; onSave: (v: any) => void; triggerLabel: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState(initial?.category ?? "general");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? false);

  function save() {
    if (!title.trim() || !body.trim()) { toast.error("Title and body required"); return; }
    onSave({ title, body, category, status, is_public: isPublic, publish_at: null });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={small ? "sm" : "default"} variant={small ? "ghost" : "default"}>
          {!small && <Plus className="h-4 w-4 mr-1" />}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{initial ? "Edit announcement" : "New announcement"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Body</label>
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_senate">Submit for senate approval</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} id="ann-pub"/>
              <label htmlFor="ann-pub" className="text-xs">Public (visible on website)</label>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
