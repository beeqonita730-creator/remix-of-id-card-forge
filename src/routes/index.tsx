import { createFileRoute, Link } from "@tanstack/react-router";
import { IdCard, Ruler, LayoutTemplate, Printer, QrCode, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ID Card Studio — Design, Generate & Print ID Cards" },
      {
        name: "description",
        content:
          "Upload or design a template, pick a card size in millimetres, enter biodata, and print or export print-accurate ID cards with QR verification.",
      },
      { property: "og:title", content: "ID Card Studio — Design, Generate & Print ID Cards" },
      {
        property: "og:description",
        content:
          "A complete ID card production system: template designer, CR80/B1/B2/Jumbo/ID-2 sizes, batch import, A4 imposition and PDF export.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Ruler, title: "Real physical sizes", body: "CR80, B1, B2, Jumbo-90, ID-2 and custom sizes, stored and printed in millimetres." },
  { icon: LayoutTemplate, title: "Template designer", body: "Drag, resize and align text, photos, QR, barcodes and shapes on a true-scale canvas." },
  { icon: IdCard, title: "Automatic population", body: "Dynamic fields such as {{full_name}} fill themselves from the biodata you enter." },
  { icon: Printer, title: "Print engine", body: "Single card, front/back, batch and A4/A3 sheet imposition with crop marks and bleed." },
  { icon: QrCode, title: "QR verification", body: "Every card carries a secure token with a public verification page." },
  { icon: Layers, title: "Versioned templates", body: "Cards store the template version used, so old cards stay reproducible." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <IdCard className="size-4" />
          </div>
          <span className="text-sm font-bold tracking-tight">ID CARD STUDIO</span>
        </div>
        <Link to="/auth">
          <Button size="sm">Sign in</Button>
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-primary">
          Automatic ID card production
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Select template → select size → enter data → upload photo → print.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-sidebar-foreground/70">
          A production ID card system. Import an existing design, overlay dynamic fields, and produce
          millimetre-accurate cards, PDFs and A4 batch sheets.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/auth">
            <Button size="lg">Open the studio</Button>
          </Link>
          <a href="#features">
            <Button size="lg" variant="secondary">
              See what it does
            </Button>
          </a>
        </div>

        <div id="features" className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg bg-sidebar-accent/70 p-5">
              <f.icon className="size-5 text-sidebar-primary" />
              <h2 className="mt-3 text-sm font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-sidebar-foreground/65">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
