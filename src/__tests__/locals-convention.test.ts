import { describe, it, expect } from "vitest";
import { transformClassNames, shouldKeepOriginal, getTransformFn } from "../locals-convention.js";

describe("getTransformFn", () => {
  it("returns undefined for no convention", () => {
    expect(getTransformFn(undefined)).toBeUndefined();
  });

  it("returns a function for camelCase", () => {
    expect(getTransformFn("camelCase")).toBeTypeOf("function");
  });

  it("returns a function for dashes", () => {
    expect(getTransformFn("dashes")).toBeTypeOf("function");
  });

  it("returns undefined for custom function", () => {
    expect(getTransformFn(() => "custom")).toBeUndefined();
  });
});

describe("shouldKeepOriginal", () => {
  it("returns true when no convention", () => {
    expect(shouldKeepOriginal(undefined)).toBe(true);
  });

  it("returns true for camelCase", () => {
    expect(shouldKeepOriginal("camelCase")).toBe(true);
  });

  it("returns false for camelCaseOnly", () => {
    expect(shouldKeepOriginal("camelCaseOnly")).toBe(false);
  });

  it("returns true for dashes", () => {
    expect(shouldKeepOriginal("dashes")).toBe(true);
  });

  it("returns false for dashesOnly", () => {
    expect(shouldKeepOriginal("dashesOnly")).toBe(false);
  });

  it("returns false for custom function", () => {
    expect(shouldKeepOriginal(() => "x")).toBe(false);
  });
});

describe("camelCase transform", () => {
  const transform = getTransformFn("camelCase")!;

  it("converts dashed names", () => {
    expect(transform("my-class")).toBe("myClass");
  });

  it("converts underscored names", () => {
    expect(transform("my_class")).toBe("myClass");
  });

  it("converts dotted names", () => {
    expect(transform("my.class")).toBe("myClass");
  });

  it("strips leading separators", () => {
    expect(transform("-my-class")).toBe("myClass");
    expect(transform("_my_class")).toBe("myClass");
  });

  it("lowercases first letter of PascalCase", () => {
    expect(transform("MyClass")).toBe("myClass");
  });

  it("leaves already camelCase unchanged", () => {
    expect(transform("myClass")).toBe("myClass");
  });

  it("handles multiple consecutive separators", () => {
    expect(transform("my--class")).toBe("myClass");
  });
});

describe("dashes transform", () => {
  const transform = getTransformFn("dashes")!;

  it("converts dashed names", () => {
    expect(transform("my-class")).toBe("myClass");
  });

  it("leaves underscores alone", () => {
    expect(transform("my_class")).toBe("my_class");
  });

  it("leaves non-dashed names unchanged", () => {
    expect(transform("myclass")).toBe("myclass");
  });

  it("handles multiple consecutive dashes", () => {
    expect(transform("my--class")).toBe("myClass");
  });
});

describe("transformClassNames", () => {
  it("returns identity when no convention", () => {
    const result = transformClassNames(["input-container", "title"], undefined);

    expect(result.exportNames).toEqual(["input-container", "title"]);
    expect(result.exportToOriginal.get("input-container")).toBe("input-container");
    expect(result.exportToOriginal.get("title")).toBe("title");
  });

  it("adds camelCase variants with camelCase convention", () => {
    const result = transformClassNames(["input-container", "title"], "camelCase");

    expect(result.exportNames).toEqual(["input-container", "inputContainer", "title"]);
    expect(result.exportToOriginal.get("inputContainer")).toBe("input-container");
    expect(result.exportToOriginal.get("input-container")).toBe("input-container");
    expect(result.exportToOriginal.get("title")).toBe("title");
  });

  it("only exports camelCase with camelCaseOnly convention", () => {
    const result = transformClassNames(["input-container", "title"], "camelCaseOnly");

    expect(result.exportNames).toEqual(["inputContainer", "title"]);
    expect(result.exportToOriginal.get("inputContainer")).toBe("input-container");
    expect(result.exportToOriginal.get("title")).toBe("title");
    expect(result.exportToOriginal.has("input-container")).toBe(false);
  });

  it("adds dashes variants with dashes convention", () => {
    const result = transformClassNames(["my-class"], "dashes");

    expect(result.exportNames).toEqual(["my-class", "myClass"]);
    expect(result.exportToOriginal.get("myClass")).toBe("my-class");
  });

  it("only exports dashes with dashesOnly convention", () => {
    const result = transformClassNames(["my-class"], "dashesOnly");

    expect(result.exportNames).toEqual(["myClass"]);
    expect(result.exportToOriginal.get("myClass")).toBe("my-class");
    expect(result.exportToOriginal.has("my-class")).toBe(false);
  });

  it("does not duplicate when transform matches original", () => {
    const result = transformClassNames(["title"], "camelCase");

    expect(result.exportNames).toEqual(["title"]);
  });
});
