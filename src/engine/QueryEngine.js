/**
 * =============================================================================
 * QUERY ENGINE
 * =============================================================================
 * 
 * The Query Engine executes parsed SQL queries against the database.
 * It takes an AST (from SQLParser) and performs the actual operations.
 * 
 * CONCEPTS COVERED:
 * -----------------
 * 1. Query Execution: Translating AST into database operations
 * 2. Result Formatting: Returning consistent result objects
 * 3. Error Handling: Catching and reporting execution errors
 * 
 * ARCHITECTURE:
 * -------------
 *   SQL String
 *       ↓
 *   ┌─────────────┐
 *   │  SQLParser  │  → AST (Abstract Syntax Tree)
 *   └─────────────┘
 *       ↓
 *   ┌─────────────┐
 *   │ QueryEngine │  → Executes AST against Database
 *   └─────────────┘
 *       ↓
 *   Result Object { success, data, message, rowsAffected }
 * 
 * USAGE EXAMPLE:
 * --------------
 * const engine = new QueryEngine(database);
 * 
 * // Execute SQL directly
 * const result = engine.execute('SELECT * FROM users WHERE id = 1');
 * 
 * // Or execute a pre-parsed AST
 * const ast = parser.parse('SELECT * FROM users');
 * const result = engine.executeAST(ast);
 * 
 * =============================================================================
 */

const SQLParser = require('../parser/SQLParser');
const Table = require('../core/Table');
const Column = require('../core/Column');
const DatabaseManager = require('../DatabaseManager');
const Database = require('../database');

class QueryEngine {
    /**
     * Creates a new Query Engine instance
     * 
     * Can work with either:
     * - A DatabaseManager (for multi-database support with CREATE DATABASE, USE, etc.)
     * - A single Database (legacy mode, for backwards compatibility)
     * 
     * @param {Database|DatabaseManager} dbOrManager - Database or DatabaseManager instance
     * 
     * @example
     * // With DatabaseManager (recommended for full SQL support)
     * const manager = new DatabaseManager();
     * const engine = new QueryEngine(manager);
     * engine.execute('CREATE DATABASE myapp');
     * engine.execute('USE myapp');
     * 
     * // With single Database (legacy/simple mode)
     * const db = new Database();
     * const engine = new QueryEngine(db);
     */
    constructor(dbOrManager) {
        if (!dbOrManager) {
            throw new Error('QueryEngine requires a Database or DatabaseManager instance');
        }

        // Detect if we received a DatabaseManager or a plain Database
        if (dbOrManager instanceof DatabaseManager) {
            this.manager = dbOrManager;
            this.database = dbOrManager.getCurrentDatabase();
        } else {
            // Legacy mode: wrap single database
            this.manager = null;
            this.database = dbOrManager;
        }

        this.parser = new SQLParser();
    }

    // =========================================================================
    // MAIN EXECUTION METHODS
    // =========================================================================

    /**
     * Executes a SQL query string
     * 
     * This is the main entry point - it parses the SQL and executes it.
     * 
     * @param {string} sql - SQL query to execute
     * @returns {Object} Result object with success status and data
     * 
     * @example
     * const result = engine.execute('SELECT * FROM users');
     * if (result.success) {
     *   console.log(result.data);
     * } else {
     *   console.error(result.error);
     * }
     */
    execute(sql) {
        try {
            // Parse the SQL into an AST
            const ast = this.parser.parse(sql);

            // Execute the AST
            return this.executeAST(ast);

        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null,
                rowsAffected: 0
            };
        }
    }

    /**
     * Executes a pre-parsed AST
     * 
     * Useful when you've already parsed the SQL or want to build
     * queries programmatically.
     * 
     * @param {Object} ast - Abstract Syntax Tree from SQLParser
     * @returns {Object} Result object
     * 
     * @example
     * const ast = {
     *   type: 'SELECT',
     *   columns: ['*'],
     *   table: 'users',
     *   where: null
     * };
     * const result = engine.executeAST(ast);
     */
    executeAST(ast) {
        try {
            // Route to appropriate handler based on query type
            switch (ast.type) {
                case 'SELECT':
                    return this._executeSelect(ast);

                case 'INSERT':
                    return this._executeInsert(ast);

                case 'UPDATE':
                    return this._executeUpdate(ast);

                case 'DELETE':
                    return this._executeDelete(ast);

                case 'CREATE_TABLE':
                    return this._executeCreateTable(ast);

                case 'DROP_TABLE':
                    return this._executeDropTable(ast);

                case 'CREATE_DATABASE':
                    return this._executeCreateDatabase(ast);

                case 'DROP_DATABASE':
                    return this._executeDropDatabase(ast);

                case 'USE':
                    return this._executeUse(ast);

                case 'SHOW':
                    return this._executeShow(ast);

                default:
                    throw new Error(`Unknown query type: '${ast.type}'`);
            }

        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null,
                rowsAffected: 0
            };
        }
    }

    // =========================================================================
    // SELECT EXECUTION
    // =========================================================================

    /**
     * Executes a SELECT query
     * 
     * @private
     * @param {Object} ast - Parsed SELECT AST
     * @returns {Object} Query result
     */
    _executeSelect(ast) {
        this._requireDatabase();

        // Handle JOIN queries
        if (ast.join) {
            return this._executeSelectWithJoin(ast);
        }

        // Get the table
        const table = this.database.getTable(ast.table);

        // Execute select with optional WHERE
        const rows = table.select(ast.columns, ast.where);

        return {
            success: true,
            data: rows,
            rowsAffected: rows.length,
            message: `Selected ${rows.length} row(s)`
        };
    }

    /**
     * Executes a SELECT query with JOIN
     * 
     * @private
     * @param {Object} ast - Parsed SELECT AST with join
     * @returns {Object} Query result
     */
    _executeSelectWithJoin(ast) {
        this._requireDatabase();

        const { table, join } = ast;

        // Parse join condition: table1.col = table2.col
        const leftParts = join.on.left.split('.');
        const rightParts = join.on.right.split('.');

        // Determine which column belongs to which table
        let leftTable, leftColumn, rightTable, rightColumn;

        if (leftParts[0] === table) {
            leftTable = leftParts[0];
            leftColumn = leftParts[1];
            rightTable = rightParts[0];
            rightColumn = rightParts[1];
        } else {
            leftTable = rightParts[0];
            leftColumn = rightParts[1];
            rightTable = leftParts[0];
            rightColumn = leftParts[1];
        }

        // Perform the join
        let rows = this.database.join(
            leftTable,
            rightTable,
            leftColumn,
            rightColumn
        );

        // Apply WHERE filter if present
        if (ast.where) {
            rows = rows.filter(row => {
                // Try both prefixed and unprefixed column names
                const colName = ast.where.column;
                const value = row[colName] !== undefined 
                    ? row[colName] 
                    : row[`${table}.${colName}`] ?? row[`${join.table}.${colName}`];
                
                return this._evaluateCondition(value, ast.where.operator, ast.where.value);
            });
        }

        // Project columns if specific columns requested
        if (!ast.columns.includes('*')) {
            rows = rows.map(row => {
                const projected = {};
                for (const col of ast.columns) {
                    // Try both prefixed and unprefixed
                    projected[col] = row[col] !== undefined ? row[col] : row;
                }
                return projected;
            });
        }

        return {
            success: true,
            data: rows,
            rowsAffected: rows.length,
            message: `Selected ${rows.length} row(s) with join`
        };
    }

    // =========================================================================
    // INSERT EXECUTION
    // =========================================================================

    /**
     * Executes an INSERT query
     * 
     * @private
     * @param {Object} ast - Parsed INSERT AST
     * @returns {Object} Query result
     */
    _executeInsert(ast) {
        this._requireDatabase();

        const table = this.database.getTable(ast.table);

        // Build row data object
        const rowData = {};

        if (ast.columns.length > 0) {
            // Explicit column list: INSERT INTO t (col1, col2) VALUES (v1, v2)
            if (ast.columns.length !== ast.values.length) {
                throw new Error(
                    `Column count (${ast.columns.length}) doesn't match ` +
                    `value count (${ast.values.length})`
                );
            }

            for (let i = 0; i < ast.columns.length; i++) {
                rowData[ast.columns[i]] = ast.values[i];
            }
        } else {
            // No column list: INSERT INTO t VALUES (v1, v2, ...)
            // Values must match table column order
            const columnNames = table.getColumnNames();

            if (columnNames.length !== ast.values.length) {
                throw new Error(
                    `Value count (${ast.values.length}) doesn't match ` +
                    `column count (${columnNames.length})`
                );
            }

            for (let i = 0; i < columnNames.length; i++) {
                rowData[columnNames[i]] = ast.values[i];
            }
        }

        // Insert the row
        const insertedRow = table.insert(rowData);

        return {
            success: true,
            data: insertedRow,
            rowsAffected: 1,
            message: 'Inserted 1 row'
        };
    }

    // =========================================================================
    // UPDATE EXECUTION
    // =========================================================================

    /**
     * Executes an UPDATE query
     * 
     * @private
     * @param {Object} ast - Parsed UPDATE AST
     * @returns {Object} Query result
     */
    _executeUpdate(ast) {
        this._requireDatabase();

        const table = this.database.getTable(ast.table);

        if (!ast.where) {
            throw new Error('UPDATE without WHERE clause is not allowed for safety');
        }

        // Execute update
        const rowsAffected = table.update(ast.set, ast.where);

        return {
            success: true,
            data: null,
            rowsAffected: rowsAffected,
            message: `Updated ${rowsAffected} row(s)`
        };
    }

    // =========================================================================
    // DELETE EXECUTION
    // =========================================================================

    /**
     * Executes a DELETE query
     * 
     * @private
     * @param {Object} ast - Parsed DELETE AST
     * @returns {Object} Query result
     */
    _executeDelete(ast) {
        this._requireDatabase();

        const table = this.database.getTable(ast.table);

        if (!ast.where) {
            throw new Error('DELETE without WHERE clause is not allowed for safety');
        }

        // Execute delete
        const rowsAffected = table.delete(ast.where);

        return {
            success: true,
            data: null,
            rowsAffected: rowsAffected,
            message: `Deleted ${rowsAffected} row(s)`
        };
    }

    // =========================================================================
    // CREATE TABLE EXECUTION
    // =========================================================================

    /**
     * Executes a CREATE TABLE query
     * 
     * @private
     * @param {Object} ast - Parsed CREATE TABLE AST
     * @returns {Object} Query result
     */
    _executeCreateTable(ast) {
        this._requireDatabase();

        // Convert column definitions to Column instances
        const columns = ast.columns.map(colDef => 
            new Column(colDef.name, colDef.type, {
                primaryKey: colDef.primaryKey,
                notNull: colDef.notNull,
                unique: colDef.unique
            })
        );

        // Create the table
        const table = new Table(ast.table, columns);

        // Add to database
        this.database.createTable(ast.table, table);

        return {
            success: true,
            data: null,
            rowsAffected: 0,
            message: `Table '${ast.table}' created successfully`
        };
    }

    // =========================================================================
    // DROP TABLE EXECUTION
    // =========================================================================

    /**
     * Executes a DROP TABLE query
     * 
     * @private
     * @param {Object} ast - Parsed DROP TABLE AST
     * @returns {Object} Query result
     */
    _executeDropTable(ast) {
        this._requireDatabase();

        this.database.dropTable(ast.table);

        return {
            success: true,
            data: null,
            rowsAffected: 0,
            message: `Table '${ast.table}' dropped successfully`
        };
    }

    // =========================================================================
    // DATABASE OPERATIONS
    // =========================================================================

    /**
     * Ensures the query engine has a DatabaseManager for database operations
     * 
     * @private
     * @throws {Error} If no DatabaseManager is configured
     */
    _requireManager() {
        if (!this.manager) {
            throw new Error(
                'Database operations (CREATE DATABASE, USE, etc.) require a DatabaseManager. ' +
                'Create the QueryEngine with a DatabaseManager instance instead of a Database.'
            );
        }
    }

    /**
     * Ensures there's a current database selected
     * 
     * @private
     * @throws {Error} If no database is currently selected
     */
    _requireDatabase() {
        if (!this.database) {
            throw new Error(
                'No database selected. Use "CREATE DATABASE db_name" and "USE db_name" first.'
            );
        }
    }

    /**
     * Executes a CREATE DATABASE query
     * 
     * @private
     * @param {Object} ast - Parsed CREATE DATABASE AST
     * @returns {Object} Query result
     */
    _executeCreateDatabase(ast) {
        this._requireManager();

        try {
            if (ast.ifNotExists && this.manager.databaseExists(ast.database)) {
                return {
                    success: true,
                    data: null,
                    rowsAffected: 0,
                    message: `Database '${ast.database}' already exists`
                };
            }

            this.manager.createDatabase(ast.database);

            return {
                success: true,
                data: null,
                rowsAffected: 0,
                message: `Database '${ast.database}' created successfully`
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Executes a DROP DATABASE query
     * 
     * @private
     * @param {Object} ast - Parsed DROP DATABASE AST
     * @returns {Object} Query result
     */
    _executeDropDatabase(ast) {
        this._requireManager();

        if (ast.ifExists && !this.manager.databaseExists(ast.database)) {
            return {
                success: true,
                data: null,
                rowsAffected: 0,
                message: `Database '${ast.database}' does not exist`
            };
        }

        this.manager.dropDatabase(ast.database);

        // If we dropped the current database, clear our reference
        if (this.database && this.database.name === ast.database) {
            this.database = null;
        }

        return {
            success: true,
            data: null,
            rowsAffected: 0,
            message: `Database '${ast.database}' dropped successfully`
        };
    }

    /**
     * Executes a USE query (switch to a database)
     * 
     * @private
     * @param {Object} ast - Parsed USE AST
     * @returns {Object} Query result
     */
    _executeUse(ast) {
        this._requireManager();

        this.manager.use(ast.database);
        this.database = this.manager.getCurrentDatabase();

        return {
            success: true,
            data: null,
            rowsAffected: 0,
            message: `Database changed to '${ast.database}'`
        };
    }

    /**
     * Executes a SHOW query (SHOW DATABASES or SHOW TABLES)
     * 
     * @private
     * @param {Object} ast - Parsed SHOW AST
     * @returns {Object} Query result
     */
    _executeShow(ast) {
        if (ast.target === 'DATABASES') {
            this._requireManager();
            const databases = this.manager.listDatabases();

            return {
                success: true,
                data: databases.map(name => ({ Database: name })),
                rowsAffected: databases.length,
                message: `Found ${databases.length} database(s)`
            };
        }

        if (ast.target === 'TABLES') {
            this._requireDatabase();
            const tables = this.database.listTables();

            return {
                success: true,
                data: tables.map(name => ({ Table: name })),
                rowsAffected: tables.length,
                message: `Found ${tables.length} table(s) in '${this.database.name}'`
            };
        }

        throw new Error(`Unknown SHOW target: '${ast.target}'`);
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Evaluates a comparison condition
     * 
     * @private
     * @param {*} value - The actual value
     * @param {string} operator - Comparison operator
     * @param {*} compareValue - Value to compare against
     * @returns {boolean} Result of comparison
     */
    _evaluateCondition(value, operator, compareValue) {
        switch (operator) {
            case '=':
            case '==':
                return value === compareValue;
            case '!=':
            case '<>':
                return value !== compareValue;
            case '>':
                return value > compareValue;
            case '<':
                return value < compareValue;
            case '>=':
                return value >= compareValue;
            case '<=':
                return value <= compareValue;
            case 'LIKE':
                if (typeof value !== 'string') return false;
                const pattern = compareValue
                    .replace(/%/g, '.*')
                    .replace(/_/g, '.');
                return new RegExp(`^${pattern}$`, 'i').test(value);
            default:
                return false;
        }
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Gets the list of tables in the database
     * 
     * @returns {string[]} Array of table names
     */
    getTables() {
        return this.database.listTables();
    }

    /**
     * Gets information about a specific table
     * 
     * @param {string} tableName - Name of the table
     * @returns {Object} Table schema information
     */
    describeTable(tableName) {
        const table = this.database.getTable(tableName);
        return {
            name: table.name,
            columns: table.columns.map(col => ({
                name: col.name,
                type: col.type,
                primaryKey: col.primaryKey,
                notNull: col.notNull,
                unique: col.unique
            })),
            rowCount: table.count()
        };
    }

    /**
     * Gets database statistics
     * 
     * @returns {Object} Database stats
     */
    getStats() {
        return this.database.getStats();
    }
}

module.exports = QueryEngine;
