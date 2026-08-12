import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CardElement,
  CodeElement,
  ImageElement,
  ShapeElement,
  TextElement,
} from "@/lib/card/types";
import { FIELD_GROUPS } from "@/lib/card/fields";

const Num = ({
  label,
  value,
  step = 0.5,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) => (
  <div className="space-y-1">
    <Label className="text-[11px] text-muted-foreground">{label}</Label>
    <Input
      type="number"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-8"
    />
  </div>
);

const Color = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="space-y-1">
    <Label className="text-[11px] text-muted-foreground">{label}</Label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value?.startsWith("#") ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-9 cursor-pointer rounded border border-border bg-transparent"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8" />
    </div>
  </div>
);

export function Inspector({
  el,
  onChange,
  onUploadImage,
}: {
  el: CardElement;
  onChange: (patch: Partial<CardElement>) => void;
  onUploadImage: (file: File) => void;
}) {
  const p = (patch: Partial<CardElement>) => onChange(patch);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Num label="X (mm)" value={el.x} onChange={(v) => p({ x: v })} />
        <Num label="Y (mm)" value={el.y} onChange={(v) => p({ y: v })} />
        <Num label="Width (mm)" value={el.w} onChange={(v) => p({ w: v })} />
        <Num label="Height (mm)" value={el.h} onChange={(v) => p({ h: v })} />
        <Num label="Rotation (°)" value={el.rotation} step={1} onChange={(v) => p({ rotation: v })} />
        <Num label="Layer" value={el.z} step={1} onChange={(v) => p({ z: v })} />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Locked</Label>
        <Switch checked={!!el.locked} onCheckedChange={(v) => p({ locked: v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Visible</Label>
        <Switch checked={el.visible !== false} onCheckedChange={(v) => p({ visible: v })} />
      </div>

      {el.type === "text" ? <TextPanel el={el as TextElement} p={p} /> : null}
      {el.type === "qr" || el.type === "barcode" ? <CodePanel el={el as CodeElement} p={p} /> : null}
      {el.type === "photo" || el.type === "image" || el.type === "logo" ? (
        <ImagePanel el={el as ImageElement} p={p} onUploadImage={onUploadImage} />
      ) : null}
      {el.type === "rect" || el.type === "circle" || el.type === "line" ? (
        <ShapePanel el={el as ShapeElement} p={p} />
      ) : null}
    </div>
  );
}

function FieldPicker({ onPick }: { onPick: (token: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">Insert data field</Label>
      <Select onValueChange={(v) => onPick(`{{${v}}}`)}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Choose a field" />
        </SelectTrigger>
        <SelectContent>
          {FIELD_GROUPS.map((g) => (
            <div key={g.group}>
              <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{g.group}</p>
              {g.fields.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextPanel({ el, p }: { el: TextElement; p: (patch: Partial<CardElement>) => void }) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Text / tokens</Label>
        <Textarea
          rows={3}
          value={el.text}
          onChange={(e) => p({ text: e.target.value } as Partial<CardElement>)}
        />
      </div>
      <FieldPicker onPick={(token) => p({ text: `${el.text}${token}` } as Partial<CardElement>)} />
      <div className="grid grid-cols-2 gap-2">
        <Num label="Size (pt)" value={el.fontSize} onChange={(v) => p({ fontSize: v } as Partial<CardElement>)} />
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Weight</Label>
          <Select value={String(el.fontWeight)} onValueChange={(v) => p({ fontWeight: Number(v) } as Partial<CardElement>)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[300, 400, 500, 600, 700, 800].map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Align</Label>
          <Select value={el.align} onValueChange={(v) => p({ align: v as TextElement["align"] } as Partial<CardElement>)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["left", "center", "right"].map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Case</Label>
          <Select
            value={el.transform}
            onValueChange={(v) => p({ transform: v as TextElement["transform"] } as Partial<CardElement>)}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["none", "uppercase", "lowercase", "capitalize"].map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Num
          label="Letter spacing"
          value={el.letterSpacing}
          step={0.1}
          onChange={(v) => p({ letterSpacing: v } as Partial<CardElement>)}
        />
        <Num
          label="Line height"
          value={el.lineHeight}
          step={0.05}
          onChange={(v) => p({ lineHeight: v } as Partial<CardElement>)}
        />
      </div>
      <Color label="Colour" value={el.color} onChange={(v) => p({ color: v } as Partial<CardElement>)} />
      <div className="flex items-center justify-between">
        <Label className="text-xs">Shrink text to fit</Label>
        <Switch checked={el.autoFit} onCheckedChange={(v) => p({ autoFit: v } as Partial<CardElement>)} />
      </div>
    </div>
  );
}

function CodePanel({ el, p }: { el: CodeElement; p: (patch: Partial<CardElement>) => void }) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Encoded content</Label>
        <Input value={el.content} onChange={(e) => p({ content: e.target.value } as Partial<CardElement>)} className="h-8" />
      </div>
      <FieldPicker onPick={(token) => p({ content: token } as Partial<CardElement>)} />
      <Color label="Colour" value={el.color} onChange={(v) => p({ color: v } as Partial<CardElement>)} />
    </div>
  );
}

function ImagePanel({
  el,
  p,
  onUploadImage,
}: {
  el: ImageElement;
  p: (patch: Partial<CardElement>) => void;
  onUploadImage: (file: File) => void;
}) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      {el.type === "photo" ? (
        <p className="rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
          This frame is filled automatically with each person's photo.
        </p>
      ) : (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Image</Label>
          <Input
            type="file"
            accept="image/*"
            className="h-8"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadImage(f);
            }}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Fit</Label>
          <Select value={el.fit} onValueChange={(v) => p({ fit: v as ImageElement["fit"] } as Partial<CardElement>)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["cover", "contain", "fill"].map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Num label="Corner (mm)" value={el.radius} step={0.5} onChange={(v) => p({ radius: v } as Partial<CardElement>)} />
        <Num
          label="Border (mm)"
          value={el.borderWidth}
          step={0.1}
          onChange={(v) => p({ borderWidth: v } as Partial<CardElement>)}
        />
      </div>
      <Color label="Border colour" value={el.borderColor} onChange={(v) => p({ borderColor: v } as Partial<CardElement>)} />
    </div>
  );
}

function ShapePanel({ el, p }: { el: ShapeElement; p: (patch: Partial<CardElement>) => void }) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <Color label="Fill" value={el.fill} onChange={(v) => p({ fill: v } as Partial<CardElement>)} />
      <Color label="Stroke" value={el.stroke} onChange={(v) => p({ stroke: v } as Partial<CardElement>)} />
      <div className="grid grid-cols-2 gap-2">
        <Num
          label="Stroke (mm)"
          value={el.strokeWidth}
          step={0.1}
          onChange={(v) => p({ strokeWidth: v } as Partial<CardElement>)}
        />
        <Num label="Corner (mm)" value={el.radius} step={0.5} onChange={(v) => p({ radius: v } as Partial<CardElement>)} />
      </div>
    </div>
  );
}

export { Button };
