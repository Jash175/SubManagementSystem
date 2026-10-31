"use client";

import * as React from "react";
import { UserPlus, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createStaffAccountAction } from "@/features/auth/actions";
import { PasswordRequirements } from "./password-requirements";

interface CreateStaffFormProps {
  onSuccess?: () => void;
}

export function CreateStaffForm({ onSuccess }: CreateStaffFormProps) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 9) {
      setErrorMessage("Password must be more than 8 characters (at least 9 characters).");
      return;
    }

    setLoading(true);

    try {
      const res = await createStaffAccountAction({
        fullName,
        email,
        password,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to create staff account.");
      } else {
        setSuccessMessage(res.message || "Staff account created successfully.");
        setFullName("");
        setEmail("");
        setPassword("");
        if (onSuccess) onSuccess();
      }
    } catch {
      setErrorMessage("An unexpected error occurred while creating staff member.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Provision Internal Staff Account
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Internal staff have operational access to quotations, subscriptions, billing, and customer records.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Operation Failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="staffFullName">Staff Full Name *</Label>
              <Input
                id="staffFullName"
                type="text"
                placeholder="John Smith"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staffEmail">Staff Email Address *</Label>
              <Input
                id="staffEmail"
                type="email"
                placeholder="john.smith@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staffPassword">Initial Password *</Label>
            <Input
              id="staffPassword"
              type="password"
              placeholder="Assign a secure temporary password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <PasswordRequirements password={password} />

          <Button
            type="submit"
            className="w-full sm:w-auto font-medium"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Provisioning Staff Account...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Staff Account
              </>
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
