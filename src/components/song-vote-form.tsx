"use client";

import { useActionState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/songs/actions";

export function SongVoteForm({
  action,
  currentVote,
  currentComment,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  currentVote?: "UP" | "DOWN";
  currentComment?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("songs.vote");

  return (
    <form action={formAction} className="space-y-3">
      <Textarea
        name="comment"
        rows={2}
        defaultValue={currentComment}
        placeholder={t("commentPlaceholder")}
        maxLength={280}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          name="vote"
          value="UP"
          variant={currentVote === "UP" ? "primary" : "secondary"}
          size="sm"
          disabled={pending}
        >
          <ThumbsUp className="h-4 w-4" />
          {t("upVote")}
        </Button>
        <Button
          type="submit"
          name="vote"
          value="DOWN"
          variant={currentVote === "DOWN" ? "danger" : "secondary"}
          size="sm"
          disabled={pending}
        >
          <ThumbsDown className="h-4 w-4" />
          {t("downVote")}
        </Button>
      </div>
      <FieldError>{state?.error}</FieldError>
    </form>
  );
}
