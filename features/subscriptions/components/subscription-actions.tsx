"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Send,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  sendQuotationAction,
  confirmSubscriptionAction,
  acceptQuotationAction,
  activateSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  closeSubscriptionAction,
  renewSubscriptionAction,
} from "../actions";
import type { Subscription } from "@/types";

interface SubscriptionActionsProps {
  subscription: Subscription;
  userRole: "admin" | "staff" | "customer";
}

export function SubscriptionActions({
  subscription,
  userRole,
}: SubscriptionActionsProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [activeAction, setActiveAction] = React.useState<string | null>(null);

  const isStaffOrAdmin = userRole === "admin" || userRole === "staff";

  const executeAction = (actionName: string, actionFn: () => Promise<{ success: boolean; error?: string }>) => {
    setError(null);
    setActiveAction(actionName);
    startTransition(async () => {
      const res = await actionFn();
      if (!res.success) {
        setError(res.error || `Action '${actionName}' failed.`);
      }
      setActiveAction(null);
    });
  };

  const handleSendQuote = () => executeAction("send", () => sendQuotationAction(subscription.id));
  const handleConfirm = () => executeAction("confirm", () => confirmSubscriptionAction(subscription.id));
  const handleAccept = () => executeAction("accept", () => acceptQuotationAction(subscription.id));
  const handleActivate = () => executeAction("activate", () => activateSubscriptionAction(subscription.id));
  const handlePause = () => {
    const note = prompt("Enter pause note (optional):") || undefined;
    executeAction("pause", () => pauseSubscriptionAction(subscription.id, note));
  };
  const handleResume = () => {
    executeAction("resume", () => resumeSubscriptionAction(subscription.id));
  };
  const handleClose = () => {
    const reason = prompt("Enter closure reason (required for audit):");
    if (!reason) return;
    executeAction("close", () => closeSubscriptionAction(subscription.id, reason));
  };
  const handleRenew = () => {
    if (!confirm("Create a renewal subscription linked to this record?")) return;
    executeAction("renew", () => renewSubscriptionAction(subscription.id));
  };

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Staff/Admin Quotation Lifecycle Actions */}
        {isStaffOrAdmin && subscription.status === "draft" && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={handleSendQuote}
            className="text-xs h-8 gap-1.5"
          >
            {isPending && activeAction === "send" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send Quotation Offer
          </Button>
        )}

        {isStaffOrAdmin && subscription.status === "quotation" && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={handleConfirm}
            className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending && activeAction === "confirm" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Confirm Quotation
          </Button>
        )}

        {!isStaffOrAdmin && subscription.status === "quotation" && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={handleAccept}
            className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending && activeAction === "accept" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Accept & Confirm Quotation
          </Button>
        )}

        {isStaffOrAdmin && subscription.status === "confirmed" && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={handleActivate}
            className="text-xs h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isPending && activeAction === "activate" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Activate Subscription
          </Button>
        )}

        {/* Operational Lifecycle Actions (Staff/Admin or Customer where plan permits) */}
        {subscription.status === "active" && (
          <>
            {subscription.allowPause ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handlePause}
                className="text-xs h-8 gap-1.5 text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
              >
                {isPending && activeAction === "pause" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
                Pause Subscription
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Pausing is disabled by plan policy (allowPause = false)"
                className="text-xs h-8 gap-1.5 opacity-50 cursor-not-allowed"
              >
                <Pause className="h-3.5 w-3.5" />
                Pause Disabled
              </Button>
            )}

            {subscription.allowEarlyClose ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleClose}
                className="text-xs h-8 gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
              >
                {isPending && activeAction === "close" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Close Subscription
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Early closure is disabled by plan policy (allowEarlyClose = false)"
                className="text-xs h-8 gap-1.5 opacity-50 cursor-not-allowed"
              >
                <XCircle className="h-3.5 w-3.5" />
                Early Close Disabled
              </Button>
            )}

            {subscription.allowRenewal && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleRenew}
                className="text-xs h-8 gap-1.5"
              >
                {isPending && activeAction === "renew" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Renew Early
              </Button>
            )}
          </>
        )}

        {subscription.status === "paused" && (
          <>
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleResume}
              className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isPending && activeAction === "resume" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Resume Subscription
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleClose}
              className="text-xs h-8 gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
            >
              {isPending && activeAction === "close" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Close Subscription
            </Button>
          </>
        )}

        {subscription.status === "closed" && subscription.allowRenewal && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={handleRenew}
            className="text-xs h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isPending && activeAction === "renew" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Renew Subscription
          </Button>
        )}
      </div>
    </div>
  );
}
