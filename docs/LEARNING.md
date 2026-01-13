# Learning Guide 📚

This guide will help you understand the core concepts implemented in this Mini-RDBMS project. Follow along in the suggested order for the best learning experience.

---

## Table of Contents

1. [Level 1: Core Concepts](#level-1-core-concepts)
   - [Columns and Data Types](#columns-and-data-types)
   - [Tables and Rows](#tables-and-rows)
   - [Constraints](#constraints)
2. [Level 2: Operations](#level-2-operations)
   - [CRUD Operations](#crud-operations)
   - [Querying with WHERE](#querying-with-where)
3. [Level 3: Advanced Features](#level-3-advanced-features)
   - [Indexing](#indexing)
   - [Joins](#joins)
4. [Level 4: SQL Parsing](#level-4-sql-parsing)
   - [Tokenization](#tokenization)
   - [Abstract Syntax Trees](#abstract-syntax-trees)
5. [Level 5: Building Interfaces](#level-5-building-interfaces)
   - [REPL Design](#repl-design)
   - [REST API Design](#rest-api-design)

---

## Level 1: Core Concepts

### Columns and Data Types

**File: [src/core/Column.js](../src/core/Column.js)**

A **column** defines a single field in a table. Think of it like a column in a spreadsheet:

```
| id (INT) | name (TEXT) | active (BOOL) |
|----------|-------------|---------------|
| 1        | "Alice"     | true          |
| 2        | "Bob"       | false         |
```

Each column has:
- **Name**: The identifier (e.g., "id", "name")
- **Type**: What kind of data it holds

**Data Types in this RDBMS:**

| Type | JavaScript Equivalent | Examples |
|------|----------------------|----------|
| INT  | Number (integer)     | 1, 42, -5 |
| TEXT | String              | "Hello", "Alice" |
| BOOL | Boolean             | true, false |

**Try it yourself:**
```javascript
const Column = require('./src/core/Column');

// Create an integer column
const ageColumn = new Column('age', 'INT');

// Validate values
console.log(ageColumn.isValidType(25));    // true
console.log(ageColumn.isValidType("25"));  // false - strings aren't integers!
```

### Tables and Rows

**File: [src/core/Table.js](../src/core/Table.js)**

A **table** is a collection of rows with a defined structure (columns):

```
Table: users
┌────────────┬──────────────┬─────────────┐
│ id (INT)   │ name (TEXT)  │ active(BOOL)│
├────────────┼──────────────┼─────────────┤
│ 1          │ 'Alice'      │ true        │  ← Row 1
│ 2          │ 'Bob'        │ false       │  ← Row 2
│ 3          │ 'Charlie'    │ true        │  ← Row 3
└────────────┴──────────────┴─────────────┘
```

**Key concepts:**
- Tables have a **schema** (defined by columns)
- Each **row** is one record
- Rows are stored as JavaScript objects

**Try it yourself:**
```javascript
const Table = require('./src/core/Table');
const Column = require('./src/core/Column');

// Define the schema
const columns = [
    new Column('id', 'INT', { primaryKey: true }),
    new Column('name', 'TEXT', { notNull: true })
];

// Create the table
const users = new Table('users', columns);

// Insert a row
users.insert({ id: 1, name: 'Alice' });

// Read rows
console.log(users.select()); // [{ id: 1, name: 'Alice' }]
```

### Constraints

Constraints are rules that enforce data integrity:

| Constraint | Purpose | Example |
|------------|---------|---------|
| PRIMARY KEY | Uniquely identifies each row | User ID |
| NOT NULL | Ensures a value is always provided | Required name |
| UNIQUE | Prevents duplicate values | Email address |

**How constraints work internally:**

```javascript
// In Table.js, we track unique values using Sets:
this.uniqueMap = {
    'id': Set { 1, 2, 3 },           // All existing IDs
    'email': Set { 'a@b.com' }        // All existing emails
};

// Before insert, we check:
if (this.uniqueMap['email'].has(newEmail)) {
    throw new Error('UNIQUE constraint violation!');
}
```

---

## Level 2: Operations

### CRUD Operations

CRUD = **C**reate, **R**ead, **U**pdate, **D**elete

**File: [src/core/Table.js](../src/core/Table.js)**

| Operation | SQL | Method |
|-----------|-----|--------|
| Create | INSERT | `table.insert(data)` |
| Read | SELECT | `table.select(columns, where)` |
| Update | UPDATE | `table.update(set, where)` |
| Delete | DELETE | `table.delete(where)` |

**Insert (Create):**
```javascript
// Step-by-step what happens:
// 1. Validate each value against column type
// 2. Check NOT NULL constraints
// 3. Check UNIQUE constraints
// 4. Add row to storage array
// 5. Update indexes

table.insert({ id: 1, name: 'Alice' });
```

**Select (Read):**
```javascript
// Get all rows
table.select();

// Get specific columns
table.select(['name', 'email']);

// With filter
table.select(['*'], { column: 'id', operator: '=', value: 1 });
```

**Update:**
```javascript
// Change name where id = 1
table.update(
    { name: 'Alicia' },              // SET clause
    { column: 'id', operator: '=', value: 1 }  // WHERE clause
);
```

**Delete:**
```javascript
// Remove where id = 1
table.delete({ column: 'id', operator: '=', value: 1 });
```

### Querying with WHERE

The WHERE clause filters rows based on conditions:

**Supported operators:**

| Operator | Meaning | Example |
|----------|---------|---------|
| = | Equals | `id = 1` |
| != or <> | Not equals | `status != 'inactive'` |
| > | Greater than | `age > 18` |
| < | Less than | `price < 100` |
| >= | Greater or equal | `score >= 90` |
| <= | Less or equal | `quantity <= 5` |
| LIKE | Pattern match | `name LIKE 'A%'` |

**How WHERE works internally:**

```javascript
// In Table.js:
_rowMatchesWhere(row, whereClause) {
    const { column, operator, value } = whereClause;
    const rowValue = row[column];
    
    switch (operator) {
        case '=':  return rowValue === value;
        case '>':  return rowValue > value;
        case '<':  return rowValue < value;
        // ... etc
    }
}
```

---

## Level 3: Advanced Features

### Indexing

**File: [src/core/Index.js](../src/core/Index.js)**

Without an index, finding a row requires scanning every row (O(n)):
```
Find email = 'alice@example.com'
→ Check row 1... no
→ Check row 2... no
→ Check row 3... yes! (after checking all rows)
```

With an index, it's instant (O(1)):
```
Find email = 'alice@example.com'
→ Look up in hash map: { 'alice@example.com': 2 }
→ Found at row 2!
```

**Index structure:**
```javascript
// Index is a hash map: value → row indexes
{
    'alice@example.com': [0],    // Row 0
    'bob@example.com': [1],      // Row 1
    'charlie@example.com': [2]   // Row 2
}
```

**Try it yourself:**
```javascript
const Index = require('./src/core/Index');

const emailIndex = new Index('email');
emailIndex.add('alice@example.com', 0);
emailIndex.add('bob@example.com', 1);

// O(1) lookup!
console.log(emailIndex.find('alice@example.com')); // [0]
```

### Joins

**File: [src/database.js](../src/database.js)**

Joins combine data from multiple tables:

```
Table: users              Table: orders
┌────┬───────┐            ┌────┬─────────┬────────┐
│ id │ name  │            │ id │ user_id │ amount │
├────┼───────┤            ├────┼─────────┼────────┤
│ 1  │ Alice │            │ 1  │ 1       │ 100    │
│ 2  │ Bob   │            │ 2  │ 1       │ 200    │
└────┴───────┘            │ 3  │ 2       │ 150    │
                          └────┴─────────┴────────┘

JOIN users.id = orders.user_id:
┌──────────┬────────────┬──────────────┐
│ users.id │ users.name │ orders.amount│
├──────────┼────────────┼──────────────┤
│ 1        │ Alice      │ 100          │
│ 1        │ Alice      │ 200          │
│ 2        │ Bob        │ 150          │
└──────────┴────────────┴──────────────┘
```

**Try it yourself:**
```javascript
const db = new Database();
// ... create users and orders tables ...

const results = db.join('users', 'orders', 'id', 'user_id');
console.log(results);
```

---

## Level 4: SQL Parsing

### Tokenization

**File: [src/parser/SQLParser.js](../src/parser/SQLParser.js)**

Tokenization breaks a SQL string into individual tokens:

```
Input:  "SELECT name, age FROM users WHERE age > 18"
         ↓
Tokens: ['SELECT', 'name', ',', 'age', 'FROM', 'users', 'WHERE', 'age', '>', '18']
```

**How the tokenizer works:**

```javascript
_tokenize(sql) {
    const tokens = [];
    let i = 0;
    
    while (i < sql.length) {
        // Skip whitespace
        if (/\s/.test(sql[i])) { i++; continue; }
        
        // Handle strings
        if (sql[i] === "'") {
            // Read until closing quote
        }
        
        // Handle keywords/identifiers
        if (/[a-zA-Z]/.test(sql[i])) {
            // Read until non-letter
        }
        
        // Handle numbers
        if (/[0-9]/.test(sql[i])) {
            // Read until non-digit
        }
    }
    
    return tokens;
}
```

### Abstract Syntax Trees

After tokenization, we parse tokens into an AST (structured object):

```
Tokens: ['SELECT', 'name', 'FROM', 'users', 'WHERE', 'id', '=', '1']
           ↓
AST: {
    type: 'SELECT',
    columns: ['name'],
    table: 'users',
    where: {
        column: 'id',
        operator: '=',
        value: 1
    }
}
```

**Try it yourself:**
```javascript
const SQLParser = require('./src/parser/SQLParser');

const parser = new SQLParser();
const ast = parser.parse("SELECT * FROM users WHERE active = true");
console.log(JSON.stringify(ast, null, 2));
```

---

## Level 5: Building Interfaces

### REPL Design

**File: [src/repl/repl.js](../src/repl/repl.js)**

A REPL is: **R**ead → **E**val → **P**rint → **L**oop

```
┌─────────────────────────────────────┐
│                                     │
│  ┌─────────┐                        │
│  │  READ   │ ← Get user input       │
│  └────┬────┘                        │
│       ↓                             │
│  ┌─────────┐                        │
│  │  EVAL   │ ← Execute SQL          │
│  └────┬────┘                        │
│       ↓                             │
│  ┌─────────┐                        │
│  │  PRINT  │ ← Display results      │
│  └────┬────┘                        │
│       ↓                             │
│  ┌─────────┐                        │
│  │  LOOP   │ ← Repeat               │
│  └─────────┘                        │
│                                     │
└─────────────────────────────────────┘
```

**Key components:**
```javascript
const readline = require('readline');

// Create interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'mini-rdbms> '
});

// Handle input
rl.on('line', (line) => {
    const result = engine.execute(line);
    console.log(result);
    rl.prompt();
});
```

### REST API Design

**File: [src/server/app.js](../src/server/app.js)**

REST = **Re**presentational **S**tate **T**ransfer

**URL structure:**
```
GET    /api/tables           → List all tables
POST   /api/tables           → Create a table
DELETE /api/tables/:name     → Drop a table
GET    /api/tables/:name/rows   → Get rows
POST   /api/tables/:name/rows   → Insert row
PUT    /api/tables/:name/rows   → Update rows
DELETE /api/tables/:name/rows   → Delete rows
```

**Key concepts:**
- **Resources**: Tables and rows
- **HTTP Methods**: GET (read), POST (create), PUT (update), DELETE (delete)
- **JSON**: Request and response format

```javascript
const express = require('express');
const app = express();

// List tables
app.get('/api/tables', (req, res) => {
    const tables = engine.getTables();
    res.json({ success: true, data: tables });
});

// Insert row
app.post('/api/tables/:name/rows', (req, res) => {
    const table = db.getTable(req.params.name);
    const row = table.insert(req.body);
    res.json({ success: true, data: row });
});
```

---

## Next Steps

After understanding this codebase, you could:

1. **Add more data types**: FLOAT, DATE, VARCHAR(n)
2. **Add ORDER BY**: Sort results
3. **Add GROUP BY**: Aggregate data
4. **Add LIMIT/OFFSET**: Pagination
5. **Add persistence**: Save to disk
6. **Add transactions**: BEGIN, COMMIT, ROLLBACK
7. **Add more join types**: LEFT JOIN, RIGHT JOIN
8. **Add subqueries**: Nested SELECT statements

Happy learning! 🎓
