/**
 * Everything that simulates the office, owned outside React: the director, the camera rig, traffic and the
 * football game. Components read it every frame; the UI calls its methods.
 */
import { CameraRig } from "./camera";
import { sexOf } from "./characters/rig";
import { footballerLook, pedestrianLook, visitorLooks } from "./characters/roster";
import { Director } from "./director";
import { Football } from "./football";
import { QUALITY, type Quality } from "./quality";
import { Traffic } from "./traffic";

export class Sim {
  director = new Director(sexOf(visitorLooks[0].look.body));
  rig = new CameraRig();
  game = new Football((team, i) => sexOf(footballerLook(team, i).body));
  quality: Quality = "high";
  traffic = this.makeTraffic("high");

  constructor() {
    this.director.traffic = this.traffic;
  }

  private makeTraffic(q: Quality) {
    return new Traffic(QUALITY[q].cars, QUALITY[q].walkers, (i) => sexOf(pedestrianLook(i).body));
  }

  /** Changes how much traffic there is (the scene remounts with the new quality). */
  setQuality(q: Quality) {
    if (q === this.quality) return;
    this.quality = q;
    this.traffic = this.makeTraffic(q);
    this.director.traffic = this.traffic;
  }
}

export const sim = new Sim();
