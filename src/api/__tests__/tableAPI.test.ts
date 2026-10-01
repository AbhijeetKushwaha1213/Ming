import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createTableBlock,
  addColumn,
  removeColumn,
  addRow,
  removeRow,
  sortTable,
  filterTable,
  updateCell,
} from '../tableAPI';
import type { TableBlock, Page } from '@/types/notion';
import * as pageAPI from '../pageAPI';

// Mock the pageAPI module
vi.mock('../pageAPI', () => ({
  getPage: vi.fn(),
  updatePage: vi.fn(),
}));

describe('Table API', () => {
  describe('createTableBlock', () => {
    it('creates a table block with columns and rows', async () => {
      const columns = [
        { name: 'Name', type: 'text' as const, width: 200 },
        { name: 'Age', type: 'number' as const, width: 100 },
      ];

      const tableBlock = await createTableBlock('page-1', columns, 2);

      expect(tableBlock.type).toBe('table');
      expect(tableBlock.columns).toHaveLength(2);
      expect(tableBlock.rows).toHaveLength(2);
      expect(tableBlock.columns[0].name).toBe('Name');
      expect(tableBlock.columns[1].name).toBe('Age');
      
      // Check that rows have cells for all columns
      expect(Object.keys(tableBlock.rows[0].cells)).toHaveLength(2);
    });

    it('creates empty table with no rows', async () => {
      const columns = [
        { name: 'Title', type: 'text' as const, width: 300 },
      ];

      const tableBlock = await createTableBlock('page-1', columns, 0);

      expect(tableBlock.columns).toHaveLength(1);
      expect(tableBlock.rows).toHaveLength(0);
    });
  });

  describe('addColumn', () => {
    let mockPage: Page;
    let tableBlock: TableBlock;

    beforeEach(async () => {
      tableBlock = await createTableBlock(
        'page-1',
        [{ name: 'Name', type: 'text' as const, width: 200 }],
        2
      );

      mockPage = {
        id: 'page-1',
        user_id: 'user-1',
        parent_id: null,
        title: 'Test Page',
        icon: null,
        cover_image: null,
        content: [tableBlock],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(pageAPI.getPage).mockResolvedValue(mockPage);
      vi.mocked(pageAPI.updatePage).mockResolvedValue(mockPage);
    });

    it('adds a column to the table', async () => {
      const result = await addColumn('page-1', tableBlock.id, {
        name: 'Age',
        type: 'number',
        width: 100,
      });

      expect(result.columns).toHaveLength(2);
      expect(result.columns[1].name).toBe('Age');
      expect(result.columns[1].type).toBe('number');
      
      // Check that all rows have the new column
      result.rows.forEach(row => {
        expect(Object.keys(row.cells)).toHaveLength(2);
      });
    });

    it('adds column at specified index', async () => {
      const result = await addColumn('page-1', tableBlock.id, {
        name: 'ID',
        type: 'number',
        width: 80,
      }, 0);

      expect(result.columns[0].name).toBe('ID');
      expect(result.columns[1].name).toBe('Name');
    });
  });

  describe('removeColumn', () => {
    let mockPage: Page;
    let tableBlock: TableBlock;

    beforeEach(async () => {
      tableBlock = await createTableBlock(
        'page-1',
        [
          { name: 'Name', type: 'text' as const, width: 200 },
          { name: 'Age', type: 'number' as const, width: 100 },
        ],
        2
      );

      mockPage = {
        id: 'page-1',
        user_id: 'user-1',
        parent_id: null,
        title: 'Test Page',
        icon: null,
        cover_image: null,
        content: [tableBlock],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(pageAPI.getPage).mockResolvedValue(mockPage);
      vi.mocked(pageAPI.updatePage).mockResolvedValue(mockPage);
    });

    it('removes a column from the table', async () => {
      const columnToRemove = tableBlock.columns[1].id;
      const result = await removeColumn('page-1', tableBlock.id, columnToRemove);

      expect(result.columns).toHaveLength(1);
      expect(result.columns[0].name).toBe('Name');
      
      // Check that all rows no longer have the removed column
      result.rows.forEach(row => {
        expect(row.cells[columnToRemove]).toBeUndefined();
        expect(Object.keys(row.cells)).toHaveLength(1);
      });
    });
  });

  describe('addRow', () => {
    let mockPage: Page;
    let tableBlock: TableBlock;

    beforeEach(async () => {
      tableBlock = await createTableBlock(
        'page-1',
        [{ name: 'Name', type: 'text' as const, width: 200 }],
        1
      );

      mockPage = {
        id: 'page-1',
        user_id: 'user-1',
        parent_id: null,
        title: 'Test Page',
        icon: null,
        cover_image: null,
        content: [tableBlock],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(pageAPI.getPage).mockResolvedValue(mockPage);
      vi.mocked(pageAPI.updatePage).mockResolvedValue(mockPage);
    });

    it('adds a row to the table', async () => {
      const result = await addRow('page-1', tableBlock.id);

      expect(result.rows).toHaveLength(2);
      expect(Object.keys(result.rows[1].cells)).toHaveLength(1);
    });

    it('adds row with initial data', async () => {
      const columnId = tableBlock.columns[0].id;
      const result = await addRow('page-1', tableBlock.id, undefined, {
        [columnId]: 'John Doe',
      });

      expect(result.rows).toHaveLength(2);
      expect(result.rows[1].cells[columnId]).toBe('John Doe');
    });
  });

  describe('removeRow', () => {
    let mockPage: Page;
    let tableBlock: TableBlock;

    beforeEach(async () => {
      tableBlock = await createTableBlock(
        'page-1',
        [{ name: 'Name', type: 'text' as const, width: 200 }],
        3
      );

      mockPage = {
        id: 'page-1',
        user_id: 'user-1',
        parent_id: null,
        title: 'Test Page',
        icon: null,
        cover_image: null,
        content: [tableBlock],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(pageAPI.getPage).mockResolvedValue(mockPage);
      vi.mocked(pageAPI.updatePage).mockResolvedValue(mockPage);
    });

    it('removes a row from the table', async () => {
      const rowToRemove = tableBlock.rows[1].id;
      const result = await removeRow('page-1', tableBlock.id, rowToRemove);

      expect(result.rows).toHaveLength(2);
      expect(result.rows.find(row => row.id === rowToRemove)).toBeUndefined();
    });
  });

  describe('sortTable', () => {
    let mockPage: Page;
    let tableBlock: TableBlock;

    beforeEach(async () => {
      tableBlock = await createTableBlock(
        'page-1',
        [
          { name: 'Name', type: 'text' as const, width: 200 },
          { name: 'Age', type: 'number' as const, width: 100 },
        ],
        3
      );

      // Set cell values
      const nameCol = tableBlock.columns[0].id;
      const ageCol = tableBlock.columns[1].id;
      
      tableBlock.rows[0].cells[nameCol] = 'Charlie';
      tableBlock.rows[0].cells[ageCol] = 30;
      tableBlock.rows[1].cells[nameCol] = 'Alice';
      tableBlock.rows[1].cells[ageCol] = 25;
      tableBlock.rows[2].cells[nameCol] = 'Bob';
      tableBlock.rows[2].cells[ageCol] = 35;

      mockPage = {
        id: 'page-1',
        user_id: 'user-1',
        parent_id: null,
        title: 'Test Page',
        icon: null,
        cover_image: null,
        content: [tableBlock],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(pageAPI.getPage).mockResolvedValue(mockPage);
      vi.mocked(pageAPI.updatePage).mockResolvedValue(mockPage);
    });

    it('sorts table by text column ascending', async () => {
      const nameCol = tableBlock.columns[0].id;
      const result = await sortTable('page-1', tableBlock.id, nameCol, 'asc');

      expect(result.rows[0].cells[nameCol]).toBe('Alice');
      expect(result.rows[1].cells[nameCol]).toBe('Bob');
      expect(result.rows[2].cells[nameCol]).toBe('Charlie');
    });

    it('sorts table by number column descending', async () => {
      const ageCol = tableBlock.columns[1].id;
      const result = await sortTable('page-1', tableBlock.id, ageCol, 'desc');

      expect(result.rows[0].cells[ageCol]).toBe(35);
      expect(result.rows[1].cells[ageCol]).toBe(30);
      expect(result.rows[2].cells[ageCol]).toBe(25);
    });
  });

  describe('filterTable', () => {
    let tableBlock: TableBlock;

    beforeEach(async () => {
      tableBlock = await createTableBlock(
        'page-1',
        [
          { name: 'Name', type: 'text' as const, width: 200 },
          { name: 'Age', type: 'number' as const, width: 100 },
        ],
        3
      );

      const nameCol = tableBlock.columns[0].id;
      const ageCol = tableBlock.columns[1].id;
      
      tableBlock.rows[0].cells[nameCol] = 'Alice';
      tableBlock.rows[0].cells[ageCol] = 25;
      tableBlock.rows[1].cells[nameCol] = 'Bob';
      tableBlock.rows[1].cells[ageCol] = 30;
      tableBlock.rows[2].cells[nameCol] = 'Charlie';
      tableBlock.rows[2].cells[ageCol] = 35;
    });

    it('filters table by equals operator', () => {
      const nameCol = tableBlock.columns[0].id;
      const result = filterTable(tableBlock, [
        { columnId: nameCol, operator: 'equals', value: 'Bob' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].cells[nameCol]).toBe('Bob');
    });

    it('filters table by contains operator', () => {
      const nameCol = tableBlock.columns[0].id;
      const result = filterTable(tableBlock, [
        { columnId: nameCol, operator: 'contains', value: 'li' },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].cells[nameCol]).toBe('Alice');
      expect(result[1].cells[nameCol]).toBe('Charlie');
    });

    it('filters table by greaterThan operator', () => {
      const ageCol = tableBlock.columns[1].id;
      const result = filterTable(tableBlock, [
        { columnId: ageCol, operator: 'greaterThan', value: 28 },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].cells[ageCol]).toBe(30);
      expect(result[1].cells[ageCol]).toBe(35);
    });
  });

  describe('updateCell', () => {
    let mockPage: Page;
    let tableBlock: TableBlock;

    beforeEach(async () => {
      tableBlock = await createTableBlock(
        'page-1',
        [{ name: 'Name', type: 'text' as const, width: 200 }],
        1
      );

      mockPage = {
        id: 'page-1',
        user_id: 'user-1',
        parent_id: null,
        title: 'Test Page',
        icon: null,
        cover_image: null,
        content: [tableBlock],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(pageAPI.getPage).mockResolvedValue(mockPage);
      vi.mocked(pageAPI.updatePage).mockResolvedValue(mockPage);
    });

    it('updates a cell value', async () => {
      const rowId = tableBlock.rows[0].id;
      const columnId = tableBlock.columns[0].id;
      
      const result = await updateCell('page-1', tableBlock.id, rowId, columnId, 'John Doe');

      expect(result.rows[0].cells[columnId]).toBe('John Doe');
    });
  });
});
