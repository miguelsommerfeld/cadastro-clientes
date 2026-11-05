type Row = Record<string, any>;
type TableName = "Users" | "Sessions" | "Tenants" | "Customers" | "Addresses";

type Matcher =
    | { kind: "equals"; values: Record<string, unknown> }
    | { kind: "not-null"; field: string }
    | { kind: "in"; field: string; values: unknown[] };

export const tables: Record<TableName, Row[]> = {
    Users: [],
    Sessions: [],
    Tenants: [],
    Customers: [],
    Addresses: []
};

function matches(row: Row, matcher: Matcher): boolean {
    if (matcher.kind === "equals") {
        return Object.entries(matcher.values).every(([key, value]) => row[key] === value);
    }
    if (matcher.kind === "not-null") return row[matcher.field] !== null;
    return matcher.values.includes(row[matcher.field]);
}

function makeTable(name: keyof typeof tables) {
    const makeQuery = (
        matchers: Matcher[],
        ordering?: { field: string; direction: "asc" | "desc" }
    ) => {
        const selected = () => {
            const rows = tables[name].filter((row) =>
                matchers.every((matcher) => matches(row, matcher)));
            if (!ordering) return rows;
            return rows.sort((left, right) => {
                const leftValue = left[ordering.field]?.epochMilliseconds ?? left[ordering.field];
                const rightValue = right[ordering.field]?.epochMilliseconds ?? right[ordering.field];
                const direction = ordering.direction === "desc" ? -1 : 1;
                return (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0) * direction;
            });
        };
        return {
            where: (criteria: Record<string, unknown> | ((record: any) => Matcher)) => {
                const matcher: Matcher = typeof criteria === "function"
                    ? criteria(new Proxy({}, {
                        get: (_target, field: string) => ({
                            isNotNull: () => ({ kind: "not-null", field }),
                            in: (values: unknown[]) => ({ kind: "in", field, values })
                        })
                    }))
                    : { kind: "equals", values: criteria };
                return makeQuery([...matchers, matcher]);
            },
            orderBy: (order: (record: any) => { field: string; direction: "asc" | "desc" }) =>
                makeQuery(matchers, order(new Proxy({}, {
                    get: (_target, field: string) => ({
                        desc: () => ({ field, direction: "desc" as const }),
                        asc: () => ({ field, direction: "asc" as const })
                    })
                }))),
            first: async () => selected()[0] ?? null,
            all: async () => selected(),
            update: async (updates: Row) => {
                const rows = selected();
                rows.forEach((row) => Object.assign(row, updates));
                return rows[0] ?? null;
            },
            delete: async () => {
                const rows = selected();
                rows.forEach((row) => {
                    const index = tables[name].indexOf(row);
                    if (index >= 0) tables[name].splice(index, 1);
                });
            },
            deleteAll: async () => {
                const rows = selected();
                rows.forEach((row) => {
                    const index = tables[name].indexOf(row);
                    if (index >= 0) tables[name].splice(index, 1);
                });
                return rows.length;
            }
        };
    };
    return {
        create: async (row: Row) => {
            const copy = { ...row };
            tables[name].push(copy);
            return copy;
        },
        where: (criteria: Record<string, unknown> | ((record: any) => Matcher)) =>
            makeQuery([]).where(criteria)
    };
}

export function createMemoryDb() {
    const publicSchema = {
        Users: makeTable("Users"),
        Sessions: makeTable("Sessions"),
        Tenants: makeTable("Tenants"),
        Customers: makeTable("Customers"),
        Addresses: makeTable("Addresses")
    };
    const db: any = {
        orm: { public: publicSchema },
        transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db)
    };
    return db;
}

export const db = createMemoryDb();

export function resetTables() {
    for (const rows of Object.values(tables)) rows.splice(0, rows.length);
}
