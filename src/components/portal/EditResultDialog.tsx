import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateResultScores } from "@/lib/result-edit.functions";
import type { ArchiveRow } from "@/lib/results-archive.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

type EditableRow = Pick<
  ArchiveRow,
  "id" | "ca_score" | "exam_score" | "status_code" | "matric_number" | "student_name" | "course_code" | "course_title"
>;

const STATUSES = [
  { value: "OK", label: "OK — scored" },
  { value: "ABS", label: "ABS — absent" },
  { value: "INC", label: "INC — incomplete" },
  { value: "WH", label: "WH — withheld" },
];

export function EditResultDialog({ row, onSaved }: { row: EditableRow; onSaved?: () => void }) {
  const save = useServerFn(updateResultScores);
  const [open, setOpen] = useState(false);
  const [ca, setCa] = useState(row.ca_score?.toString() ?? "");
  const [exam, setExam] = useState(row.exam_score?.toString() ?? "");
  const [statusCode, setStatusCode] = useState(row.status_code || "OK");
  const [note, setNote] = useState("");

  const num = (v: string) => {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          result_id: row.id,
          ca_score: num(ca),
          exam_score: num(exam),
          status_code: statusCode as "OK" | "ABS" | "INC" | "WH",
          note: note.trim() || undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Result updated — total ${r.total_score}`);
      setOpen(false);
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const caNum = num(ca);
  const examNum = num(exam);
  const invalid =
    (caNum !== null && (caNum < 0 || caNum > 40)) ||
    (examNum !== null && (examNum < 0 || examNum > 60));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit result">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Edit result</DialogTitle>
          <DialogDescription>
            {row.student_name} · {row.matric_number} — {row.course_code} {row.course_title}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ca">CA score (max 40)</Label>
            <Input id="ca" inputMode="decimal" value={ca} onChange={(e) => setCa(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exam">Exam score (max 60)</Label>
            <Input id="exam" inputMode="decimal" value={exam} onChange={(e) => setExam(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Status</Label>
            <Select value={statusCode} onValueChange={setStatusCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="note">Reason for correction (optional)</Label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Grade, grade point, semester GPA and CGPA are recomputed automatically, and the change is recorded
          in the audit trail.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={invalid || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
