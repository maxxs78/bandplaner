import { ThumbsDown, ThumbsUp } from "lucide-react";

type VoteItem = {
  id: string;
  vote: "UP" | "DOWN";
  comment: string | null;
  user: { name: string };
};

export function SongVoteList({ votes }: { votes: VoteItem[] }) {
  if (votes.length === 0) {
    return <p className="text-sm text-muted">Noch keine Stimmen abgegeben.</p>;
  }

  return (
    <div className="space-y-2">
      {votes.map((v) => (
        <div key={v.id} className="flex items-start gap-2 text-sm">
          {v.vote === "UP" ? (
            <ThumbsUp className="h-4 w-4 shrink-0 text-success" />
          ) : (
            <ThumbsDown className="h-4 w-4 shrink-0 text-danger" />
          )}
          <div className="min-w-0">
            <span className="font-medium text-foreground">{v.user.name}</span>
            {v.comment && <p className="text-muted">{v.comment}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
