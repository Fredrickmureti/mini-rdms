/**
 * =============================================================================
 * REPL (Read-Eval-Print Loop)
 * =============================================================================
 * 
 * The REPL provides an interactive command-line interface for executing
 * SQL queries against our mini-RDBMS.
 * 
 * CONCEPTS COVERED:
 * -----------------
 * 1. Interactive CLI: Building command-line applications
 * 2. Command Processing: Handling user input
 * 3. Result Formatting: Displaying data in table format
 * 
 * HOW IT WORKS:
 * -------------
 * 1. Display prompt "mini-rdbms> "
 * 2. Wait for user input
 * 3. Parse and execute the command
 * 4. Display results
 * 5. Repeat
 * 
 * SPECIAL COMMANDS:
 * -----------------
 * .help     - Show help message
 * .tables   - List all tables
 * .schema   - Show table schemas
 * .describe - Show table structure
 * .clear    - Clear screen
 * .exit     - Exit REPL
 * 
 * USAGE:
 * ------
 * $ npm run repl
 * 
 * mini-rdbms> CREATE TABLE users (id INT PRIMARY KEY, name TEXT NOT NULL);
 * ✓ Table 'users' created successfully
 * 
 * mini-rdbms> INSERT INTO users VALUES (1, 'Alice');
 * ✓ Inserted 1 row
 * 
 * mini-rdbms> SELECT * FROM users;
 * ┌────┬───────┐
 * │ id │ name  │
 * ├────┼───────┤
 * │ 1  │ Alice │
 * └────┴───────┘
 * 
 * =============================================================================
 */

const readline = require('readline');
const Database = require('../database');
const DatabaseManager = require('../DatabaseManager');
const QueryEngine = require('../engine/QueryEngine');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

/**
 * REPL Class - Interactive SQL command line interface
 */
class REPL {
    /**
     * Creates a new REPL instance
     * 
     * @param {DatabaseManager|Database} [managerOrDatabase] - Optional DatabaseManager or Database
     */
    constructor(managerOrDatabase = null) {
        // Support both DatabaseManager and Database for backwards compatibility
        if (managerOrDatabase instanceof DatabaseManager) {
            this.manager = managerOrDatabase;
        } else if (managerOrDatabase instanceof Database) {
            // Wrap single database in a manager
            this.manager = new DatabaseManager({ createDefault: false });
            this.manager.databases[managerOrDatabase.name] = managerOrDatabase;
            this.manager.use(managerOrDatabase.name);
        } else {
            // Create a new manager with a default database
            this.manager = new DatabaseManager({ defaultDatabase: 'default' });
        }

        this.engine = new QueryEngine(this.manager);

        // Create readline interface
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Track multi-line input for complex queries
        this.inputBuffer = '';

        // Update prompt to show current database
        this._updatePrompt();
    }

    /**
     * Updates the prompt to show the current database
     * @private
     */
    _updatePrompt() {
        const dbName = this.manager.getCurrentDatabaseName() || '(none)';
        this.rl.setPrompt(`${colors.cyan}${dbName}>${colors.reset} `);
    }

    // =========================================================================
    // MAIN REPL LOOP
    // =========================================================================

    /**
     * Starts the REPL loop
     */
    start() {
        this._printWelcome();

        // Handle each line of input
        this.rl.on('line', (line) => {
            this._processLine(line);
            this.rl.prompt();
        });

        // Handle close event
        this.rl.on('close', () => {
            console.log(`\n${colors.yellow}Goodbye!${colors.reset}`);
            process.exit(0);
        });

        // Start prompting
        this.rl.prompt();
    }

    /**
     * Processes a line of input
     * 
     * @private
     * @param {string} line - User input line
     */
    _processLine(line) {
        const trimmedLine = line.trim();

        // Skip empty lines
        if (trimmedLine === '') {
            return;
        }

        // Handle special dot commands
        if (trimmedLine.startsWith('.')) {
            this._handleDotCommand(trimmedLine);
            return;
        }

        // Add to input buffer (for multi-line queries)
        this.inputBuffer += ' ' + trimmedLine;

        // Check if query is complete (ends with semicolon)
        if (trimmedLine.endsWith(';')) {
            // Remove trailing semicolon and execute
            const query = this.inputBuffer.trim().slice(0, -1);
            this._executeQuery(query);
            this.inputBuffer = '';
        }
    }

    // =========================================================================
    // QUERY EXECUTION
    // =========================================================================

    /**
     * Executes a SQL query and displays results
     * 
     * @private
     * @param {string} sql - SQL query to execute
     */
    _executeQuery(sql) {
        const startTime = Date.now();

        try {
            const result = this.engine.execute(sql);
            const duration = Date.now() - startTime;

            if (result.success) {
                // Display results based on query type
                if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                    this._printTable(result.data);
                }

                console.log(
                    `${colors.green}✓${colors.reset} ${result.message} ` +
                    `${colors.dim}(${duration}ms)${colors.reset}`
                );

                // Update prompt if database context changed (USE command)
                this._updatePrompt();
            } else {
                console.log(
                    `${colors.red}✗ Error:${colors.reset} ${result.error}`
                );
            }

        } catch (error) {
            console.log(
                `${colors.red}✗ Error:${colors.reset} ${error.message}`
            );
        }
    }

    // =========================================================================
    // DOT COMMANDS
    // =========================================================================

    /**
     * Handles special dot commands (.help, .tables, etc.)
     * 
     * @private
     * @param {string} command - Dot command
     */
    _handleDotCommand(command) {
        const parts = command.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (cmd) {
            case '.help':
                this._printHelp();
                break;

            case '.databases':
            case '.dbs':
                this._printDatabases();
                break;

            case '.use':
                if (args[0]) {
                    this._useDatabase(args[0]);
                } else {
                    console.log(`${colors.yellow}Usage: .use <database_name>${colors.reset}`);
                }
                break;

            case '.tables':
                this._printTables();
                break;

            case '.schema':
                this._printSchema(args[0]);
                break;

            case '.describe':
            case '.desc':
                if (args[0]) {
                    this._describeTable(args[0]);
                } else {
                    console.log(`${colors.yellow}Usage: .describe <table_name>${colors.reset}`);
                }
                break;

            case '.stats':
                this._printStats();
                break;

            case '.clear':
                console.clear();
                break;

            case '.exit':
            case '.quit':
                this.rl.close();
                break;

            default:
                console.log(
                    `${colors.red}Unknown command: ${cmd}${colors.reset}\n` +
                    `Type ${colors.cyan}.help${colors.reset} for available commands.`
                );
        }
    }

    // =========================================================================
    // OUTPUT FORMATTING
    // =========================================================================

    /**
     * Prints a welcome message
     * @private
     */
    _printWelcome() {
        console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════════╗
║                                                               ║
║   ${colors.bright}Mini-RDBMS${colors.reset}${colors.cyan} - A Simple Relational Database               ║
║                                                               ║
║   Type SQL commands or use dot commands:                      ║
║   ${colors.yellow}.help${colors.cyan}       - Show all available commands                 ║
║   ${colors.yellow}.databases${colors.cyan}  - List all databases                          ║
║   ${colors.yellow}.use <name>${colors.cyan} - Switch to a database                        ║
║   ${colors.yellow}.tables${colors.cyan}     - List tables in current database             ║
║   ${colors.yellow}.exit${colors.cyan}       - Exit the REPL                               ║
║                                                               ║
║   SQL Examples:                                               ║
║   ${colors.yellow}CREATE DATABASE myapp;${colors.cyan}                                    ║
║   ${colors.yellow}USE myapp;${colors.cyan}                                                ║
║   ${colors.yellow}CREATE TABLE users (id INT PRIMARY KEY, name TEXT);${colors.cyan}      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝${colors.reset}
`);
    }

    /**
     * Prints help information
     * @private
     */
    _printHelp() {
        console.log(`
${colors.bright}Database Commands:${colors.reset}
  ${colors.green}CREATE DATABASE${colors.reset} name         - Create a new database
  ${colors.green}USE${colors.reset} name                     - Switch to a database
  ${colors.green}DROP DATABASE${colors.reset} name           - Delete a database
  ${colors.green}SHOW DATABASES${colors.reset}               - List all databases

${colors.bright}Table Commands:${colors.reset}
  ${colors.green}CREATE TABLE${colors.reset} name (col1 TYPE [CONSTRAINTS], ...)
  ${colors.green}INSERT INTO${colors.reset} name [(cols)] VALUES (values)
  ${colors.green}SELECT${colors.reset} cols FROM name [WHERE condition]
  ${colors.green}UPDATE${colors.reset} name SET col=value WHERE condition
  ${colors.green}DELETE FROM${colors.reset} name WHERE condition
  ${colors.green}DROP TABLE${colors.reset} name
  ${colors.green}SHOW TABLES${colors.reset}                  - List tables in current database

${colors.bright}Data Types:${colors.reset}
  ${colors.yellow}INT${colors.reset}   - Integer numbers
  ${colors.yellow}TEXT${colors.reset}  - Text/String values
  ${colors.yellow}BOOL${colors.reset}  - Boolean (true/false)

${colors.bright}Constraints:${colors.reset}
  ${colors.yellow}PRIMARY KEY${colors.reset} - Unique identifier for each row
  ${colors.yellow}NOT NULL${colors.reset}    - Column cannot be empty
  ${colors.yellow}UNIQUE${colors.reset}      - Values must be unique

${colors.bright}Dot Commands:${colors.reset}
  ${colors.cyan}.help${colors.reset}            - Show this help message
  ${colors.cyan}.databases${colors.reset}       - List all databases
  ${colors.cyan}.use <name>${colors.reset}      - Switch to a database
  ${colors.cyan}.tables${colors.reset}          - List all tables in current database
  ${colors.cyan}.schema [table]${colors.reset}  - Show table schemas
  ${colors.cyan}.describe table${colors.reset}  - Describe a table's structure
  ${colors.cyan}.stats${colors.reset}           - Show database statistics
  ${colors.cyan}.clear${colors.reset}           - Clear the screen
  ${colors.cyan}.exit${colors.reset}            - Exit the REPL

${colors.bright}Examples:${colors.reset}
  CREATE DATABASE myapp;
  USE myapp;
  CREATE TABLE users (id INT PRIMARY KEY, name TEXT NOT NULL);
  INSERT INTO users VALUES (1, 'Alice');
  SELECT * FROM users WHERE id = 1;
`);
    }

    /**
     * Prints list of tables
     * @private
     */
    _printTables() {
        const db = this.manager.getCurrentDatabase();
        if (!db) {
            console.log(`${colors.yellow}No database selected. Use 'USE database_name' first.${colors.reset}`);
            return;
        }

        const tables = db.listTables();

        if (tables.length === 0) {
            console.log(`${colors.dim}No tables in '${db.name}'.${colors.reset}`);
            return;
        }

        console.log(`\n${colors.bright}Tables in '${db.name}':${colors.reset}`);
        tables.forEach(table => {
            console.log(`  ${colors.green}•${colors.reset} ${table}`);
        });
        console.log();
    }

    /**
     * Prints list of databases
     * @private
     */
    _printDatabases() {
        const databases = this.manager.listDatabases();
        const currentDb = this.manager.getCurrentDatabaseName();

        if (databases.length === 0) {
            console.log(`${colors.dim}No databases found.${colors.reset}`);
            return;
        }

        console.log(`\n${colors.bright}Databases:${colors.reset}`);
        databases.forEach(db => {
            const marker = db === currentDb ? `${colors.green}→${colors.reset} ` : '  ';
            const highlight = db === currentDb ? colors.cyan : '';
            console.log(`${marker}${highlight}${db}${colors.reset}`);
        });
        console.log();
    }

    /**
     * Switches to a database using the .use command
     * @private
     */
    _useDatabase(dbName) {
        try {
            this.manager.use(dbName);
            this.engine.database = this.manager.getCurrentDatabase();
            this._updatePrompt();
            console.log(`${colors.green}✓${colors.reset} Switched to database '${colors.cyan}${dbName}${colors.reset}'`);
        } catch (error) {
            console.log(`${colors.red}✗ Error:${colors.reset} ${error.message}`);
            
            // Show available databases as a hint
            const databases = this.manager.listDatabases();
            if (databases.length > 0) {
                console.log(`${colors.dim}Available databases: ${databases.join(', ')}${colors.reset}`);
            }
        }
    }

    /**
     * Prints schema for all tables or a specific table
     * @private
     */
    _printSchema(tableName) {
        const tables = tableName ? [tableName] : this.engine.getTables();

        if (tables.length === 0) {
            console.log(`${colors.dim}No tables found.${colors.reset}`);
            return;
        }

        console.log();
        for (const name of tables) {
            try {
                const info = this.engine.describeTable(name);
                
                console.log(`${colors.bright}CREATE TABLE${colors.reset} ${colors.cyan}${name}${colors.reset} (`);
                
                info.columns.forEach((col, i) => {
                    let line = `  ${col.name} ${colors.yellow}${col.type}${colors.reset}`;
                    
                    if (col.primaryKey) line += ` ${colors.magenta}PRIMARY KEY${colors.reset}`;
                    if (col.notNull && !col.primaryKey) line += ` ${colors.magenta}NOT NULL${colors.reset}`;
                    if (col.unique && !col.primaryKey) line += ` ${colors.magenta}UNIQUE${colors.reset}`;
                    
                    if (i < info.columns.length - 1) line += ',';
                    console.log(line);
                });
                
                console.log(`);`);
                console.log(`${colors.dim}-- ${info.rowCount} row(s)${colors.reset}\n`);

            } catch (error) {
                console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
            }
        }
    }

    /**
     * Describes a table's structure
     * @private
     */
    _describeTable(tableName) {
        try {
            const info = this.engine.describeTable(tableName);

            console.log(`\n${colors.bright}Table: ${colors.cyan}${info.name}${colors.reset}`);
            console.log(`${colors.dim}Rows: ${info.rowCount}${colors.reset}\n`);

            // Print column info as table
            const columnData = info.columns.map(col => ({
                Column: col.name,
                Type: col.type,
                'Primary Key': col.primaryKey ? 'YES' : '',
                'Not Null': col.notNull ? 'YES' : '',
                'Unique': col.unique ? 'YES' : ''
            }));

            this._printTable(columnData);

        } catch (error) {
            console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
        }
    }

    /**
     * Prints database statistics
     * @private
     */
    _printStats() {
        const managerStats = this.manager.getStats();

        console.log(`\n${colors.bright}Server Statistics:${colors.reset}`);
        console.log(`${colors.dim}Databases: ${managerStats.databaseCount}${colors.reset}`);
        console.log(`${colors.dim}Total Tables: ${managerStats.totalTables}${colors.reset}`);
        console.log(`${colors.dim}Total Rows: ${managerStats.totalRows}${colors.reset}`);
        console.log(`${colors.dim}Current Database: ${managerStats.currentDatabase || '(none)'}${colors.reset}\n`);

        if (managerStats.databases.length > 0) {
            const dbData = managerStats.databases.map(db => ({
                Database: db.name,
                Tables: db.tableCount,
                Rows: db.totalRows
            }));

            this._printTable(dbData);
        }
    }

    /**
     * Prints data as a formatted ASCII table
     * 
     * @private
     * @param {Object[]} data - Array of row objects
     */
    _printTable(data) {
        if (!data || data.length === 0) {
            console.log(`${colors.dim}(empty result)${colors.reset}`);
            return;
        }

        // Get column names and calculate widths
        const columns = Object.keys(data[0]);
        const widths = {};

        // Initialize with header widths
        columns.forEach(col => {
            widths[col] = col.length;
        });

        // Update with data widths
        data.forEach(row => {
            columns.forEach(col => {
                const value = String(row[col] ?? 'NULL');
                widths[col] = Math.max(widths[col], value.length);
            });
        });

        // Build separator line
        const separator = '├' + columns.map(col => '─'.repeat(widths[col] + 2)).join('┼') + '┤';
        const topBorder = '┌' + columns.map(col => '─'.repeat(widths[col] + 2)).join('┬') + '┐';
        const bottomBorder = '└' + columns.map(col => '─'.repeat(widths[col] + 2)).join('┴') + '┘';

        // Print top border
        console.log(topBorder);

        // Print header
        const header = '│' + columns.map(col => 
            ` ${colors.bright}${col.padEnd(widths[col])}${colors.reset} `
        ).join('│') + '│';
        console.log(header);

        // Print separator
        console.log(separator);

        // Print rows
        data.forEach(row => {
            const rowLine = '│' + columns.map(col => {
                const value = String(row[col] ?? 'NULL');
                return ` ${value.padEnd(widths[col])} `;
            }).join('│') + '│';
            console.log(rowLine);
        });

        // Print bottom border
        console.log(bottomBorder);
        console.log();
    }
}

// =========================================================================
// MAIN ENTRY POINT
// =========================================================================

/**
 * Starts the REPL when this file is run directly
 */
function main() {
    const repl = new REPL();
    repl.start();
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = REPL;
