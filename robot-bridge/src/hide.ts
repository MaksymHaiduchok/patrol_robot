import type { Config, SteerSide } from "./config.js";

export type ManeuverStep = {
  name: string;
  side: SteerSide | null;
  power: number;
  ms: number;
};

export const hideSteps = ({ hide }: Config): ManeuverStep[] => [
  { name: "назад", side: null, power: -hide.backSpeed, ms: hide.backMs },
  { name: `поворот ${hide.turnSide}`, side: hide.turnSide, power: hide.turnSpeed, ms: hide.turnMs },
  { name: "вперед", side: null, power: hide.forwardSpeed, ms: hide.forwardMs },
];
