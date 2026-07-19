import type { ReactNode } from "react";

export interface DataTableColumn {
  header: string;
  align?: "left" | "right";
}

interface DataTableProps {
  columns: (string | DataTableColumn)[];
  children: ReactNode;
  minWidth?: number;
  emptyLabel?: string;
  isEmpty?: boolean;
}

const thStyle = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--bow-slate)",
};

/**
 * Thin thead/tbody wrapper matching the inline <table> styles used
 * across app/app/partners/page.tsx, tasks/page.tsx, classes/page.tsx.
 * Rows are passed as children (<tr> elements) so callers keep full
 * control of per-row markup.
 */
export default function DataTable({ columns, children, minWidth = 640, emptyLabel = "Nothing here.", isEmpty }: DataTableProps) {
  if (isEmpty) {
    return (
      <div style={{ background: "var(--bow-white)", border: "1px dashed var(--border-rule)", borderRadius: 6, padding: 32, textAlign: "center" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
            {columns.map((c, i) => {
              const col = typeof c === "string" ? { header: c } : c;
              return (
                <th scope="col" key={`${col.header}-${i}`} style={{ ...thStyle, textAlign: col.align === "right" ? "right" : "left" }}>
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
