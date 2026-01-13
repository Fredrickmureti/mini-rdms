/**
 * =============================================================================
 * DATABASE CLASS
 * =============================================================================
 * 
 * The Database is the top-level container that manages multiple tables.
 * Think of it as a named collection of related tables.
 * 
 * CONCEPTS COVERED:
 * -----------------
 * 1. Table Management: Create, get, drop, and list tables
 * 2. Join Operations: Combine data from multiple tables
 * 3. Cross-table Queries: Operations that span multiple tables
 * 
 * VISUAL REPRESENTATION:
 * ----------------------
 * Database: my_app_db
 * ┌───────────────────────────────────────────────────────────┐
 * │                                                           │
 * │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
 * │  │   users     │  │   posts     │  │  comments   │       │
 * │  │ ─────────── │  │ ─────────── │  │ ─────────── │       │
 * │  │ id (PK)     │  │ id (PK)     │  │ id (PK)     │       │
 * │  │ name        │◄─┤ user_id (FK)│◄─┤ post_id (FK)│       │
 * │  │ email       │  │ title       │  │ user_id (FK)│       │
 * │  │ created_at  │  │ content     │  │ content     │       │
 * │  └─────────────┘  └─────────────┘  └─────────────┘       │
 * │                                                           │
 * └───────────────────────────────────────────────────────────┘
 * 
 * USAGE EXAMPLE:
 * --------------
 * const db = new Database();
 * 
 * // Create tables
 * db.createTable('users', usersTable);
 * db.createTable('posts', postsTable);
 * 
 * // Get a table
 * const users = db.getTable('users');
 * 
 * // Perform a join
 * const results = db.join('users', 'posts', 'id', 'user_id');
 * 
 * =============================================================================
 */

const Table = require('./core/Table');
const Column = require('./core/Column');

class Database {
    /**
     * Creates a new Database instance
     * 
     * @param {string} [name='default'] - Name of the database
     * 
     * @example
     * const db = new Database('my_app');
     */
    constructor(name = 'default') {
        this.name = name;

        // Store tables in an object (hash map)
        // Key: table name (string)
        // Value: Table instance
        this.tables = {};
    }

    // =========================================================================
    // TABLE MANAGEMENT
    // =========================================================================

    /**
     * Creates a new table in the database
     * 
     * @param {string} tableName - Name for the new table
     * @param {Table} table - Table instance to add
     * @throws {Error} If table already exists
     * 
     * @example
     * const columns = [
     *   new Column('id', 'INT', { primaryKey: true }),
     *   new Column('name', 'TEXT', { notNull: true })
     * ];
     * const usersTable = new Table('users', columns);
     * db.createTable('users', usersTable);
     */
    createTable(tableName, table) {
        // Check if table already exists
        if (this.tables[tableName]) {
            throw new Error(`Table '${tableName}' already exists in database '${this.name}'`);
        }

        // Validate that we're adding a proper Table instance
        if (!(table instanceof Table)) {
            throw new Error('Second argument must be a Table instance');
        }

        // Add table to database
        this.tables[tableName] = table;

        return table;
    }

    /**
     * Creates a table from a schema definition (helper method)
     * 
     * @param {string} tableName - Name for the new table
     * @param {Object[]} columnDefs - Array of column definitions
     * @returns {Table} The created table
     * 
     * @example
     * db.createTableFromSchema('users', [
     *   { name: 'id', type: 'INT', primaryKey: true },
     *   { name: 'name', type: 'TEXT', notNull: true },
     *   { name: 'email', type: 'TEXT', unique: true }
     * ]);
     */
    createTableFromSchema(tableName, columnDefs) {
        const columns = columnDefs.map(def => Column.fromObject(def));
        const table = new Table(tableName, columns);
        return this.createTable(tableName, table);
    }

    /**
     * Gets a table by name
     * 
     * @param {string} tableName - Name of the table to retrieve
     * @returns {Table} The requested table
     * @throws {Error} If table doesn't exist
     * 
     * @example
     * const users = db.getTable('users');
     * users.insert({ id: 1, name: 'Alice' });
     */
    getTable(tableName) {
        const table = this.tables[tableName];
        
        if (!table) {
            throw new Error(`Table '${tableName}' does not exist in database '${this.name}'`);
        }

        return table;
    }

    /**
     * Checks if a table exists
     * 
     * @param {string} tableName - Name of the table to check
     * @returns {boolean} True if table exists
     * 
     * @example
     * if (db.hasTable('users')) {
     *   console.log('Users table exists!');
     * }
     */
    hasTable(tableName) {
        return tableName in this.tables;
    }

    /**
     * Drops (deletes) a table from the database
     * 
     * @param {string} tableName - Name of the table to drop
     * @throws {Error} If table doesn't exist
     * 
     * @example
     * db.dropTable('temporary_data');
     */
    dropTable(tableName) {
        if (!this.tables[tableName]) {
            throw new Error(`Cannot drop table '${tableName}': Table does not exist`);
        }

        delete this.tables[tableName];
    }

    /**
     * Lists all table names in the database
     * 
     * @returns {string[]} Array of table names
     * 
     * @example
     * const tables = db.listTables();
     * console.log(tables); // ['users', 'posts', 'comments']
     */
    listTables() {
        return Object.keys(this.tables);
    }

    // =========================================================================
    // JOIN OPERATIONS
    // =========================================================================

    /**
     * Performs an INNER JOIN between two tables
     * 
     * An INNER JOIN returns rows that have matching values in both tables.
     * Only rows where the join condition is satisfied are returned.
     * 
     * VISUAL EXAMPLE:
     * ---------------
     * Table: users                  Table: orders
     * ┌────┬─────────┐              ┌────┬─────────┬────────┐
     * │ id │ name    │              │ id │ user_id │ amount │
     * ├────┼─────────┤              ├────┼─────────┼────────┤
     * │ 1  │ Alice   │              │ 1  │ 1       │ 100    │
     * │ 2  │ Bob     │              │ 2  │ 1       │ 200    │
     * │ 3  │ Charlie │              │ 3  │ 2       │ 150    │
     * └────┴─────────┘              └────┴─────────┴────────┘
     * 
     * JOIN users.id = orders.user_id:
     * ┌──────────────┬────────────┬──────────────┬────────────────┐
     * │ users.id     │ users.name │ orders.id    │ orders.amount  │
     * ├──────────────┼────────────┼──────────────┼────────────────┤
     * │ 1            │ Alice      │ 1            │ 100            │
     * │ 1            │ Alice      │ 2            │ 200            │
     * │ 2            │ Bob        │ 3            │ 150            │
     * └──────────────┴────────────┴──────────────┴────────────────┘
     * (Charlie is excluded - no matching orders)
     * 
     * @param {string} table1Name - Name of the first (left) table
     * @param {string} table2Name - Name of the second (right) table
     * @param {string} column1 - Join column from first table
     * @param {string} column2 - Join column from second table
     * @returns {Object[]} Array of joined rows
     * 
     * @example
     * const results = db.join('users', 'orders', 'id', 'user_id');
     */
    join(table1Name, table2Name, column1, column2) {
        // Get both tables
        const table1 = this.getTable(table1Name);
        const table2 = this.getTable(table2Name);

        // Validate columns exist
        if (!table1.columnMap[column1]) {
            throw new Error(`Column '${column1}' does not exist in table '${table1Name}'`);
        }
        if (!table2.columnMap[column2]) {
            throw new Error(`Column '${column2}' does not exist in table '${table2Name}'`);
        }

        const results = [];

        // Get all rows from both tables
        const rows1 = table1.getAllRows();
        const rows2 = table2.getAllRows();

        // Build an index on table2's join column for O(n) instead of O(n²)
        const table2Index = {};
        for (const row2 of rows2) {
            const key = row2[column2];
            if (!table2Index[key]) {
                table2Index[key] = [];
            }
            table2Index[key].push(row2);
        }

        // Perform the join
        for (const row1 of rows1) {
            const joinValue = row1[column1];
            const matchingRows = table2Index[joinValue] || [];

            for (const row2 of matchingRows) {
                // Combine rows with prefixed column names to avoid conflicts
                const joinedRow = {};

                // Add columns from table1 with prefix
                for (const colName of Object.keys(row1)) {
                    joinedRow[`${table1Name}.${colName}`] = row1[colName];
                }

                // Add columns from table2 with prefix
                for (const colName of Object.keys(row2)) {
                    joinedRow[`${table2Name}.${colName}`] = row2[colName];
                }

                results.push(joinedRow);
            }
        }

        return results;
    }

    /**
     * Performs a LEFT JOIN between two tables
     * 
     * A LEFT JOIN returns all rows from the left table, and matched rows
     * from the right table. If no match, NULL values are used for right table columns.
     * 
     * @param {string} table1Name - Name of the left table
     * @param {string} table2Name - Name of the right table
     * @param {string} column1 - Join column from left table
     * @param {string} column2 - Join column from right table
     * @returns {Object[]} Array of joined rows
     */
    leftJoin(table1Name, table2Name, column1, column2) {
        const table1 = this.getTable(table1Name);
        const table2 = this.getTable(table2Name);

        if (!table1.columnMap[column1]) {
            throw new Error(`Column '${column1}' does not exist in table '${table1Name}'`);
        }
        if (!table2.columnMap[column2]) {
            throw new Error(`Column '${column2}' does not exist in table '${table2Name}'`);
        }

        const results = [];
        const rows1 = table1.getAllRows();
        const rows2 = table2.getAllRows();

        // Build index on table2
        const table2Index = {};
        for (const row2 of rows2) {
            const key = row2[column2];
            if (!table2Index[key]) {
                table2Index[key] = [];
            }
            table2Index[key].push(row2);
        }

        // Perform left join
        for (const row1 of rows1) {
            const joinValue = row1[column1];
            const matchingRows = table2Index[joinValue] || [];

            if (matchingRows.length === 0) {
                // No match - include left row with NULLs for right columns
                const joinedRow = {};

                for (const colName of Object.keys(row1)) {
                    joinedRow[`${table1Name}.${colName}`] = row1[colName];
                }

                for (const col of table2.columns) {
                    joinedRow[`${table2Name}.${col.name}`] = null;
                }

                results.push(joinedRow);
            } else {
                // Has matches - include all matching combinations
                for (const row2 of matchingRows) {
                    const joinedRow = {};

                    for (const colName of Object.keys(row1)) {
                        joinedRow[`${table1Name}.${colName}`] = row1[colName];
                    }

                    for (const colName of Object.keys(row2)) {
                        joinedRow[`${table2Name}.${colName}`] = row2[colName];
                    }

                    results.push(joinedRow);
                }
            }
        }

        return results;
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Gets statistics about the database
     * 
     * @returns {Object} Database statistics
     */
    getStats() {
        const stats = {
            name: this.name,
            tableCount: this.listTables().length,
            tables: {}
        };

        for (const [tableName, table] of Object.entries(this.tables)) {
            stats.tables[tableName] = {
                rowCount: table.count(),
                columnCount: table.columns.length,
                columns: table.getColumnNames()
            };
        }

        return stats;
    }

    /**
     * Returns a string representation of the database
     * 
     * @returns {string} Database info
     */
    toString() {
        const tableList = this.listTables().join(', ') || '(no tables)';
        return `Database '${this.name}': [${tableList}]`;
    }

    /**
     * Clears all tables from the database
     * Use with caution!
     */
    clear() {
        this.tables = {};
    }
}

module.exports = Database;