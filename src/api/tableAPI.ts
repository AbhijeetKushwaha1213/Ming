import { v4 as uuidv4 } from 'uuid';
import type { TableBlock, TableColumn, TableRow } from '@/types/notion';
import { getPage, updatePage } from './pageAPI';

/**
 * Table API - Operations for table blocks
 * Provides functions to manipulate table structure (columns, rows) and data
 */

/**
 * Create a new table block with initial columns and rows
 */
export async function createTableBlock(
  pageId: string,
  columns: Omit<TableColumn, 'id'>[],
  initialRows: number = 0,
  position?: number
): Promise<TableBlock> {
  const now = new Date().toISOString();
  const blockId = uuidv4();

  // Create columns with IDs
  const tableColumns: TableColumn[] = columns.map(col => ({
    ...col,
    id: uuidv4(),
  }));

  // Create initial empty rows
  const tableRows: TableRow[] = [];
  for (let i = 0; i < initialRows; i++) {
    const cells: Record<string, any> = {};
    tableColumns.forEach(col => {
      cells[col.id] = getDefaultCellValue(col.type);
    });
    tableRows.push({
      id: uuidv4(),
      cells,
    });
  }

  const tableBlock: TableBlock = {
    id: blockId,
    type: 'table',
    position: position ?? 0,
    created_at: now,
    updated_at: now,
    columns: tableColumns,
    rows: tableRows,
  };

  return tableBlock;
}

/**
 * Get default cell value based on column type
 */
function getDefaultCellValue(columnType: TableColumn['type']): any {
  switch (columnType) {
    case 'text':
      return '';
    case 'number':
      return null;
    case 'date':
      return null;
    case 'select':
      return null;
    case 'multiSelect':
      return [];
    case 'checkbox':
      return false;
    default:
      return null;
  }
}

/**
 * Add a column to a table block
 * Preserves existing data and adds default values for the new column
 */
export async function addColumn(
  pageId: string,
  blockId: string,
  column: Omit<TableColumn, 'id'>,
  insertAtIndex?: number
): Promise<TableBlock> {
  const page = await getPage(pageId);
  const blockIndex = page.content.findIndex(block => block.id === blockId);
  
  if (blockIndex === -1) {
    throw new Error('Block not found');
  }

  const block = page.content[blockIndex];
  if (block.type !== 'table') {
    throw new Error('Block is not a table');
  }

  const tableBlock = block as TableBlock;
  const newColumn: TableColumn = {
    ...column,
    id: uuidv4(),
  };

  // Insert column at specified index or at the end
  const updatedColumns = [...tableBlock.columns];
  const index = insertAtIndex ?? updatedColumns.length;
  updatedColumns.splice(index, 0, newColumn);

  // Add default cell value for the new column in all rows
  const defaultValue = getDefaultCellValue(newColumn.type);
  const updatedRows = tableBlock.rows.map(row => ({
    ...row,
    cells: {
      ...row.cells,
      [newColumn.id]: defaultValue,
    },
  }));

  const updatedBlock: TableBlock = {
    ...tableBlock,
    columns: updatedColumns,
    rows: updatedRows,
    updated_at: new Date().toISOString(),
  };

  // Update the page
  const updatedContent = [...page.content];
  updatedContent[blockIndex] = updatedBlock;
  await updatePage(pageId, { content: updatedContent });

  return updatedBlock;
}

/**
 * Remove a column from a table block
 * Preserves all other data
 */
export async function removeColumn(
  pageId: string,
  blockId: string,
  columnId: string
): Promise<TableBlock> {
  const page = await getPage(pageId);
  const blockIndex = page.content.findIndex(block => block.id === blockId);
  
  if (blockIndex === -1) {
    throw new Error('Block not found');
  }

  const block = page.content[blockIndex];
  if (block.type !== 'table') {
    throw new Error('Block is not a table');
  }

  const tableBlock = block as TableBlock;

  // Remove the column
  const updatedColumns = tableBlock.columns.filter(col => col.id !== columnId);
  
  if (updatedColumns.length === tableBlock.columns.length) {
    throw new Error('Column not found');
  }

  // Remove the column data from all rows
  const updatedRows = tableBlock.rows.map(row => {
    const { [columnId]: removed, ...remainingCells } = row.cells;
    return {
      ...row,
      cells: remainingCells,
    };
  });

  const updatedBlock: TableBlock = {
    ...tableBlock,
    columns: updatedColumns,
    rows: updatedRows,
    updated_at: new Date().toISOString(),
  };

  // Update the page
  const updatedContent = [...page.content];
  updatedContent[blockIndex] = updatedBlock;
  await updatePage(pageId, { content: updatedContent });

  return updatedBlock;
}

/**
 * Add a row to a table block
 */
export async function addRow(
  pageId: string,
  blockId: string,
  insertAtIndex?: number,
  initialData?: Record<string, any>
): Promise<TableBlock> {
  const page = await getPage(pageId);
  const blockIndex = page.content.findIndex(block => block.id === blockId);
  
  if (blockIndex === -1) {
    throw new Error('Block not found');
  }

  const block = page.content[blockIndex];
  if (block.type !== 'table') {
    throw new Error('Block is not a table');
  }

  const tableBlock = block as TableBlock;

  // Create cells with default values or provided data
  const cells: Record<string, any> = {};
  tableBlock.columns.forEach(col => {
    cells[col.id] = initialData?.[col.id] ?? getDefaultCellValue(col.type);
  });

  const newRow: TableRow = {
    id: uuidv4(),
    cells,
  };

  // Insert row at specified index or at the end
  const updatedRows = [...tableBlock.rows];
  const index = insertAtIndex ?? updatedRows.length;
  updatedRows.splice(index, 0, newRow);

  const updatedBlock: TableBlock = {
    ...tableBlock,
    rows: updatedRows,
    updated_at: new Date().toISOString(),
  };

  // Update the page
  const updatedContent = [...page.content];
  updatedContent[blockIndex] = updatedBlock;
  await updatePage(pageId, { content: updatedContent });

  return updatedBlock;
}

/**
 * Remove a row from a table block
 */
export async function removeRow(
  pageId: string,
  blockId: string,
  rowId: string
): Promise<TableBlock> {
  const page = await getPage(pageId);
  const blockIndex = page.content.findIndex(block => block.id === blockId);
  
  if (blockIndex === -1) {
    throw new Error('Block not found');
  }

  const block = page.content[blockIndex];
  if (block.type !== 'table') {
    throw new Error('Block is not a table');
  }

  const tableBlock = block as TableBlock;

  // Remove the row
  const updatedRows = tableBlock.rows.filter(row => row.id !== rowId);
  
  if (updatedRows.length === tableBlock.rows.length) {
    throw new Error('Row not found');
  }

  const updatedBlock: TableBlock = {
    ...tableBlock,
    rows: updatedRows,
    updated_at: new Date().toISOString(),
  };

  // Update the page
  const updatedContent = [...page.content];
  updatedContent[blockIndex] = updatedBlock;
  await updatePage(pageId, { content: updatedContent });

  return updatedBlock;
}

/**
 * Sort table rows by a column
 * Returns a new table block with sorted rows
 */
export async function sortTable(
  pageId: string,
  blockId: string,
  columnId: string,
  direction: 'asc' | 'desc' = 'asc'
): Promise<TableBlock> {
  const page = await getPage(pageId);
  const blockIndex = page.content.findIndex(block => block.id === blockId);
  
  if (blockIndex === -1) {
    throw new Error('Block not found');
  }

  const block = page.content[blockIndex];
  if (block.type !== 'table') {
    throw new Error('Block is not a table');
  }

  const tableBlock = block as TableBlock;

  // Find the column
  const column = tableBlock.columns.find(col => col.id === columnId);
  if (!column) {
    throw new Error('Column not found');
  }

  // Sort rows based on column type
  const sortedRows = [...tableBlock.rows].sort((a, b) => {
    const aValue = a.cells[columnId];
    const bValue = b.cells[columnId];

    let comparison = 0;

    switch (column.type) {
      case 'text':
        comparison = String(aValue || '').localeCompare(String(bValue || ''));
        break;
      case 'number':
        comparison = (Number(aValue) || 0) - (Number(bValue) || 0);
        break;
      case 'date':
        const aDate = aValue ? new Date(aValue).getTime() : 0;
        const bDate = bValue ? new Date(bValue).getTime() : 0;
        comparison = aDate - bDate;
        break;
      case 'checkbox':
        comparison = (aValue ? 1 : 0) - (bValue ? 1 : 0);
        break;
      case 'select':
        comparison = String(aValue || '').localeCompare(String(bValue || ''));
        break;
      case 'multiSelect':
        const aStr = Array.isArray(aValue) ? aValue.join(',') : '';
        const bStr = Array.isArray(bValue) ? bValue.join(',') : '';
        comparison = aStr.localeCompare(bStr);
        break;
      default:
        comparison = 0;
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  const updatedBlock: TableBlock = {
    ...tableBlock,
    rows: sortedRows,
    updated_at: new Date().toISOString(),
  };

  // Update the page
  const updatedContent = [...page.content];
  updatedContent[blockIndex] = updatedBlock;
  await updatePage(pageId, { content: updatedContent });

  return updatedBlock;
}

/**
 * Filter table rows based on criteria
 * Returns matching rows without modifying the table block
 */
export function filterTable(
  tableBlock: TableBlock,
  filters: Array<{
    columnId: string;
    operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
    value?: any;
  }>
): TableRow[] {
  return tableBlock.rows.filter(row => {
    return filters.every(filter => {
      const cellValue = row.cells[filter.columnId];
      const column = tableBlock.columns.find(col => col.id === filter.columnId);
      
      if (!column) {
        return false;
      }

      switch (filter.operator) {
        case 'equals':
          return cellValue === filter.value;
        
        case 'contains':
          if (column.type === 'text') {
            return String(cellValue || '').toLowerCase().includes(String(filter.value || '').toLowerCase());
          }
          if (column.type === 'multiSelect' && Array.isArray(cellValue)) {
            return cellValue.includes(filter.value);
          }
          return false;
        
        case 'greaterThan':
          if (column.type === 'number') {
            return Number(cellValue) > Number(filter.value);
          }
          if (column.type === 'date') {
            return new Date(cellValue).getTime() > new Date(filter.value).getTime();
          }
          return false;
        
        case 'lessThan':
          if (column.type === 'number') {
            return Number(cellValue) < Number(filter.value);
          }
          if (column.type === 'date') {
            return new Date(cellValue).getTime() < new Date(filter.value).getTime();
          }
          return false;
        
        case 'isEmpty':
          return cellValue === null || cellValue === undefined || cellValue === '' || 
                 (Array.isArray(cellValue) && cellValue.length === 0);
        
        case 'isNotEmpty':
          return cellValue !== null && cellValue !== undefined && cellValue !== '' && 
                 (!Array.isArray(cellValue) || cellValue.length > 0);
        
        default:
          return true;
      }
    });
  });
}

/**
 * Update a cell value in a table
 */
export async function updateCell(
  pageId: string,
  blockId: string,
  rowId: string,
  columnId: string,
  value: any
): Promise<TableBlock> {
  const page = await getPage(pageId);
  const blockIndex = page.content.findIndex(block => block.id === blockId);
  
  if (blockIndex === -1) {
    throw new Error('Block not found');
  }

  const block = page.content[blockIndex];
  if (block.type !== 'table') {
    throw new Error('Block is not a table');
  }

  const tableBlock = block as TableBlock;

  // Find the row
  const rowIndex = tableBlock.rows.findIndex(row => row.id === rowId);
  if (rowIndex === -1) {
    throw new Error('Row not found');
  }

  // Verify column exists
  const column = tableBlock.columns.find(col => col.id === columnId);
  if (!column) {
    throw new Error('Column not found');
  }

  // Update the cell
  const updatedRows = [...tableBlock.rows];
  updatedRows[rowIndex] = {
    ...updatedRows[rowIndex],
    cells: {
      ...updatedRows[rowIndex].cells,
      [columnId]: value,
    },
  };

  const updatedBlock: TableBlock = {
    ...tableBlock,
    rows: updatedRows,
    updated_at: new Date().toISOString(),
  };

  // Update the page
  const updatedContent = [...page.content];
  updatedContent[blockIndex] = updatedBlock;
  await updatePage(pageId, { content: updatedContent });

  return updatedBlock;
}
