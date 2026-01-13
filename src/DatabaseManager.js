/**
 * =============================================================================
 * DATABASE MANAGER
 * =============================================================================
 * 
 * The DatabaseManager is the top-level component that manages multiple databases.
 * In a real RDBMS, this would be equivalent to the database server itself.
 * 
 * CONCEPTS COVERED:
 * -----------------
 * 1. Database Hierarchy: Server → Databases → Tables → Rows
 * 2. Context Switching: Using different databases
 * 3. Catalog Management: Tracking all databases
 * 4. Persistence: Data survives restarts and is shared across processes
 * 
 * HIERARCHY VISUALIZATION:
 * ------------------------
 * DatabaseManager (Server)
 * │
 * ├── Database: "ecommerce"
 * │   ├── Table: users
 * │   ├── Table: products
 * │   └── Table: orders
 * │
 * ├── Database: "blog"
 * │   ├── Table: posts
 * │   ├── Table: comments
 * │   └── Table: categories
 * │
 * └── Database: "analytics"
 *     ├── Table: events
 *     └── Table: metrics
 * 
 * SQL COMMANDS:
 * -------------
 * CREATE DATABASE db_name;     -- Create a new database
 * USE db_name;                 -- Switch to a database
 * DROP DATABASE db_name;       -- Delete a database
 * SHOW DATABASES;              -- List all databases
 * 
 * USAGE EXAMPLE:
 * --------------
 * const manager = new DatabaseManager();
 * 
 * // Create databases
 * manager.createDatabase('ecommerce');
 * manager.createDatabase('blog');
 * 
 * // Switch to a database
 * manager.use('ecommerce');
 * 
 * // Get current database
 * const db = manager.getCurrentDatabase();
 * 
 * // List all databases
 * console.log(manager.listDatabases()); // ['ecommerce', 'blog']
 * 
 * =============================================================================
 */

const Database = require('./database');
const Storage = require('./persistence/Storage');
const Table = require('./core/Table');
const Column = require('./core/Column');

class DatabaseManager {
    /**
     * Creates a new DatabaseManager instance
     * 
     * @param {Object} [options={}] - Configuration options
     * @param {string} [options.defaultDatabase='default'] - Name of default database to create
     * @param {boolean} [options.createDefault=true] - Whether to create a default database
     * @param {boolean} [options.persist=true] - Whether to persist data to disk
     * @param {string} [options.dataDir=null] - Custom data directory for persistence
     * 
     * @example
     * // Create with default database and persistence
     * const manager = new DatabaseManager();
     * 
     * // Create without default database
     * const manager = new DatabaseManager({ createDefault: false });
     * 
     * // Create without persistence (in-memory only)
     * const manager = new DatabaseManager({ persist: false });
     */
    constructor(options = {}) {
        const {
            defaultDatabase = 'default',
            createDefault = true,
            persist = true,
            dataDir = null
        } = options;

        /**
         * Map of all databases
         * Key: database name (string)
         * Value: Database instance
         * @type {Object.<string, Database>}
         */
        this.databases = {};

        /**
         * Name of the currently selected database
         * @type {string|null}
         */
        this.currentDatabaseName = null;

        /**
         * Whether to persist changes to disk
         * @type {boolean}
         */
        this.persistEnabled = persist;

        /**
         * Storage instance for persistence
         * @type {Storage|null}
         */
        this.storage = persist ? new Storage(dataDir) : null;

        // Try to load existing data from disk
        if (persist && this.storage.hasData()) {
            this._loadFromDisk();
        } else if (createDefault) {
            // Create a default database if requested and no data exists
            this.createDatabase(defaultDatabase);
            this.use(defaultDatabase);
        }
    }

    // =========================================================================
    // PERSISTENCE
    // =========================================================================

    /**
     * Saves the current state to disk
     * @private
     */
    _save() {
        if (this.persistEnabled && this.storage) {
            this.storage.save(this);
        }
    }

    /**
     * Loads state from disk
     * @private
     */
    _loadFromDisk() {
        const data = this.storage.load();
        if (!data) return;

        // Reconstruct databases from saved data
        for (const [dbName, dbData] of Object.entries(data.databases || {})) {
            const db = new Database(dbName);
            
            // Reconstruct tables
            for (const [tableName, tableData] of Object.entries(dbData.tables || {})) {
                const columns = tableData.columns.map(col => 
                    new Column(col.name, col.type, {
                        primaryKey: col.primaryKey,
                        notNull: col.notNull,
                        unique: col.unique
                    })
                );
                const table = new Table(tableName, columns);
                
                // Add rows
                for (const row of tableData.rows || []) {
                    table.insert(row);
                }
                
                db.createTable(tableName, table);
            }
            
            this.databases[dbName] = db;
        }

        // Restore current database selection
        if (data.currentDatabase && this.databases[data.currentDatabase]) {
            this.currentDatabaseName = data.currentDatabase;
        }
    }

    /**
     * Forces a save to disk (useful for manual saves)
     */
    save() {
        this._save();
    }

    /**
     * Reloads data from disk (discards in-memory changes)
     */
    reload() {
        if (this.persistEnabled && this.storage) {
            this.databases = {};
            this.currentDatabaseName = null;
            this._loadFromDisk();
        }
    }

    // =========================================================================
    // DATABASE MANAGEMENT
    // =========================================================================

    /**
     * Creates a new database
     * 
     * @param {string} name - Name of the database to create
     * @throws {Error} If database already exists or name is invalid
     * @returns {Database} The newly created database
     * 
     * @example
     * manager.createDatabase('my_app');
     * manager.createDatabase('test_db');
     */
    createDatabase(name) {
        // Validate database name
        if (!name || typeof name !== 'string') {
            throw new Error('Database name must be a non-empty string');
        }

        // Check for valid identifier
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            throw new Error(
                `Invalid database name '${name}'. ` +
                'Must start with a letter or underscore, and contain only letters, numbers, and underscores'
            );
        }

        // Check if database already exists
        if (this.databases[name]) {
            throw new Error(`Database '${name}' already exists`);
        }

        // Create the new database
        const db = new Database(name);
        this.databases[name] = db;

        // Save to disk
        this._save();

        return db;
    }

    /**
     * Creates a database if it doesn't exist
     * 
     * @param {string} name - Name of the database
     * @returns {Database} The database (existing or newly created)
     * 
     * @example
     * // Safe creation - won't throw if exists
     * const db = manager.createDatabaseIfNotExists('my_app');
     */
    createDatabaseIfNotExists(name) {
        if (this.databases[name]) {
            return this.databases[name];
        }
        return this.createDatabase(name);
    }

    /**
     * Switches to a database (sets it as current)
     * 
     * @param {string} name - Name of the database to use
     * @throws {Error} If database doesn't exist
     * @returns {Database} The selected database
     * 
     * @example
     * manager.use('ecommerce');
     * const users = manager.getCurrentDatabase().getTable('users');
     */
    use(name) {
        if (!this.databases[name]) {
            throw new Error(`Database '${name}' does not exist`);
        }

        this.currentDatabaseName = name;
        return this.databases[name];
    }

    /**
     * Gets a database by name
     * 
     * @param {string} name - Name of the database
     * @returns {Database|null} The database or null if not found
     * 
     * @example
     * const db = manager.getDatabase('ecommerce');
     * if (db) {
     *   console.log('Found database with', db.listTables().length, 'tables');
     * }
     */
    getDatabase(name) {
        return this.databases[name] || null;
    }

    /**
     * Gets the currently selected database
     * 
     * @returns {Database|null} Current database or null if none selected
     * @throws {Error} If no database is selected (optional, based on strict mode)
     * 
     * @example
     * manager.use('my_app');
     * const db = manager.getCurrentDatabase();
     */
    getCurrentDatabase() {
        if (!this.currentDatabaseName) {
            return null;
        }
        return this.databases[this.currentDatabaseName];
    }

    /**
     * Gets the name of the currently selected database
     * 
     * @returns {string|null} Name of current database or null
     */
    getCurrentDatabaseName() {
        return this.currentDatabaseName;
    }

    /**
     * Drops (deletes) a database
     * 
     * @param {string} name - Name of the database to drop
     * @throws {Error} If database doesn't exist
     * 
     * @example
     * manager.dropDatabase('test_db');
     */
    dropDatabase(name) {
        if (!this.databases[name]) {
            throw new Error(`Database '${name}' does not exist`);
        }

        // If we're dropping the current database, clear the selection
        if (this.currentDatabaseName === name) {
            this.currentDatabaseName = null;
        }

        delete this.databases[name];

        // Save to disk
        this._save();
    }

    /**
     * Drops a database if it exists (no error if missing)
     * 
     * @param {string} name - Name of the database to drop
     * @returns {boolean} True if database was dropped, false if it didn't exist
     * 
     * @example
     * manager.dropDatabaseIfExists('temp_db');
     */
    dropDatabaseIfExists(name) {
        if (this.databases[name]) {
            this.dropDatabase(name);
            return true;
        }
        return false;
    }

    /**
     * Lists all database names
     * 
     * @returns {string[]} Array of database names
     * 
     * @example
     * const databases = manager.listDatabases();
     * console.log(databases); // ['default', 'ecommerce', 'blog']
     */
    listDatabases() {
        return Object.keys(this.databases);
    }

    /**
     * Checks if a database exists
     * 
     * @param {string} name - Name of the database
     * @returns {boolean} True if database exists
     * 
     * @example
     * if (manager.databaseExists('my_app')) {
     *   manager.use('my_app');
     * }
     */
    databaseExists(name) {
        return name in this.databases;
    }

    // =========================================================================
    // STATISTICS & INFO
    // =========================================================================

    /**
     * Gets statistics about the database manager
     * 
     * @returns {Object} Statistics object
     * 
     * @example
     * const stats = manager.getStats();
     * console.log(`Managing ${stats.databaseCount} databases`);
     */
    getStats() {
        const databases = this.listDatabases();
        let totalTables = 0;
        let totalRows = 0;

        databases.forEach(dbName => {
            const db = this.databases[dbName];
            const dbStats = db.getStats();
            totalTables += dbStats.tableCount;
            totalRows += dbStats.totalRows;
        });

        return {
            databaseCount: databases.length,
            totalTables,
            totalRows,
            currentDatabase: this.currentDatabaseName,
            databases: databases.map(name => ({
                name,
                ...this.databases[name].getStats()
            }))
        };
    }

    /**
     * Prints a summary of all databases (for debugging)
     * 
     * @returns {string} Formatted summary string
     */
    toString() {
        const stats = this.getStats();
        let str = `DatabaseManager (${stats.databaseCount} databases)\n`;
        str += `Current: ${stats.currentDatabase || 'none'}\n`;
        str += '─'.repeat(40) + '\n';

        stats.databases.forEach(db => {
            const marker = db.name === this.currentDatabaseName ? '→ ' : '  ';
            str += `${marker}${db.name}: ${db.tableCount} tables, ${db.totalRows} rows\n`;
        });

        return str;
    }
}

module.exports = DatabaseManager;
