export type ToothType =
  | "centralIncisor"
  | "lateralIncisor"
  | "canine"
  | "firstPremolar"
  | "secondPremolar"
  | "firstMolar"
  | "secondMolar"
  | "thirdMolar";

export type ToothJaw = "upper" | "lower";
export type ToothSide = "left" | "right";

export type ToothLayout = {
  type: ToothType;
  jaw: ToothJaw;
  side: ToothSide;
  number: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  scaleX: 1 | -1;
};

export const DENTAL_CHART_VIEWBOX = {
  width: 720,
  height: 340,
} as const;

// Coordinates are deliberately explicit: the component is a renderer, while this
// file owns the clinical order and the shape of the dental arch.
export const PERMANENT_TOOTH_LAYOUT: readonly ToothLayout[] = [
  { number: "18", type: "thirdMolar", jaw: "upper", side: "right", x: 48, y: 73, rotation: -20, scale: 0.88, scaleX: -1 },
  { number: "17", type: "secondMolar", jaw: "upper", side: "right", x: 88, y: 82, rotation: -17, scale: 0.92, scaleX: -1 },
  { number: "16", type: "firstMolar", jaw: "upper", side: "right", x: 130, y: 91, rotation: -14, scale: 0.94, scaleX: -1 },
  { number: "15", type: "secondPremolar", jaw: "upper", side: "right", x: 172, y: 99, rotation: -10, scale: 1.01, scaleX: -1 },
  { number: "14", type: "firstPremolar", jaw: "upper", side: "right", x: 212, y: 106, rotation: -7, scale: 0.98, scaleX: -1 },
  { number: "13", type: "canine", jaw: "upper", side: "right", x: 252, y: 111, rotation: -4, scale: 0.94, scaleX: -1 },
  { number: "12", type: "lateralIncisor", jaw: "upper", side: "right", x: 291, y: 114, rotation: -2, scale: 0.82, scaleX: -1 },
  { number: "11", type: "centralIncisor", jaw: "upper", side: "right", x: 331, y: 116, rotation: -1, scale: 0.88, scaleX: -1 },
  { number: "21", type: "centralIncisor", jaw: "upper", side: "left", x: 389, y: 116, rotation: 1, scale: 0.88, scaleX: 1 },
  { number: "22", type: "lateralIncisor", jaw: "upper", side: "left", x: 429, y: 114, rotation: 2, scale: 0.82, scaleX: 1 },
  { number: "23", type: "canine", jaw: "upper", side: "left", x: 468, y: 111, rotation: 4, scale: 0.94, scaleX: 1 },
  { number: "24", type: "firstPremolar", jaw: "upper", side: "left", x: 508, y: 106, rotation: 7, scale: 0.98, scaleX: 1 },
  { number: "25", type: "secondPremolar", jaw: "upper", side: "left", x: 548, y: 99, rotation: 10, scale: 1.01, scaleX: 1 },
  { number: "26", type: "firstMolar", jaw: "upper", side: "left", x: 590, y: 91, rotation: 14, scale: 0.94, scaleX: 1 },
  { number: "27", type: "secondMolar", jaw: "upper", side: "left", x: 632, y: 82, rotation: 17, scale: 0.92, scaleX: 1 },
  { number: "28", type: "thirdMolar", jaw: "upper", side: "left", x: 672, y: 73, rotation: 20, scale: 0.88, scaleX: 1 },

  { number: "48", type: "thirdMolar", jaw: "lower", side: "right", x: 48, y: 267, rotation: -20, scale: 0.86, scaleX: -1 },
  { number: "47", type: "secondMolar", jaw: "lower", side: "right", x: 88, y: 258, rotation: -17, scale: 0.9, scaleX: -1 },
  { number: "46", type: "firstMolar", jaw: "lower", side: "right", x: 130, y: 249, rotation: -14, scale: 0.92, scaleX: -1 },
  { number: "45", type: "secondPremolar", jaw: "lower", side: "right", x: 172, y: 241, rotation: -10, scale: 0.99, scaleX: -1 },
  { number: "44", type: "firstPremolar", jaw: "lower", side: "right", x: 212, y: 234, rotation: -7, scale: 0.96, scaleX: -1 },
  { number: "43", type: "canine", jaw: "lower", side: "right", x: 252, y: 229, rotation: -4, scale: 0.92, scaleX: -1 },
  { number: "42", type: "lateralIncisor", jaw: "lower", side: "right", x: 291, y: 226, rotation: -2, scale: 0.8, scaleX: -1 },
  { number: "41", type: "centralIncisor", jaw: "lower", side: "right", x: 331, y: 224, rotation: -1, scale: 0.84, scaleX: -1 },
  { number: "31", type: "centralIncisor", jaw: "lower", side: "left", x: 389, y: 224, rotation: 1, scale: 0.84, scaleX: 1 },
  { number: "32", type: "lateralIncisor", jaw: "lower", side: "left", x: 429, y: 226, rotation: 2, scale: 0.8, scaleX: 1 },
  { number: "33", type: "canine", jaw: "lower", side: "left", x: 468, y: 229, rotation: 4, scale: 0.92, scaleX: 1 },
  { number: "34", type: "firstPremolar", jaw: "lower", side: "left", x: 508, y: 234, rotation: 7, scale: 0.96, scaleX: 1 },
  { number: "35", type: "secondPremolar", jaw: "lower", side: "left", x: 548, y: 241, rotation: 10, scale: 0.99, scaleX: 1 },
  { number: "36", type: "firstMolar", jaw: "lower", side: "left", x: 590, y: 249, rotation: 14, scale: 0.92, scaleX: 1 },
  { number: "37", type: "secondMolar", jaw: "lower", side: "left", x: 632, y: 258, rotation: 17, scale: 0.9, scaleX: 1 },
  { number: "38", type: "thirdMolar", jaw: "lower", side: "left", x: 672, y: 267, rotation: 20, scale: 0.86, scaleX: 1 },
] as const;

// Primary teeth use the same asset library. Keeping their layout here also means
// switching dentitions never changes or discards the selection from the other set.
export const PRIMARY_TOOTH_LAYOUT: readonly ToothLayout[] = [
  { number: "55", type: "secondMolar", jaw: "upper", side: "right", x: 142, y: 88, rotation: -14, scale: 0.92, scaleX: -1 },
  { number: "54", type: "firstMolar", jaw: "upper", side: "right", x: 190, y: 101, rotation: -10, scale: 0.94, scaleX: -1 },
  { number: "53", type: "canine", jaw: "upper", side: "right", x: 236, y: 110, rotation: -6, scale: 0.9, scaleX: -1 },
  { number: "52", type: "lateralIncisor", jaw: "upper", side: "right", x: 281, y: 115, rotation: -3, scale: 0.8, scaleX: -1 },
  { number: "51", type: "centralIncisor", jaw: "upper", side: "right", x: 326, y: 117, rotation: -1, scale: 0.84, scaleX: -1 },
  { number: "61", type: "centralIncisor", jaw: "upper", side: "left", x: 394, y: 117, rotation: 1, scale: 0.84, scaleX: 1 },
  { number: "62", type: "lateralIncisor", jaw: "upper", side: "left", x: 439, y: 115, rotation: 3, scale: 0.8, scaleX: 1 },
  { number: "63", type: "canine", jaw: "upper", side: "left", x: 484, y: 110, rotation: 6, scale: 0.9, scaleX: 1 },
  { number: "64", type: "firstMolar", jaw: "upper", side: "left", x: 530, y: 101, rotation: 10, scale: 0.94, scaleX: 1 },
  { number: "65", type: "secondMolar", jaw: "upper", side: "left", x: 578, y: 88, rotation: 14, scale: 0.92, scaleX: 1 },
  { number: "85", type: "secondMolar", jaw: "lower", side: "right", x: 142, y: 252, rotation: -14, scale: 0.9, scaleX: -1 },
  { number: "84", type: "firstMolar", jaw: "lower", side: "right", x: 190, y: 239, rotation: -10, scale: 0.92, scaleX: -1 },
  { number: "83", type: "canine", jaw: "lower", side: "right", x: 236, y: 230, rotation: -6, scale: 0.88, scaleX: -1 },
  { number: "82", type: "lateralIncisor", jaw: "lower", side: "right", x: 281, y: 225, rotation: -3, scale: 0.78, scaleX: -1 },
  { number: "81", type: "centralIncisor", jaw: "lower", side: "right", x: 326, y: 223, rotation: -1, scale: 0.82, scaleX: -1 },
  { number: "71", type: "centralIncisor", jaw: "lower", side: "left", x: 394, y: 223, rotation: 1, scale: 0.82, scaleX: 1 },
  { number: "72", type: "lateralIncisor", jaw: "lower", side: "left", x: 439, y: 225, rotation: 3, scale: 0.78, scaleX: 1 },
  { number: "73", type: "canine", jaw: "lower", side: "left", x: 484, y: 230, rotation: 6, scale: 0.88, scaleX: 1 },
  { number: "74", type: "firstMolar", jaw: "lower", side: "left", x: 530, y: 239, rotation: 10, scale: 0.92, scaleX: 1 },
  { number: "75", type: "secondMolar", jaw: "lower", side: "left", x: 578, y: 252, rotation: 14, scale: 0.9, scaleX: 1 },
] as const;
