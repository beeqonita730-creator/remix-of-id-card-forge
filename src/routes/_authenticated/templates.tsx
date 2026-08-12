import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Copy, Trash2, PenTool } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, listCardSizes, listTemplates } from "@/services/db";
import { CardRenderer } from "@/components/card/CardRenderer";
import { emptyDesign, type CardDesign, type CardSize } from "@/lib/card/types";
import { starterDesign } from "@/lib/card/starter";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [
      { title: "Templates — ID Card Studio" },
      {
        name: "description",
        content: "Create, import and version ID card design templates with dynamic data fields for front and back.",
      },
      { property: "og:title", content: "Templates — ID Card Studio" },
      { property: "og:description", content: "Create and version ID card design templates for front and back." },
    ],
  }),
  component: Templates;
});

function Templates() {
  return null;
}
