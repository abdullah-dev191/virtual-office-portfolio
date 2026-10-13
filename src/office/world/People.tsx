"use client";

import { useMemo } from "react";
import { CharacterModel } from "../characters/CharacterModel";
import type { Look } from "../characters/looks";
import { guard, seatCast } from "../characters/roster";
import type { Director } from "../director";

/** Everyone the director moves: the visitor, the receptionist, the guard, the hosts and the staff. */
export function People({ director, visitorLook, staffLimit }: { director: Director; visitorLook: Look; staffLimit: number }) {
  const cast = useMemo(() => {
    let staff = 0;
    return director.npcs.flatMap((a) => {
      const c = seatCast.get(a.id);
      if (!c) return [];
      if (c.staff && staff++ >= staffLimit) return [];
      return [{ actor: a, ...c }];
    });
  }, [director, staffLimit]);

  return (
    <group>
      <CharacterModel puppet={director.visitor} look={visitorLook} label="YOU" tone="you" />
      <CharacterModel puppet={director.guard} look={guard} label="SECURITY" />
      {cast.map((c) => (
        <CharacterModel key={c.actor.id} puppet={c.actor} look={c.look} label={c.label} labelRange={c.label === "RECEPTIONIST" ? 90 : 45} />
      ))}
    </group>
  );
}
