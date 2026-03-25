import { Type, type TObject, type TProperties } from "@sinclair/typebox";

/**
 * 构建基础搜索 Tool Schema（含必需的 query 参数）
 * Provider 可通过 extraProperties 扩展自定义参数
 */
export function buildSearchToolSchema(
  extraProperties?: TProperties,
): TObject {
  return Type.Object(
    {
      query: Type.String({ description: "搜索关键字。" }),
      ...(extraProperties ?? {}),
    },
    { additionalProperties: false },
  );
}
