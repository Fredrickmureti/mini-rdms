/**
 * =============================================================================
 * TABLE CLASS
 * =============================================================================
 * 
 * A Table stores rows of data organized by columns. It's the core data
 * container in our RDBMS, similar to a spreadsheet or SQL table.
 * 
 * CONCEPTS COVERED:
 * -----------------
 * 1. Row Storage: How data rows are stored in memory
 * 2. Constraint Enforcement: PRIMARY KEY, UNIQUE, NOT NULL
 * 3. CRUD Operations: Create, Read, Update, Delete
 * 4. Indexing: Fast lookups using hash-based indexes
 * 
 * VISUAL REPRESENTATION:
 * ----------------------
 * Table: users
 * ┌────────────┬──────────────┬─────────────┐
 * │ id (INT)   │ name (TEXT)  │ active(BOOL)│
 * │ PK, UNIQUE │ NOT NULL     │             │
 * ├────────────┼──────────────┼─────────────┤
 * │ 1          │ 'Alice'      │ true        │
 * │ 2          │ 'Bob'        │ false       │
 * │ 3          │ 'Charlie'    │ true        │
 * └────────────┴──────────────┴─────────────┘
 * 
 * USAGE EXAMPLE:
 * --------------
 * const columns = [
 *   new Column('id', 'INT', { primaryKey: true }),
 *   new Column('name', 'TEXT', { notNull: true }),
 *   new Column('active', 'BOOL')
 * ];
 * 
 * const usersTable = new Table('users', columns);
 * usersTable.insert({ id: 1, name: 'Alice', active: true });
 * 
 * =============================================================================
 */

const Column = require('./Column');

class Table {
    /**
     * Creates a new Table instance
     * 
     * @param {string} name - The name of the table
     * @param {Column[]} columns - Array of Column instances defining the schema
     * 
     * @example
     * const table = new Table('users', [
     *   new Column('id', 'INT', { primaryKey: true }),
     *   new Column('name', 'TEXT', { notNull: true })
     * ]);
     */
    constructor(name, columns = []) {
        // Validate table name
        if (!name || typeof name !== 'string') {
            throw new Error('Table name must be a non-empty string');
        }

        // Validate columns array
        if (!Array.isArray(columns) || columns.length === 0) {
            throw new Error('Table must have at least one column');
        }

        // Store table metadata
        this.name = name;
        this.columns = columns;

        // Create a map for quick column lookup by name
        // { 'id': Column, 'name': Column, 'active': Column }
        this.columnMap = {};
        this.columns.forEach(col => {
            if (this.columnMap[col.name]) {
                throw new Error(`Duplicate column name: '${col.name}'`);
            }
            this.columnMap[col.name] = col;
        });

        // Array to store all data rows
        // Each row is an object: { id: 1, name: 'Alice', active: true }
        this.rows = [];

        // =====================================================================
        // UNIQUENESS TRACKING
        // =====================================================================
        // For columns with UNIQUE or PRIMARY KEY constraints, we need to track
        // all existing values to prevent duplicates.
        // 
        // uniqueMap structure:
        // {
        //   'id': Set { 1, 2, 3 },        // All existing 'id' values
        //   'email': Set { 'a@b.com' }    // All existing 'email' values
        // }
        this.uniqueMap = {};

        // Find the primary key column (we support single-column PK for simplicity)
        this.primaryKeyColumn = this.columns.find(col => col.primaryKey);

        // Initialize unique value tracking for PK
        if (this.primaryKeyColumn) {
            this.uniqueMap[this.primaryKeyColumn.name] = new Set();
        }

        // Initialize unique value tracking for other UNIQUE columns
        this.columns.forEach(col => {
            if (col.unique && !col.primaryKey) {
                this.uniqueMap[col.name] = new Set();
            }
        });

        // =====================================================================
        // INDEXING
        // =====================================================================
        // Indexes allow O(1) lookups instead of O(n) full table scans
        // We automatically index the primary key column
        // 
        // indexes structure:
        // {
        //   'id': {
        //     1: [rowIndex1],           // Value 1 is at row index 0
        //     2: [rowIndex2],           // Value 2 is at row index 1
        //   }
        // }
        this.indexes = {};

        // Auto-create index on primary key
        if (this.primaryKeyColumn) {
            this.createIndex(this.primaryKeyColumn.name);
        }
    }

    // =========================================================================
    // CREATE (INSERT) OPERATIONS
    // =========================================================================

    /**
     * Inserts a new row into the table
     * 
     * Steps:
     * 1. Validate that row has all required columns
     * 2. Validate each value against column constraints
     * 3. Check UNIQUE constraints
     * 4. Add row to storage
     * 5. Update indexes and unique maps
     * 
     * @param {Object} rowData - Object with column names as keys and values
     * @returns {Object} The inserted row
     * @throws {Error} If validation fails
     * 
     * @example
     * table.insert({ id: 1, name: 'Alice', active: true });
     */
    insert(rowData) {
        // Step 1: Create a normalized row object
        const row = {};

        // Step 2: Validate and process each column
        for (const column of this.columns) {
            const value = rowData[column.name];

            // Validate the value against column constraints
            column.validate(value);

            // Check UNIQUE constraint
            if (column.unique || column.primaryKey) {
                if (value !== null && value !== undefined) {
                    if (this.uniqueMap[column.name].has(value)) {
                        throw new Error(
                            `UNIQUE constraint violation: Value '${value}' ` +
                            `already exists in column '${column.name}'`
                        );
                    }
                }
            }

            // Store the value
            row[column.name] = value;
        }

        // Step 3: Add row to storage
        const rowIndex = this.rows.length;
        this.rows.push(row);

        // Step 4: Update unique maps
        for (const column of this.columns) {
            if (column.unique || column.primaryKey) {
                const value = row[column.name];
                if (value !== null && value !== undefined) {
                    this.uniqueMap[column.name].add(value);
                }
            }
        }

        // Step 5: Update indexes
        this._updateIndexesOnInsert(row, rowIndex);

        return row;
    }

    // =========================================================================
    // READ (SELECT) OPERATIONS
    // =========================================================================

    /**
     * Selects rows from the table with optional filtering
     * 
     * @param {string[]} [columnNames=['*']] - Columns to return ('*' for all)
     * @param {Object} [whereClause=null] - Filter conditions
     * @returns {Object[]} Array of matching rows
     * 
     * @example
     * // Select all columns from all rows
     * table.select();
     * table.select(['*']);
     * 
     * // Select specific columns
     * table.select(['name', 'email']);
     * 
     * // Select with WHERE clause
     * table.select(['*'], { column: 'id', operator: '=', value: 1 });
     * table.select(['*'], { column: 'age', operator: '>', value: 18 });
     */
    select(columnNames = ['*'], whereClause = null) {
        // Determine which columns to return
        const columnsToReturn = (columnNames.includes('*') || columnNames.length === 0)
            ? this.columns.map(c => c.name)
            : columnNames;

        // Validate requested columns exist
        for (const colName of columnsToReturn) {
            if (!this.columnMap[colName]) {
                throw new Error(`Unknown column: '${colName}'`);
            }
        }

        // Filter rows based on WHERE clause
        let resultRows = this.rows;

        if (whereClause) {
            resultRows = this._filterRows(whereClause);
        }

        // Project only requested columns
        return resultRows.map(row => {
            const projectedRow = {};
            for (const colName of columnsToReturn) {
                projectedRow[colName] = row[colName];
            }
            return projectedRow;
        });
    }

    /**
     * Finds a single row by primary key value
     * Uses the index for O(1) lookup if available
     * 
     * @param {*} pkValue - The primary key value to find
     * @returns {Object|null} The found row or null
     * 
     * @example
     * const user = table.findByPrimaryKey(1);
     * // Returns: { id: 1, name: 'Alice', active: true }
     */
    findByPrimaryKey(pkValue) {
        if (!this.primaryKeyColumn) {
            throw new Error(`Table '${this.name}' has no primary key`);
        }

        const pkName = this.primaryKeyColumn.name;

        // Use index for O(1) lookup
        if (this.indexes[pkName]) {
            const rowIndexes = this.indexes[pkName][pkValue];
            if (rowIndexes && rowIndexes.length > 0) {
                return { ...this.rows[rowIndexes[0]] };
            }
            return null;
        }

        // Fallback to linear scan
        return this.rows.find(row => row[pkName] === pkValue) || null;
    }

    // =========================================================================
    // UPDATE OPERATIONS
    // =========================================================================

    /**
     * Updates rows matching the WHERE clause
     * 
     * @param {Object} setClause - Object with column names and new values
     * @param {Object} whereClause - Filter to find rows to update
     * @returns {number} Number of rows updated
     * 
     * @example
     * // Update a single row
     * table.update(
     *   { active: false },
     *   { column: 'id', operator: '=', value: 1 }
     * );
     * 
     * // Update multiple rows
     * table.update(
     *   { active: true },
     *   { column: 'age', operator: '>', value: 18 }
     * );
     */
    update(setClause, whereClause) {
        if (!whereClause) {
            throw new Error('UPDATE requires a WHERE clause for safety');
        }

        // Validate columns in SET clause
        for (const colName of Object.keys(setClause)) {
            if (!this.columnMap[colName]) {
                throw new Error(`Unknown column: '${colName}'`);
            }
        }

        // Find rows to update
        const rowsToUpdate = [];
        for (let i = 0; i < this.rows.length; i++) {
            if (this._rowMatchesWhere(this.rows[i], whereClause)) {
                rowsToUpdate.push(i);
            }
        }

        // Perform updates
        let updatedCount = 0;
        for (const rowIndex of rowsToUpdate) {
            const row = this.rows[rowIndex];
            const oldValues = { ...row };

            // Validate and apply updates
            for (const [colName, newValue] of Object.entries(setClause)) {
                const column = this.columnMap[colName];

                // Validate the new value
                column.validate(newValue);

                // Check UNIQUE constraint for new value
                if (column.unique || column.primaryKey) {
                    if (newValue !== oldValues[colName]) {
                        if (newValue !== null && newValue !== undefined) {
                            if (this.uniqueMap[colName].has(newValue)) {
                                throw new Error(
                                    `UNIQUE constraint violation: Value '${newValue}' ` +
                                    `already exists in column '${colName}'`
                                );
                            }
                        }
                    }
                }
            }

            // Apply updates and update tracking structures
            for (const [colName, newValue] of Object.entries(setClause)) {
                const column = this.columnMap[colName];
                const oldValue = oldValues[colName];

                // Update unique map
                if (column.unique || column.primaryKey) {
                    if (oldValue !== null && oldValue !== undefined) {
                        this.uniqueMap[colName].delete(oldValue);
                    }
                    if (newValue !== null && newValue !== undefined) {
                        this.uniqueMap[colName].add(newValue);
                    }
                }

                // Update index
                if (this.indexes[colName]) {
                    this._updateIndexOnUpdate(colName, oldValue, newValue, rowIndex);
                }

                // Apply the update
                row[colName] = newValue;
            }

            updatedCount++;
        }

        return updatedCount;
    }

    // =========================================================================
    // DELETE OPERATIONS
    // =========================================================================

    /**
     * Deletes rows matching the WHERE clause
     * 
     * @param {Object} whereClause - Filter to find rows to delete
     * @returns {number} Number of rows deleted
     * 
     * @example
     * table.delete({ column: 'id', operator: '=', value: 1 });
     * table.delete({ column: 'active', operator: '=', value: false });
     */
    delete(whereClause) {
        if (!whereClause) {
            throw new Error('DELETE requires a WHERE clause for safety');
        }

        // Find rows to delete (collect indexes in reverse order for safe removal)
        const rowIndexesToDelete = [];
        for (let i = this.rows.length - 1; i >= 0; i--) {
            if (this._rowMatchesWhere(this.rows[i], whereClause)) {
                rowIndexesToDelete.push(i);
            }
        }

        // Delete rows (in reverse order to maintain correct indexes)
        for (const rowIndex of rowIndexesToDelete) {
            const row = this.rows[rowIndex];

            // Remove from unique maps
            for (const column of this.columns) {
                if (column.unique || column.primaryKey) {
                    const value = row[column.name];
                    if (value !== null && value !== undefined) {
                        this.uniqueMap[column.name].delete(value);
                    }
                }
            }

            // Remove from indexes
            this._updateIndexesOnDelete(row, rowIndex);

            // Remove the row
            this.rows.splice(rowIndex, 1);
        }

        // Rebuild indexes after deletion (indexes are invalidated by splice)
        this._rebuildAllIndexes();

        return rowIndexesToDelete.length;
    }

    /**
     * Deletes all rows from the table (TRUNCATE)
     * 
     * @returns {number} Number of rows deleted
     */
    truncate() {
        const count = this.rows.length;

        // Clear all data
        this.rows = [];

        // Clear unique maps
        for (const colName of Object.keys(this.uniqueMap)) {
            this.uniqueMap[colName].clear();
        }

        // Clear indexes
        for (const colName of Object.keys(this.indexes)) {
            this.indexes[colName] = {};
        }

        return count;
    }

    // =========================================================================
    // INDEXING
    // =========================================================================

    /**
     * Creates an index on a column for faster lookups
     * 
     * An index is like a book's index - instead of reading every page
     * to find a topic, you look it up in the index and go directly to
     * the right page.
     * 
     * @param {string} columnName - Column to index
     * 
     * @example
     * table.createIndex('email');
     * // Now lookups by email are O(1) instead of O(n)
     */
    createIndex(columnName) {
        if (!this.columnMap[columnName]) {
            throw new Error(`Cannot create index: Unknown column '${columnName}'`);
        }

        // Initialize the index
        this.indexes[columnName] = {};

        // Populate the index with existing data
        for (let i = 0; i < this.rows.length; i++) {
            const value = this.rows[i][columnName];
            if (value !== null && value !== undefined) {
                if (!this.indexes[columnName][value]) {
                    this.indexes[columnName][value] = [];
                }
                this.indexes[columnName][value].push(i);
            }
        }
    }

    /**
     * Drops an index from a column
     * 
     * @param {string} columnName - Column to remove index from
     */
    dropIndex(columnName) {
        delete this.indexes[columnName];
    }

    // =========================================================================
    // PRIVATE HELPER METHODS
    // =========================================================================

    /**
     * Filters rows based on a WHERE clause
     * 
     * @private
     * @param {Object} whereClause - Filter conditions
     * @returns {Object[]} Filtered rows
     */
    _filterRows(whereClause) {
        const { column, operator, value } = whereClause;

        // Try to use index for equality checks
        if (operator === '=' && this.indexes[column]) {
            const rowIndexes = this.indexes[column][value] || [];
            return rowIndexes.map(i => ({ ...this.rows[i] }));
        }

        // Linear scan for other operators
        return this.rows.filter(row => this._rowMatchesWhere(row, whereClause));
    }

    /**
     * Checks if a row matches a WHERE clause
     * 
     * @private
     * @param {Object} row - Row to check
     * @param {Object} whereClause - Condition to check against
     * @returns {boolean} True if row matches
     */
    _rowMatchesWhere(row, whereClause) {
        const { column, operator, value } = whereClause;
        const rowValue = row[column];

        switch (operator) {
            case '=':
            case '==':
                return rowValue === value;
            case '!=':
            case '<>':
                return rowValue !== value;
            case '>':
                return rowValue > value;
            case '<':
                return rowValue < value;
            case '>=':
                return rowValue >= value;
            case '<=':
                return rowValue <= value;
            case 'LIKE':
                // Simple LIKE implementation (% as wildcard)
                if (typeof rowValue !== 'string') return false;
                const pattern = value
                    .replace(/%/g, '.*')
                    .replace(/_/g, '.');
                return new RegExp(`^${pattern}$`, 'i').test(rowValue);
            default:
                throw new Error(`Unknown operator: '${operator}'`);
        }
    }

    /**
     * Updates indexes when a new row is inserted
     * @private
     */
    _updateIndexesOnInsert(row, rowIndex) {
        for (const colName of Object.keys(this.indexes)) {
            const value = row[colName];
            if (value !== null && value !== undefined) {
                if (!this.indexes[colName][value]) {
                    this.indexes[colName][value] = [];
                }
                this.indexes[colName][value].push(rowIndex);
            }
        }
    }

    /**
     * Updates a single index when a value is updated
     * @private
     */
    _updateIndexOnUpdate(colName, oldValue, newValue, rowIndex) {
        // Remove old value from index
        if (oldValue !== null && oldValue !== undefined) {
            const oldIndexes = this.indexes[colName][oldValue];
            if (oldIndexes) {
                const idx = oldIndexes.indexOf(rowIndex);
                if (idx !== -1) {
                    oldIndexes.splice(idx, 1);
                }
                if (oldIndexes.length === 0) {
                    delete this.indexes[colName][oldValue];
                }
            }
        }

        // Add new value to index
        if (newValue !== null && newValue !== undefined) {
            if (!this.indexes[colName][newValue]) {
                this.indexes[colName][newValue] = [];
            }
            this.indexes[colName][newValue].push(rowIndex);
        }
    }

    /**
     * Updates indexes when a row is deleted
     * @private
     */
    _updateIndexesOnDelete(row, rowIndex) {
        for (const colName of Object.keys(this.indexes)) {
            const value = row[colName];
            if (value !== null && value !== undefined) {
                const indexes = this.indexes[colName][value];
                if (indexes) {
                    const idx = indexes.indexOf(rowIndex);
                    if (idx !== -1) {
                        indexes.splice(idx, 1);
                    }
                    if (indexes.length === 0) {
                        delete this.indexes[colName][value];
                    }
                }
            }
        }
    }

    /**
     * Rebuilds all indexes (used after delete operations)
     * @private
     */
    _rebuildAllIndexes() {
        const indexedColumns = Object.keys(this.indexes);
        for (const colName of indexedColumns) {
            this.indexes[colName] = {};
        }

        for (let i = 0; i < this.rows.length; i++) {
            for (const colName of indexedColumns) {
                const value = this.rows[i][colName];
                if (value !== null && value !== undefined) {
                    if (!this.indexes[colName][value]) {
                        this.indexes[colName][value] = [];
                    }
                    this.indexes[colName][value].push(i);
                }
            }
        }
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Returns the number of rows in the table
     * @returns {number} Row count
     */
    count() {
        return this.rows.length;
    }

    /**
     * Returns the column names in order
     * @returns {string[]} Array of column names
     */
    getColumnNames() {
        return this.columns.map(c => c.name);
    }

    /**
     * Returns all rows as a deep copy
     * @returns {Object[]} Copy of all rows
     */
    getAllRows() {
        return this.rows.map(row => ({ ...row }));
    }

    /**
     * Returns a string representation of the table schema
     * @returns {string} Table definition
     */
    toString() {
        const columnDefs = this.columns.map(c => c.toString()).join(', ');
        return `TABLE ${this.name} (${columnDefs})`;
    }
}

module.exports = Table;