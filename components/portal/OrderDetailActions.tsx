"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { reorderAction } from "@/app/(portal)/portal/orders/actions";

export function OrderDetailActions({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleReorder() {
    startTransition(async () => {
      const result = await reorderAction(orderId);
      if (result?.error) alert(result.error);
    });
  }

  return (
    <Button onClick={handleReorder} loading={isPending} variant="secondary">
      Re-order
    </Button>
  );
}
