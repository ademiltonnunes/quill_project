export interface TableRow {
  id: string;
  name: string;
  amount: number;
  status: 'active' | 'inactive' | 'pending';
  date: string;
  category: string;
}

export interface ColumnFilterValue {
  operator: string;
  value: unknown;
}

export interface TableState {
  data: TableRow[];
  sorting: Array<{ id: string; desc: boolean }>;
  columnFilters: Array<{ id: string; value: ColumnFilterValue | unknown }>;
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
}

