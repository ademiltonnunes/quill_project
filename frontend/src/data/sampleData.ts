import type { TableRow } from '../types';

const categories = ['Electronics', 'Clothing', 'Food', 'Books', 'Toys', 'Home', 'Sports'];
const statuses: Array<'active' | 'inactive' | 'pending'> = ['active', 'inactive', 'pending'];
const names = [
  'Widget A', 'Widget B', 'Widget C', 'Product X', 'Product Y', 'Product Z',
  'Item Alpha', 'Item Beta', 'Item Gamma', 'Thing One', 'Thing Two', 'Thing Three',
  'Gadget Pro', 'Gadget Plus', 'Gadget Lite', 'Device Max', 'Device Mini', 'Device Standard',
  'Tool Master', 'Tool Basic', 'Tool Premium', 'Component A', 'Component B', 'Component C'
];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

export function generateSampleData(count: number = 75): TableRow[] {
  const data: TableRow[] = [];
  const startDate = new Date(2023, 0, 1);
  const endDate = new Date();

  for (let i = 0; i < count; i++) {
    data.push({
      id: `row-${i + 1}`,
      name: randomElement(names),
      amount: Math.floor(Math.random() * 1000) + 10,
      status: randomElement(statuses),
      date: randomDate(startDate, endDate),
      category: randomElement(categories),
    });
  }

  return data;
}

