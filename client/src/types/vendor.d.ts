








declare module "opentype.js" {

  export type LocalizedName = Record<string, string>;

  export interface FontNames {
    fontFamily?: LocalizedName;
    fontSubfamily?: LocalizedName;
    fullName?: LocalizedName;
    version?: LocalizedName;
    designer?: LocalizedName;
    license?: LocalizedName;
  }

  export interface Font {
    names: FontNames;
    unitsPerEm: number;
    glyphs: { length: number };
  }

  export function parse(buffer: ArrayBuffer): Font;
}
