"use client";

import * as React from "react";
import { QuotationList } from "@/features/quotations/components/quotation-list";
import { TemplateList } from "@/features/quotations/components/template-list";
import { QuotationFromTemplateDialog } from "@/features/quotations/components/quotation-from-template-dialog";
import { QuotationTemplateDialog } from "@/features/quotations/components/quotation-template-dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import type { CustomerAccount, Plan, Product, QuotationTemplate, Subscription, UserSession } from "@/types";

interface QuotationHubProps {
  quotations: Subscription[];
  templates: QuotationTemplate[];
  customers: CustomerAccount[];
  plans: Plan[];
  products: Product[];
  userSession: UserSession;
}

export function QuotationHub({
  quotations,
  templates,
  customers,
  plans,
  products,
  userSession,
}: QuotationHubProps) {
  const [activeTab, setActiveTab] = React.useState<"quotations" | "templates">("quotations");
  const [isCreateQuoteOpen, setIsCreateQuoteOpen] = React.useState(false);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={activeTab === "quotations" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("quotations")}
          className="text-xs h-8 gap-1.5"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Active Quotations ({quotations.length})
        </Button>
        <Button
          variant={activeTab === "templates" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("templates")}
          className="text-xs h-8 gap-1.5"
        >
          <FileText className="h-3.5 w-3.5" />
          Templates ({templates.length})
        </Button>
      </div>

      {activeTab === "quotations" ? (
        <QuotationList
          quotations={quotations}
          userRole={userSession.role}
          onCreateClick={() => setIsCreateQuoteOpen(true)}
        />
      ) : (
        <TemplateList
          templates={templates}
          userRole={userSession.role}
          onCreateClick={() => setIsCreateTemplateOpen(true)}
        />
      )}

      {/* Modal Dialogs */}
      <QuotationFromTemplateDialog
        open={isCreateQuoteOpen}
        onOpenChange={setIsCreateQuoteOpen}
        templates={templates.filter((t) => t.isActive)}
        customers={customers}
      />

      <QuotationTemplateDialog
        open={isCreateTemplateOpen}
        onOpenChange={setIsCreateTemplateOpen}
        availablePlans={plans.filter((p) => p.isActive)}
        availableProducts={products.filter((p) => p.isActive)}
      />
    </div>
  );
}
