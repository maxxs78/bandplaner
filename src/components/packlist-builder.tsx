"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/input";
import clsx from "clsx";

type EquipmentRef = { id: string; name: string; location: string | null; owner: { id: string; name: string } | null };

type PacklistItem = {
  id: string;
  checked: boolean;
  customName: string | null;
  equipment: EquipmentRef | null;
  assignedTo: { id: string; name: string } | null;
};

type CatalogEquipment = { id: string; name: string; location: string | null; owner: { id: string; name: string } | null };
type Member = { id: string; name: string };

const NONE_KEY = "__none__";
const BAND_KEY = "__band__";
const CUSTOM_KEY = "__custom__";

function ownerKey(item: PacklistItem) {
  if (!item.equipment) return CUSTOM_KEY;
  return item.equipment.owner ? item.equipment.owner.id : BAND_KEY;
}
function ownerLabel(item: PacklistItem) {
  if (!item.equipment) return "Eigener Eintrag";
  return item.equipment.owner ? item.equipment.owner.name : "Band-Eigentum";
}
function locationKey(item: PacklistItem) {
  return item.equipment?.location ?? NONE_KEY;
}
function locationLabel(item: PacklistItem) {
  return item.equipment?.location ?? "Ohne Lagerort";
}
function assignedKey(item: PacklistItem) {
  return item.assignedTo?.id ?? NONE_KEY;
}
function assignedLabel(item: PacklistItem) {
  return item.assignedTo?.name ?? "Nicht zugewiesen";
}

function collectOptions(items: PacklistItem[], key: (i: PacklistItem) => string, label: (i: PacklistItem) => string) {
  const map = new Map<string, string>();
  for (const item of items) map.set(key(item), label(item));
  return Array.from(map.entries())
    .sort((a, b) => a[1].localeCompare(b[1], "de"))
    .map(([value, text]) => ({ value, label: text }));
}

export function PacklistBuilder({
  initialItems,
  catalogEquipment,
  members,
  readOnly = false,
  onToggle,
  onAssign,
  onRemove,
  onAddEquipment,
  onAddCustom,
}: {
  initialItems: PacklistItem[];
  catalogEquipment: CatalogEquipment[];
  members: Member[];
  readOnly?: boolean;
  onToggle: (itemId: string, checked: boolean) => Promise<void>;
  onAssign: (itemId: string, userId: string) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
  onAddEquipment: (equipmentId: string) => Promise<void>;
  onAddCustom: (formData: FormData) => Promise<void>;
}) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("");
  const [groupBy, setGroupBy] = useState<"none" | "owner" | "location" | "assigned">("none");
  const [, startTransition] = useTransition();
  const optimisticIdCounter = useRef(0);

  const usedEquipmentIds = new Set(items.map((i) => i.equipment?.id).filter(Boolean));
  const filteredCatalog = catalogEquipment.filter(
    (e) => !usedEquipmentIds.has(e.id) && e.name.toLowerCase().includes(search.toLowerCase())
  );

  const ownerOptions = useMemo(() => collectOptions(items, ownerKey, ownerLabel), [items]);
  const locationOptions = useMemo(() => collectOptions(items, locationKey, locationLabel), [items]);
  const assignedOptions = useMemo(() => collectOptions(items, assignedKey, assignedLabel), [items]);

  const filteredItems = items.filter(
    (i) =>
      (!filterOwner || ownerKey(i) === filterOwner) &&
      (!filterLocation || locationKey(i) === filterLocation) &&
      (!filterAssigned || assignedKey(i) === filterAssigned)
  );

  const groupKeyFn = groupBy === "owner" ? ownerKey : groupBy === "location" ? locationKey : groupBy === "assigned" ? assignedKey : null;
  const groupLabelFn = groupBy === "owner" ? ownerLabel : groupBy === "location" ? locationLabel : groupBy === "assigned" ? assignedLabel : null;

  const groups: { key: string; label: string; items: PacklistItem[] }[] = [];
  if (groupKeyFn && groupLabelFn) {
    const map = new Map<string, { key: string; label: string; items: PacklistItem[] }>();
    for (const item of filteredItems) {
      const key = groupKeyFn(item);
      if (!map.has(key)) map.set(key, { key, label: groupLabelFn(item), items: [] });
      map.get(key)!.items.push(item);
    }
    groups.push(...Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "de")));
  }

  function handleToggle(itemId: string, checked: boolean) {
    setItems((current) => current.map((i) => (i.id === itemId ? { ...i, checked } : i)));
    startTransition(() => onToggle(itemId, checked));
  }

  function handleAssign(itemId: string, userId: string) {
    const member = members.find((m) => m.id === userId) ?? null;
    setItems((current) => current.map((i) => (i.id === itemId ? { ...i, assignedTo: member } : i)));
    startTransition(() => onAssign(itemId, userId));
  }

  function handleRemove(itemId: string) {
    setItems((current) => current.filter((i) => i.id !== itemId));
    startTransition(() => onRemove(itemId));
  }

  function handleAddEquipment(equipment: CatalogEquipment) {
    const optimisticId = `optimistic-${optimisticIdCounter.current++}`;
    setItems((current) => [
      ...current,
      {
        id: optimisticId,
        checked: false,
        customName: null,
        equipment: { id: equipment.id, name: equipment.name, location: equipment.location, owner: equipment.owner },
        assignedTo: null,
      },
    ]);
    startTransition(() => onAddEquipment(equipment.id));
  }

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customName.trim()) return;
    const formData = new FormData();
    formData.set("customName", customName);
    const optimisticId = `optimistic-${optimisticIdCounter.current++}`;
    setItems((current) => [
      ...current,
      { id: optimisticId, checked: false, customName, equipment: null, assignedTo: null },
    ]);
    setCustomName("");
    startTransition(() => onAddCustom(formData));
  }

  const checkedCount = items.filter((i) => i.checked).length;

  function renderItemRow(item: PacklistItem) {
    return (
      <div
        key={item.id}
        className={clsx(
          "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5",
          item.checked && "bg-surface-muted"
        )}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={item.checked}
          disabled={readOnly}
          onClick={() => handleToggle(item.id, !item.checked)}
          className={clsx(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition",
            item.checked ? "border-success bg-success text-white" : "border-border"
          )}
        >
          {item.checked && <Check className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "truncate text-sm font-medium",
              item.checked ? "text-muted line-through" : "text-foreground"
            )}
          >
            {item.equipment?.name ?? item.customName ?? "Unbenannt"}
          </p>
          {!item.equipment && <p className="text-xs text-muted">Eigener Eintrag</p>}
        </div>
        {!readOnly && (
          <Select
            value={item.assignedTo?.id ?? ""}
            onChange={(e) => handleAssign(item.id, e.target.value)}
            className="max-w-[9.5rem] shrink-0 text-xs"
          >
            <option value="">Niemand zugewiesen</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
        {readOnly && item.assignedTo && (
          <span className="shrink-0 text-xs text-muted">{item.assignedTo.name}</span>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => handleRemove(item.id)}
            aria-label="Entfernen"
            className="shrink-0 text-muted hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={readOnly ? "" : "grid gap-6 lg:grid-cols-[1fr_320px]"}>
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Einträge</h2>
          {items.length > 0 && (
            <span className="text-sm text-muted">
              {checkedCount} von {items.length} gepackt
            </span>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <div>
              <Label htmlFor="filterOwner">Eigentümer</Label>
              <Select id="filterOwner" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
                <option value="">Alle</option>
                {ownerOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="filterLocation">Lagerort</Label>
              <Select id="filterLocation" value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
                <option value="">Alle</option>
                {locationOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="filterAssigned">Verantwortlich</Label>
              <Select id="filterAssigned" value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}>
                <option value="">Alle</option>
                {assignedOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="groupBy">Gruppieren nach</Label>
              <Select
                id="groupBy"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
              >
                <option value="none">Keine</option>
                <option value="owner">Eigentümer</option>
                <option value="location">Lagerort</option>
                <option value="assigned">Verantwortlichem</option>
              </Select>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {readOnly ? "Diese Packliste ist noch leer." : "Noch keine Einträge. Füge rechts Equipment hinzu."}
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Kein Eintrag entspricht den gewählten Filtern.</p>
        ) : groups.length > 0 ? (
          <div className="mt-3 space-y-4">
            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  {group.label} <span className="font-normal normal-case">({group.items.length})</span>
                </h3>
                <div className="space-y-2">{group.items.map((item) => renderItemRow(item))}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 space-y-2">{filteredItems.map((item) => renderItemRow(item))}</div>
        )}

        {!readOnly && (
          <form onSubmit={handleAddCustom} className="mt-4 flex gap-2">
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Eigener Eintrag (z. B. Verlängerungskabel)"
              className="flex-1"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" />
              Hinzufügen
            </button>
          </form>
        )}
      </div>

      {!readOnly && (
        <div>
          <h2 className="font-semibold text-foreground">Equipment-Katalog</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Equipment suchen…"
            className="mt-2"
          />
          <div className="mt-2 max-h-[500px] space-y-1.5 overflow-y-auto">
            {filteredCatalog.map((eq) => (
              <button
                key={eq.id}
                type="button"
                onClick={() => handleAddEquipment(eq)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary hover:bg-surface-muted"
              >
                <span className="text-foreground">
                  {eq.name}
                  {eq.owner && <span className="text-muted"> · {eq.owner.name}</span>}
                </span>
                <Plus className="h-4 w-4 shrink-0 text-primary" />
              </button>
            ))}
            {filteredCatalog.length === 0 && (
              <p className="text-sm text-muted">Kein Equipment gefunden.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
