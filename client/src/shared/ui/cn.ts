import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";



















const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["11", "13", "15", "22"] }],
      shadow: [{ shadow: ["e1", "e2", "e3", "e4", "e5"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
