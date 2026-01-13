/**
 * =============================================================================
 * EXPRESS API SERVER
 * =============================================================================
 * 
 * This module provides a REST API for interacting with the mini-RDBMS.
 * It allows external applications (like web frontends) to perform
 * database operations over HTTP.
 * 
 * CONCEPTS COVERED:
 * -----------------
 * 1. REST API Design: Resource-based URL structure
 * 2. Express.js: Popular Node.js web framework
 * 3. CORS: Cross-Origin Resource Sharing for frontend access
 * 4. Error Handling: Consistent error responses
 * 
 * API ENDPOINTS:
 * --------------
 * GET    /api/tables              - List all tables
 * POST   /api/tables              - Create a new table
 * DELETE /api/tables/:name        - Drop a table
 * GET    /api/tables/:name/rows   - Get all rows from a table
 * POST   /api/tables/:name/rows   - Insert a row
 * PUT    /api/tables/:name/rows   - Update rows
 * DELETE /api/tables/:name/rows   - Delete rows
 * POST   /api/query               - Execute raw SQL
 * GET    /api/stats               - Get database statistics
 * 
 * USAGE:
 * ------
 * $ npm run server
 * Server running on http://localhost:3000
 * 
 * $ curl http://localhost:3000/api/tables
 * ["users", "posts"]
 * 
 * =============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const Database = require('../database');
const QueryEngine = require('../engine/QueryEngine');

// =========================================================================
// APPLICATION SETUP
// =========================================================================

// Create Express app
const app = express();

// Create database and query engine
const database = new Database('app_db');
const engine = new QueryEngine(database);

// Middleware
app.use(cors());                          // Enable CORS for frontend access
app.use(express.json());                  // Parse JSON request bodies
app.use(express.static(path.join(__dirname, '../../demo/public'))); // Serve static files

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// =========================================================================
// API ROUTES
// =========================================================================

/**
 * GET /api/tables
 * 
 * Lists all tables in the database
 * 
 * Response: string[] - Array of table names
 * 
 * Example:
 * GET /api/tables
 * Response: ["users", "posts", "comments"]
 */
app.get('/api/tables', (req, res) => {
    try {
        const tables = engine.getTables();
        res.json({
            success: true,
            data: tables
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/tables
 * 
 * Creates a new table
 * 
 * Request Body:
 * {
 *   "name": "users",
 *   "columns": [
 *     { "name": "id", "type": "INT", "primaryKey": true },
 *     { "name": "name", "type": "TEXT", "notNull": true }
 *   ]
 * }
 * 
 * Response: { success: true, message: "Table created" }
 */
app.post('/api/tables', (req, res) => {
    try {
        const { name, columns } = req.body;

        if (!name || !columns || !Array.isArray(columns)) {
            return res.status(400).json({
                success: false,
                error: 'Request must include "name" and "columns" array'
            });
        }

        // Build CREATE TABLE SQL
        const columnDefs = columns.map(col => {
            let def = `${col.name} ${col.type}`;
            if (col.primaryKey) def += ' PRIMARY KEY';
            if (col.notNull && !col.primaryKey) def += ' NOT NULL';
            if (col.unique && !col.primaryKey) def += ' UNIQUE';
            return def;
        }).join(', ');

        const sql = `CREATE TABLE ${name} (${columnDefs})`;
        const result = engine.execute(sql);

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/tables/:name
 * 
 * Drops (deletes) a table
 * 
 * Response: { success: true, message: "Table dropped" }
 */
app.delete('/api/tables/:name', (req, res) => {
    try {
        const { name } = req.params;
        const sql = `DROP TABLE ${name}`;
        const result = engine.execute(sql);

        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tables/:name
 * 
 * Gets table schema information
 * 
 * Response: { name, columns, rowCount }
 */
app.get('/api/tables/:name', (req, res) => {
    try {
        const { name } = req.params;
        const info = engine.describeTable(name);
        res.json({
            success: true,
            data: info
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tables/:name/rows
 * 
 * Gets all rows from a table (with optional filtering)
 * 
 * Query Parameters:
 * - column: Filter column name
 * - operator: Filter operator (=, >, <, etc.)
 * - value: Filter value
 * 
 * Response: { success: true, data: [...rows] }
 */
app.get('/api/tables/:name/rows', (req, res) => {
    try {
        const { name } = req.params;
        const { column, operator, value } = req.query;

        let sql = `SELECT * FROM ${name}`;

        // Add WHERE clause if filters provided
        if (column && operator && value !== undefined) {
            // Parse value type
            let parsedValue = value;
            if (value === 'true') parsedValue = 'true';
            else if (value === 'false') parsedValue = 'false';
            else if (!isNaN(value)) parsedValue = value;
            else parsedValue = `'${value}'`;

            sql += ` WHERE ${column} ${operator} ${parsedValue}`;
        }

        const result = engine.execute(sql);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/tables/:name/rows
 * 
 * Inserts a new row into a table
 * 
 * Request Body: { column1: value1, column2: value2, ... }
 * 
 * Response: { success: true, data: insertedRow }
 */
app.post('/api/tables/:name/rows', (req, res) => {
    try {
        const { name } = req.params;
        const rowData = req.body;

        if (!rowData || Object.keys(rowData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request body must contain row data'
            });
        }

        // Build INSERT SQL
        const columns = Object.keys(rowData);
        const values = columns.map(col => {
            const val = rowData[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val}'`;
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            return val;
        });

        const sql = `INSERT INTO ${name} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
        const result = engine.execute(sql);

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/tables/:name/rows
 * 
 * Updates rows in a table
 * 
 * Request Body:
 * {
 *   "set": { "column1": newValue1, ... },
 *   "where": { "column": "id", "operator": "=", "value": 1 }
 * }
 * 
 * Response: { success: true, rowsAffected: n }
 */
app.put('/api/tables/:name/rows', (req, res) => {
    try {
        const { name } = req.params;
        const { set, where } = req.body;

        if (!set || !where) {
            return res.status(400).json({
                success: false,
                error: 'Request must include "set" and "where" objects'
            });
        }

        // Build UPDATE SQL
        const setClause = Object.entries(set).map(([col, val]) => {
            if (val === null) return `${col} = NULL`;
            if (typeof val === 'string') return `${col} = '${val}'`;
            if (typeof val === 'boolean') return `${col} = ${val}`;
            return `${col} = ${val}`;
        }).join(', ');

        let whereValue = where.value;
        if (typeof whereValue === 'string') whereValue = `'${whereValue}'`;

        const sql = `UPDATE ${name} SET ${setClause} WHERE ${where.column} ${where.operator} ${whereValue}`;
        const result = engine.execute(sql);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/tables/:name/rows
 * 
 * Deletes rows from a table
 * 
 * Request Body:
 * {
 *   "where": { "column": "id", "operator": "=", "value": 1 }
 * }
 * 
 * Response: { success: true, rowsAffected: n }
 */
app.delete('/api/tables/:name/rows', (req, res) => {
    try {
        const { name } = req.params;
        const { where } = req.body;

        if (!where) {
            return res.status(400).json({
                success: false,
                error: 'Request must include "where" object for safety'
            });
        }

        let whereValue = where.value;
        if (typeof whereValue === 'string') whereValue = `'${whereValue}'`;

        const sql = `DELETE FROM ${name} WHERE ${where.column} ${where.operator} ${whereValue}`;
        const result = engine.execute(sql);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/query
 * 
 * Executes a raw SQL query
 * 
 * Request Body: { "sql": "SELECT * FROM users" }
 * 
 * Response: Query result object
 */
app.post('/api/query', (req, res) => {
    try {
        const { sql } = req.body;

        if (!sql) {
            return res.status(400).json({
                success: false,
                error: 'Request must include "sql" property'
            });
        }

        const result = engine.execute(sql);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/stats
 * 
 * Gets database statistics
 * 
 * Response: Database stats object
 */
app.get('/api/stats', (req, res) => {
    try {
        const stats = engine.getStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =========================================================================
// ERROR HANDLING
// =========================================================================

/**
 * 404 Handler - Route not found
 */
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.path}`
    });
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// =========================================================================
// SERVER START
// =========================================================================

const PORT = process.env.PORT || 3000;

/**
 * Starts the server
 */
function startServer() {
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   Mini-RDBMS API Server                                       ║
║                                                               ║
║   Server running on: http://localhost:${PORT}                   ║
║   API endpoint:      http://localhost:${PORT}/api               ║
║                                                               ║
║   Available endpoints:                                        ║
║   GET    /api/tables              - List tables               ║
║   POST   /api/tables              - Create table              ║
║   GET    /api/tables/:name/rows   - Get rows                  ║
║   POST   /api/tables/:name/rows   - Insert row                ║
║   PUT    /api/tables/:name/rows   - Update rows               ║
║   DELETE /api/tables/:name/rows   - Delete rows               ║
║   POST   /api/query               - Execute SQL               ║
║                                                               ║
║   Press Ctrl+C to stop                                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
    });
}

// Export for testing and external use
module.exports = { app, database, engine, startServer };

// Start server if run directly
if (require.main === module) {
    startServer();
}
