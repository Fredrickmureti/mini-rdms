/**
 * =============================================================================
 * STORAGE - File-based Persistence Layer
 * =============================================================================
 * 
 * This module provides file-based persistence for the mini-RDBMS.
 * It allows databases to survive restarts and be shared across
 * different processes (like the GUI server and REPL).
 * 
 * CONCEPTS COVERED:
 * -----------------
 * 1. Data Serialization: Converting objects to JSON
 * 2. File I/O: Reading and writing to disk
 * 3. Data Integrity: Atomic writes to prevent corruption
 * 
 * STORAGE FORMAT:
 * ---------------
 * data/
 * └── databases.json     <- All databases, tables, and rows
 * 
 * FILE STRUCTURE:
 * ---------------
 * {
 *   "databases": {
 *     "myapp": {
 *       "name": "myapp",
 *       "tables": {
 *         "users": {
 *           "name": "users",
 *           "columns": [...],
 *           "rows": [...]
 *         }
 *       }
 *     }
 *   },
 *   "currentDatabase": "myapp"
 * }
 * 
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

class Storage {
    /**
     * Creates a new Storage instance
     * 
     * @param {string} [dataDir='./data'] - Directory to store data files
     */
    constructor(dataDir = null) {
        // Use data directory relative to project root
        this.dataDir = dataDir || path.join(__dirname, '../../data');
        this.dataFile = path.join(this.dataDir, 'databases.json');
        
        // Ensure data directory exists
        this._ensureDataDir();
    }

    /**
     * Ensures the data directory exists
     * @private
     */
    _ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    /**
     * Saves the entire database manager state to disk
     * 
     * @param {DatabaseManager} manager - DatabaseManager instance to save
     */
    save(manager) {
        const data = this._serializeManager(manager);
        const json = JSON.stringify(data, null, 2);
        
        // Write atomically: write to temp file, then rename
        const tempFile = this.dataFile + '.tmp';
        fs.writeFileSync(tempFile, json, 'utf8');
        fs.renameSync(tempFile, this.dataFile);
    }

    /**
     * Loads database manager state from disk
     * 
     * @returns {Object|null} Serialized state or null if no data
     */
    load() {
        if (!fs.existsSync(this.dataFile)) {
            return null;
        }

        try {
            const json = fs.readFileSync(this.dataFile, 'utf8');
            return JSON.parse(json);
        } catch (error) {
            console.error('Error loading database:', error.message);
            return null;
        }
    }

    /**
     * Checks if there's existing data to load
     * 
     * @returns {boolean} True if data file exists
     */
    hasData() {
        return fs.existsSync(this.dataFile);
    }

    /**
     * Clears all persisted data
     */
    clear() {
        if (fs.existsSync(this.dataFile)) {
            fs.unlinkSync(this.dataFile);
        }
    }

    /**
     * Serializes a DatabaseManager to a plain object
     * 
     * @private
     * @param {DatabaseManager} manager - Manager to serialize
     * @returns {Object} Serialized state
     */
    _serializeManager(manager) {
        const databases = {};

        for (const [dbName, db] of Object.entries(manager.databases)) {
            databases[dbName] = this._serializeDatabase(db);
        }

        return {
            version: 1,
            savedAt: new Date().toISOString(),
            currentDatabase: manager.currentDatabaseName,
            databases
        };
    }

    /**
     * Serializes a Database to a plain object
     * 
     * @private
     * @param {Database} db - Database to serialize
     * @returns {Object} Serialized database
     */
    _serializeDatabase(db) {
        const tables = {};

        for (const [tableName, table] of Object.entries(db.tables)) {
            tables[tableName] = this._serializeTable(table);
        }

        return {
            name: db.name,
            tables
        };
    }

    /**
     * Serializes a Table to a plain object
     * 
     * @private
     * @param {Table} table - Table to serialize
     * @returns {Object} Serialized table
     */
    _serializeTable(table) {
        return {
            name: table.name,
            columns: table.columns.map(col => ({
                name: col.name,
                type: col.type,
                primaryKey: col.primaryKey,
                notNull: col.notNull,
                unique: col.unique
            })),
            rows: table.rows.map(row => ({ ...row }))
        };
    }

    /**
     * Gets the path to the data file
     * 
     * @returns {string} Path to data file
     */
    getDataFilePath() {
        return this.dataFile;
    }
}

module.exports = Storage;
