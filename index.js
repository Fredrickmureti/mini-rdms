/**
 * =============================================================================
 * MINI-RDBMS - Main Entry Point
 * =============================================================================
 * 
 * A simple relational database management system built from scratch in Node.js.
 * 
 * This file serves as the main entry point and exports all public modules
 * for programmatic use.
 * 
 * QUICK START:
 * ------------
 * 
 * # Interactive REPL mode
 * npm run repl
 * 
 * # Start the web server
 * npm run server
 * 
 * # Run the demo with sample data
 * npm run demo
 * 
 * PROGRAMMATIC USAGE:
 * -------------------
 * 
 * const { Database, Table, Column, QueryEngine } = require('mini-rdbms');
 * 
 * // Create a database
 * const db = new Database('myapp');
 * 
 * // Create a table
 * const columns = [
 *   new Column('id', 'INT', { primaryKey: true }),
 *   new Column('name', 'TEXT', { notNull: true }),
 *   new Column('email', 'TEXT', { unique: true })
 * ];
 * const usersTable = new Table('users', columns);
 * db.createTable('users', usersTable);
 * 
 * // Use the query engine for SQL
 * const engine = new QueryEngine(db);
 * engine.execute("INSERT INTO users VALUES (1, 'Alice', 'alice@example.com')");
 * const result = engine.execute("SELECT * FROM users");
 * console.log(result.data);
 * 
 * =============================================================================
 */

// Core Components
const Database = require('./src/database');
const DatabaseManager = require('./src/DatabaseManager');
const Table = require('./src/core/Table');
const Column = require('./src/core/Column');
const Index = require('./src/core/Index');

// Parser and Engine
const SQLParser = require('./src/parser/SQLParser');
const QueryEngine = require('./src/engine/QueryEngine');

// REPL
const REPL = require('./src/repl/repl');

/**
 * Creates a new Mini-RDBMS instance with a DatabaseManager and query engine
 * 
 * This is the recommended way to create a new RDBMS instance as it supports
 * CREATE DATABASE, USE, DROP DATABASE and other database-level operations.
 * 
 * @param {string} [defaultDb='default'] - Default database name to create
 * @returns {Object} Object containing manager and engine
 * 
 * @example
 * const { manager, engine } = require('mini-rdbms').create('myapp');
 * engine.execute("CREATE DATABASE testdb");
 * engine.execute("USE testdb");
 * engine.execute("CREATE TABLE users (id INT PRIMARY KEY, name TEXT)");
 */
function create(defaultDb = 'default') {
    const manager = new DatabaseManager({ defaultDatabase: defaultDb });
    const engine = new QueryEngine(manager);
    return { manager, engine, db: manager.getCurrentDatabase(), database: manager.getCurrentDatabase() };
}

/**
 * Creates a simple database instance (legacy mode, no multi-database support)
 * 
 * @param {string} [name='default'] - Database name
 * @returns {Object} Object containing database and engine
 * @deprecated Use create() instead for full database support
 * 
 * @example
 * const { db, engine } = require('mini-rdbms').createSimple('myapp');
 */
function createSimple(name = 'default') {
    const db = new Database(name);
    const engine = new QueryEngine(db);
    return { db, database: db, engine };
}

/**
 * Starts the interactive REPL
 * 
 * @param {DatabaseManager|Database} [managerOrDatabase] - Optional manager or database to use
 * 
 * @example
 * require('mini-rdbms').startREPL();
 */
function startREPL(managerOrDatabase) {
    const repl = new REPL(managerOrDatabase);
    repl.start();
}

// Export everything
module.exports = {
    // Factory functions
    create,
    createSimple,
    startREPL,

    // Core classes
    Database,
    DatabaseManager,
    Table,
    Column,
    Index,

    // Parser and Engine
    SQLParser,
    QueryEngine,

    // REPL
    REPL
};

// =========================================================================
// CLI HANDLING
// =========================================================================

/**
 * If this file is run directly, start the REPL
 */
if (require.main === module) {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   Mini-RDBMS                                                  ║
║   A Simple Relational Database Management System              ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   Usage:                                                      ║
║     npm run repl     - Start interactive SQL REPL             ║
║     npm run server   - Start HTTP API server                  ║
║     npm run demo     - Run demo with sample data              ║
║     npm test         - Run tests                              ║
║                                                               ║
║   Programmatic:                                               ║
║     const { create } = require('mini-rdbms');                 ║
║     const { db, engine } = create('mydb');                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

    // Start REPL by default
    startREPL();
}
