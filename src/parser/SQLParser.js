/**
 * =============================================================================
 * SQL PARSER
 * =============================================================================
 * 
 * The SQL Parser converts SQL query strings into structured objects (AST).
 * AST = Abstract Syntax Tree - a tree representation of the query structure.
 * 
 * CONCEPTS COVERED:
 * -----------------
 * 1. Tokenization: Breaking SQL string into tokens
 * 2. Parsing: Converting tokens into structured objects
 * 3. Grammar: Understanding SQL syntax rules
 * 
 * HOW PARSING WORKS:
 * ------------------
 * Input: "SELECT name, age FROM users WHERE age > 18"
 *              ↓
 * Step 1: Tokenize
 * ['SELECT', 'name', ',', 'age', 'FROM', 'users', 'WHERE', 'age', '>', '18']
 *              ↓
 * Step 2: Parse into AST
 * {
 *   type: 'SELECT',
 *   columns: ['name', 'age'],
 *   table: 'users',
 *   where: { column: 'age', operator: '>', value: 18 }
 * }
 * 
 * SUPPORTED SQL SYNTAX:
 * ---------------------
 * CREATE TABLE name (col1 TYPE [CONSTRAINTS], ...)
 * INSERT INTO name [(cols)] VALUES (val1, val2, ...)
 * SELECT cols FROM name [WHERE condition]
 * UPDATE name SET col=val [WHERE condition]
 * DELETE FROM name WHERE condition
 * DROP TABLE name
 * SELECT ... FROM t1 JOIN t2 ON t1.col = t2.col
 * 
 * USAGE EXAMPLE:
 * --------------
 * const parser = new SQLParser();
 * const ast = parser.parse('SELECT * FROM users WHERE id = 1');
 * console.log(ast);
 * // {
 * //   type: 'SELECT',
 * //   columns: ['*'],
 * //   table: 'users',
 * //   where: { column: 'id', operator: '=', value: 1 }
 * // }
 * 
 * =============================================================================
 */

class SQLParser {
    /**
     * Creates a new SQL Parser instance
     */
    constructor() {
        // Reserved SQL keywords (uppercase for comparison)
        this.keywords = new Set([
            'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES',
            'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP',
            'PRIMARY', 'KEY', 'NOT', 'NULL', 'UNIQUE', 'AND', 'OR',
            'JOIN', 'ON', 'INNER', 'LEFT', 'RIGHT', 'INT', 'TEXT', 'BOOL',
            'DATABASE', 'USE', 'SHOW', 'DATABASES', 'IF', 'EXISTS'
        ]);

        // Operators for WHERE clauses
        this.operators = ['>=', '<=', '!=', '<>', '=', '>', '<', 'LIKE'];
    }

    // =========================================================================
    // MAIN PARSE METHOD
    // =========================================================================

    /**
     * Parses a SQL string into an AST (Abstract Syntax Tree)
     * 
     * @param {string} sql - The SQL query string to parse
     * @returns {Object} Parsed AST object
     * @throws {Error} If SQL syntax is invalid
     * 
     * @example
     * const ast = parser.parse('SELECT * FROM users');
     */
    parse(sql) {
        // Normalize and validate input
        if (!sql || typeof sql !== 'string') {
            throw new Error('SQL query must be a non-empty string');
        }

        // Trim and normalize whitespace
        const normalizedSQL = sql.trim();

        if (normalizedSQL.length === 0) {
            throw new Error('SQL query cannot be empty');
        }

        // Tokenize the SQL string
        const tokens = this._tokenize(normalizedSQL);

        if (tokens.length === 0) {
            throw new Error('SQL query produced no tokens');
        }

        // Determine query type and delegate to specific parser
        const firstToken = tokens[0].toUpperCase();

        switch (firstToken) {
            case 'SELECT':
                return this._parseSelect(tokens);
            case 'INSERT':
                return this._parseInsert(tokens);
            case 'UPDATE':
                return this._parseUpdate(tokens);
            case 'DELETE':
                return this._parseDelete(tokens);
            case 'CREATE':
                return this._parseCreate(tokens);
            case 'DROP':
                return this._parseDrop(tokens);
            case 'USE':
                return this._parseUse(tokens);
            case 'SHOW':
                return this._parseShow(tokens);
            default:
                throw new Error(`Unknown SQL command: '${firstToken}'`);
        }
    }

    // =========================================================================
    // TOKENIZER
    // =========================================================================

    /**
     * Tokenizes a SQL string into an array of tokens
     * 
     * Handles:
     * - Keywords and identifiers
     * - Operators (=, >, <, >=, <=, !=)
     * - Quoted strings ('hello')
     * - Numbers (42, 3.14)
     * - Punctuation (parentheses, commas)
     * 
     * @private
     * @param {string} sql - SQL string to tokenize
     * @returns {string[]} Array of tokens
     * 
     * @example
     * this._tokenize("SELECT name FROM users WHERE id = 1")
     * // ['SELECT', 'name', 'FROM', 'users', 'WHERE', 'id', '=', '1']
     */
    _tokenize(sql) {
        const tokens = [];
        let i = 0;

        while (i < sql.length) {
            const char = sql[i];

            // Skip whitespace
            if (/\s/.test(char)) {
                i++;
                continue;
            }

            // Handle single-quoted strings
            if (char === "'") {
                let str = '';
                i++; // Skip opening quote

                while (i < sql.length && sql[i] !== "'") {
                    // Handle escaped quotes
                    if (sql[i] === '\\' && sql[i + 1] === "'") {
                        str += "'";
                        i += 2;
                    } else {
                        str += sql[i];
                        i++;
                    }
                }

                if (sql[i] !== "'") {
                    throw new Error('Unterminated string literal');
                }

                i++; // Skip closing quote
                tokens.push(`'${str}'`); // Keep quotes to identify as string
                continue;
            }

            // Handle multi-character operators (>=, <=, !=, <>)
            if (i + 1 < sql.length) {
                const twoChar = sql.slice(i, i + 2);
                if (['>=', '<=', '!=', '<>'].includes(twoChar)) {
                    tokens.push(twoChar);
                    i += 2;
                    continue;
                }
            }

            // Handle single-character operators and punctuation
            if ('(),.;=><*'.includes(char)) {
                tokens.push(char);
                i++;
                continue;
            }

            // Handle identifiers and keywords
            if (/[a-zA-Z_]/.test(char)) {
                let word = '';
                while (i < sql.length && /[a-zA-Z0-9_.]/.test(sql[i])) {
                    word += sql[i];
                    i++;
                }
                tokens.push(word);
                continue;
            }

            // Handle numbers (integers and decimals)
            if (/[0-9-]/.test(char)) {
                let num = '';

                // Handle negative numbers
                if (char === '-') {
                    num = '-';
                    i++;
                }

                while (i < sql.length && /[0-9.]/.test(sql[i])) {
                    num += sql[i];
                    i++;
                }
                tokens.push(num);
                continue;
            }

            // Unknown character
            throw new Error(`Unexpected character: '${char}' at position ${i}`);
        }

        return tokens;
    }

    // =========================================================================
    // SELECT PARSER
    // =========================================================================

    /**
     * Parses a SELECT statement
     * 
     * Syntax:
     * SELECT columns FROM table [WHERE condition] [JOIN table ON condition]
     * 
     * @private
     * @param {string[]} tokens - Tokenized SQL
     * @returns {Object} Parsed SELECT AST
     */
    _parseSelect(tokens) {
        const ast = {
            type: 'SELECT',
            columns: [],
            table: null,
            where: null,
            join: null
        };

        let i = 1; // Skip 'SELECT'

        // Parse column list
        while (i < tokens.length && tokens[i].toUpperCase() !== 'FROM') {
            const token = tokens[i];

            // Skip commas
            if (token === ',') {
                i++;
                continue;
            }

            ast.columns.push(token);
            i++;
        }

        if (ast.columns.length === 0) {
            throw new Error('SELECT requires at least one column');
        }

        // Expect FROM
        if (tokens[i]?.toUpperCase() !== 'FROM') {
            throw new Error('SELECT requires FROM clause');
        }
        i++; // Skip 'FROM'

        // Get table name
        ast.table = tokens[i];
        if (!ast.table) {
            throw new Error('Expected table name after FROM');
        }
        i++;

        // Check for JOIN
        if (tokens[i]?.toUpperCase() === 'JOIN' || 
            tokens[i]?.toUpperCase() === 'INNER') {
            
            if (tokens[i].toUpperCase() === 'INNER') {
                i++; // Skip 'INNER'
            }
            
            if (tokens[i]?.toUpperCase() === 'JOIN') {
                i++; // Skip 'JOIN'

                ast.join = {
                    table: tokens[i],
                    on: null
                };
                i++;

                // Expect ON
                if (tokens[i]?.toUpperCase() === 'ON') {
                    i++; // Skip 'ON'

                    // Parse join condition: table1.col = table2.col
                    const leftSide = tokens[i];
                    i++;

                    const operator = tokens[i];
                    if (operator !== '=') {
                        throw new Error('JOIN ON clause only supports = operator');
                    }
                    i++;

                    const rightSide = tokens[i];
                    i++;

                    ast.join.on = {
                        left: leftSide,
                        operator: operator,
                        right: rightSide
                    };
                }
            }
        }

        // Check for WHERE clause
        if (tokens[i]?.toUpperCase() === 'WHERE') {
            i++; // Skip 'WHERE'
            ast.where = this._parseWhereCondition(tokens, i);
        }

        return ast;
    }

    // =========================================================================
    // INSERT PARSER
    // =========================================================================

    /**
     * Parses an INSERT statement
     * 
     * Syntax:
     * INSERT INTO table [(columns)] VALUES (values)
     * 
     * @private
     * @param {string[]} tokens - Tokenized SQL
     * @returns {Object} Parsed INSERT AST
     */
    _parseInsert(tokens) {
        const ast = {
            type: 'INSERT',
            table: null,
            columns: [],
            values: []
        };

        let i = 1; // Skip 'INSERT'

        // Expect INTO
        if (tokens[i]?.toUpperCase() !== 'INTO') {
            throw new Error('INSERT requires INTO keyword');
        }
        i++; // Skip 'INTO'

        // Get table name
        ast.table = tokens[i];
        if (!ast.table) {
            throw new Error('Expected table name after INSERT INTO');
        }
        i++;

        // Check for optional column list
        if (tokens[i] === '(') {
            i++; // Skip '('

            while (tokens[i] !== ')' && i < tokens.length) {
                if (tokens[i] !== ',') {
                    ast.columns.push(tokens[i]);
                }
                i++;
            }

            if (tokens[i] !== ')') {
                throw new Error('Expected ) after column list');
            }
            i++; // Skip ')'
        }

        // Expect VALUES
        if (tokens[i]?.toUpperCase() !== 'VALUES') {
            throw new Error('INSERT requires VALUES keyword');
        }
        i++; // Skip 'VALUES'

        // Parse values list
        if (tokens[i] !== '(') {
            throw new Error('Expected ( after VALUES');
        }
        i++; // Skip '('

        while (tokens[i] !== ')' && i < tokens.length) {
            if (tokens[i] !== ',') {
                ast.values.push(this._parseValue(tokens[i]));
            }
            i++;
        }

        if (tokens[i] !== ')') {
            throw new Error('Expected ) after values list');
        }

        return ast;
    }

    // =========================================================================
    // UPDATE PARSER
    // =========================================================================

    /**
     * Parses an UPDATE statement
     * 
     * Syntax:
     * UPDATE table SET column = value [, ...] WHERE condition
     * 
     * @private
     * @param {string[]} tokens - Tokenized SQL
     * @returns {Object} Parsed UPDATE AST
     */
    _parseUpdate(tokens) {
        const ast = {
            type: 'UPDATE',
            table: null,
            set: {},
            where: null
        };

        let i = 1; // Skip 'UPDATE'

        // Get table name
        ast.table = tokens[i];
        if (!ast.table) {
            throw new Error('Expected table name after UPDATE');
        }
        i++;

        // Expect SET
        if (tokens[i]?.toUpperCase() !== 'SET') {
            throw new Error('UPDATE requires SET keyword');
        }
        i++; // Skip 'SET'

        // Parse SET assignments
        while (i < tokens.length && tokens[i]?.toUpperCase() !== 'WHERE') {
            const column = tokens[i];
            i++;

            if (tokens[i] !== '=') {
                throw new Error(`Expected = after column name '${column}'`);
            }
            i++; // Skip '='

            const value = this._parseValue(tokens[i]);
            i++;

            ast.set[column] = value;

            // Skip comma if present
            if (tokens[i] === ',') {
                i++;
            }
        }

        // Parse WHERE clause (required for safety)
        if (tokens[i]?.toUpperCase() === 'WHERE') {
            i++; // Skip 'WHERE'
            ast.where = this._parseWhereCondition(tokens, i);
        }

        return ast;
    }

    // =========================================================================
    // DELETE PARSER
    // =========================================================================

    /**
     * Parses a DELETE statement
     * 
     * Syntax:
     * DELETE FROM table WHERE condition
     * 
     * @private
     * @param {string[]} tokens - Tokenized SQL
     * @returns {Object} Parsed DELETE AST
     */
    _parseDelete(tokens) {
        const ast = {
            type: 'DELETE',
            table: null,
            where: null
        };

        let i = 1; // Skip 'DELETE'

        // Expect FROM
        if (tokens[i]?.toUpperCase() !== 'FROM') {
            throw new Error('DELETE requires FROM keyword');
        }
        i++; // Skip 'FROM'

        // Get table name
        ast.table = tokens[i];
        if (!ast.table) {
            throw new Error('Expected table name after DELETE FROM');
        }
        i++;

        // Parse WHERE clause (required for safety)
        if (tokens[i]?.toUpperCase() === 'WHERE') {
            i++; // Skip 'WHERE'
            ast.where = this._parseWhereCondition(tokens, i);
        }

        return ast;
    }

    // =========================================================================
    // CREATE TABLE PARSER
    // =========================================================================

    /**
     * Parses a CREATE TABLE statement
     * 
     * Syntax:
     * CREATE TABLE name (
     *   column1 TYPE [CONSTRAINTS],
     *   column2 TYPE [CONSTRAINTS],
     *   ...
     * )
     * 
     * @private
     * @param {string[]} tokens - Tokenized SQL
     * @returns {Object} Parsed CREATE TABLE/DATABASE AST
     */
    _parseCreate(tokens) {
        let i = 1; // Skip 'CREATE'

        const target = tokens[i]?.toUpperCase();

        // Handle CREATE DATABASE
        if (target === 'DATABASE') {
            i++; // Skip 'DATABASE'

            // Check for optional IF NOT EXISTS
            let ifNotExists = false;
            if (tokens[i]?.toUpperCase() === 'IF' &&
                tokens[i + 1]?.toUpperCase() === 'NOT' &&
                tokens[i + 2]?.toUpperCase() === 'EXISTS') {
                ifNotExists = true;
                i += 3; // Skip 'IF NOT EXISTS'
            }

            const databaseName = tokens[i];
            if (!databaseName) {
                throw new Error('Expected database name after CREATE DATABASE');
            }

            return {
                type: 'CREATE_DATABASE',
                database: databaseName,
                ifNotExists
            };
        }

        // Handle CREATE TABLE
        if (target !== 'TABLE') {
            throw new Error(`Unsupported CREATE target: '${target}'. Only CREATE TABLE and CREATE DATABASE are supported`);
        }
        i++; // Skip 'TABLE'

        // Get table name
        const tableName = tokens[i];
        if (!tableName) {
            throw new Error('Expected table name after CREATE TABLE');
        }
        i++;

        const ast = {
            type: 'CREATE_TABLE',
            table: tableName,
            columns: []
        };

        // Expect (
        if (tokens[i] !== '(') {
            throw new Error('Expected ( after table name');
        }
        i++; // Skip '('

        // Parse column definitions
        while (tokens[i] !== ')' && i < tokens.length) {
            // Skip commas
            if (tokens[i] === ',') {
                i++;
                continue;
            }

            // Parse column: name TYPE [CONSTRAINTS]
            const columnDef = {
                name: tokens[i],
                type: null,
                primaryKey: false,
                notNull: false,
                unique: false
            };
            i++;

            // Get type
            const type = tokens[i]?.toUpperCase();
            if (!['INT', 'TEXT', 'BOOL'].includes(type)) {
                throw new Error(`Invalid column type: '${tokens[i]}'`);
            }
            columnDef.type = type;
            i++;

            // Parse optional constraints
            while (i < tokens.length && 
                   tokens[i] !== ',' && 
                   tokens[i] !== ')') {
                
                const constraint = tokens[i].toUpperCase();

                if (constraint === 'PRIMARY') {
                    i++;
                    if (tokens[i]?.toUpperCase() === 'KEY') {
                        columnDef.primaryKey = true;
                        i++;
                    }
                } else if (constraint === 'NOT') {
                    i++;
                    if (tokens[i]?.toUpperCase() === 'NULL') {
                        columnDef.notNull = true;
                        i++;
                    }
                } else if (constraint === 'UNIQUE') {
                    columnDef.unique = true;
                    i++;
                } else {
                    i++; // Skip unknown token
                }
            }

            ast.columns.push(columnDef);
        }

        if (ast.columns.length === 0) {
            throw new Error('CREATE TABLE requires at least one column');
        }

        return ast;
    }

    // =========================================================================
    // DROP TABLE PARSER
    // =========================================================================

    /**
     * Parses a DROP TABLE/DATABASE statement
     * 
     * Syntax:
     * DROP TABLE name
     * DROP DATABASE name
     * DROP DATABASE IF EXISTS name
     * 
     * @private
     * @param {string[]} tokens - Tokenized SQL
     * @returns {Object} Parsed DROP AST
     */
    _parseDrop(tokens) {
        let i = 1; // Skip 'DROP'

        const target = tokens[i]?.toUpperCase();

        // Handle DROP DATABASE
        if (target === 'DATABASE') {
            i++; // Skip 'DATABASE'

            // Check for optional IF EXISTS
            let ifExists = false;
            if (tokens[i]?.toUpperCase() === 'IF' &&
                tokens[i + 1]?.toUpperCase() === 'EXISTS') {
                ifExists = true;
                i += 2; // Skip 'IF EXISTS'
            }

            const databaseName = tokens[i];
            if (!databaseName) {
                throw new Error('Expected database name after DROP DATABASE');
            }

            return {
                type: 'DROP_DATABASE',
                database: databaseName,
                ifExists
            };
        }

        // Handle DROP TABLE
        if (target !== 'TABLE') {
            throw new Error(`Unsupported DROP target: '${target}'. Only DROP TABLE and DROP DATABASE are supported`);
        }
        i++; // Skip 'TABLE'

        // Get table name
        const tableName = tokens[i];
        if (!tableName) {
            throw new Error('Expected table name after DROP TABLE');
        }

        return {
            type: 'DROP_TABLE',
            table: tableName
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Parses a WHERE condition
     * 
     * @private
     * @param {string[]} tokens - All tokens
     * @param {number} startIndex - Starting index for parsing
     * @returns {Object} Parsed condition object
     */
    _parseWhereCondition(tokens, startIndex) {
        let i = startIndex;

        const column = tokens[i];
        if (!column) {
            throw new Error('Expected column name in WHERE clause');
        }
        i++;

        // Find operator
        let operator = tokens[i];
        if (!operator) {
            throw new Error('Expected operator in WHERE clause');
        }

        // Handle LIKE operator (case-insensitive)
        if (operator.toUpperCase() === 'LIKE') {
            operator = 'LIKE';
        }
        i++;

        const valueToken = tokens[i];
        if (valueToken === undefined) {
            throw new Error('Expected value in WHERE clause');
        }

        const value = this._parseValue(valueToken);

        return {
            column: column,
            operator: operator,
            value: value
        };
    }

    /**
     * Parses a value token into its JavaScript type
     * 
     * @private
     * @param {string} token - Token to parse
     * @returns {*} Parsed value (number, string, boolean, or null)
     */
    _parseValue(token) {
        // Handle NULL
        if (token.toUpperCase() === 'NULL') {
            return null;
        }

        // Handle booleans
        if (token.toUpperCase() === 'TRUE') {
            return true;
        }
        if (token.toUpperCase() === 'FALSE') {
            return false;
        }

        // Handle quoted strings
        if (token.startsWith("'") && token.endsWith("'")) {
            return token.slice(1, -1); // Remove quotes
        }

        // Handle numbers
        if (/^-?\d+$/.test(token)) {
            return parseInt(token, 10);
        }
        if (/^-?\d+\.\d+$/.test(token)) {
            return parseFloat(token);
        }

        // Return as-is (might be an identifier or unquoted string)
        return token;
    }

    // =========================================================================
    // USE DATABASE PARSER
    // =========================================================================

    /**
     * Parses a USE statement
     * 
     * Syntax:
     * USE database_name
     * 
     * @private
     * @param {string[]} tokens - Tokenized SQL
     * @returns {Object} Parsed USE AST
     * 
     * @example
     * parser.parse('USE mydb');
     * // { type: 'USE', database: 'mydb' }
     */
    _parseUse(tokens) {
        let i = 1; // Skip 'USE'

        const databaseName = tokens[i];
        if (!databaseName) {
            throw new Error('Expected database name after USE');
        }

        return {
            type: 'USE',
            database: databaseName
        };
    }

    // =========================================================================
    // SHOW PARSER
    // =========================================================================

    /**
     * Parses a SHOW statement
     * 
     * Syntax:
     * SHOW DATABASES
     * SHOW TABLES
     * 
     * @private
     * @param {string[]} tokens - Tokenized SQL
     * @returns {Object} Parsed SHOW AST
     * 
     * @example
     * parser.parse('SHOW DATABASES');
     * // { type: 'SHOW', target: 'DATABASES' }
     * 
     * parser.parse('SHOW TABLES');
     * // { type: 'SHOW', target: 'TABLES' }
     */
    _parseShow(tokens) {
        let i = 1; // Skip 'SHOW'

        const target = tokens[i]?.toUpperCase();

        if (!target) {
            throw new Error('Expected DATABASES or TABLES after SHOW');
        }

        if (target !== 'DATABASES' && target !== 'TABLES') {
            throw new Error(`Unsupported SHOW target: '${target}'. Only SHOW DATABASES and SHOW TABLES are supported`);
        }

        return {
            type: 'SHOW',
            target: target
        };
    }
}

module.exports = SQLParser;
