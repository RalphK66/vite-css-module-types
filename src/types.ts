export interface ClassPosition {
  line: number;
  column: number;
}

export interface CssModulesDtsOptions {
  exportMode?: "named" | "default" | "both";
  declarationMap?: boolean;
  cleanup?: boolean;
  include?: string[];
  exclude?: string[];
}

export type LocalsConvention =
  | "camelCase"
  | "camelCaseOnly"
  | "dashes"
  | "dashesOnly"
  | ((originalClassName: string, generatedClassName: string, inputFile: string) => string);

export interface ResolvedOptions {
  exportMode: "named" | "default" | "both";
  declarationMap: boolean;
  cleanup: boolean;
  include: string[];
  exclude: string[];
  localsConvention?: LocalsConvention;
}
