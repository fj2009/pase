"use client";

import { useRef } from "react";
import { ChevronsUpDown } from "lucide-react";
import { switchRestaurantAction } from "@/features/auth/restaurant-actions";
import type { Membership } from "@/features/auth/session";

export function RestaurantSwitcher({
  memberships,
  activeId,
}: {
  memberships: Membership[];
  activeId: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (memberships.length <= 1) {
    return (
      <p className="truncate text-sm font-medium text-ink">
        {memberships[0]?.name ?? "Sin restaurante"}
      </p>
    );
  }

  return (
    <form ref={formRef} action={switchRestaurantAction} className="relative">
      <label className="sr-only" htmlFor="restaurant-switcher">
        Cambiar de restaurante
      </label>
      <div className="flex items-center gap-1 border border-line bg-paper px-2">
        <select
          id="restaurant-switcher"
          name="restaurantId"
          defaultValue={activeId ?? memberships[0]?.restaurantId}
          onChange={() => formRef.current?.requestSubmit()}
          className="h-9 min-w-0 flex-1 appearance-none bg-transparent pr-4 text-sm font-medium text-ink focus:outline-none"
        >
          {memberships.map((membership) => (
            <option key={membership.restaurantId} value={membership.restaurantId}>
              {membership.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown className="pointer-events-none -ml-5 h-3.5 w-3.5 text-ink-faint" aria-hidden />
        <noscript>
          <button type="submit" className="btn-secondary btn-sm">
            Cambiar
          </button>
        </noscript>
      </div>
    </form>
  );
}
