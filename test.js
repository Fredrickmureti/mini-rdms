/**
 * =============================================================================
 * MINI-RDBMS - Test Suite
 * =============================================================================
 * 
 * This file contains comprehensive tests for all components of the mini-RDBMS.
 * Run with: npm test
 * 
 * WHAT'S TESTED:
 * --------------
 * 1. Column - Type validation and constraints
 * 2. Table - CRUD operations and constraints
 * 3. Database - Table management and joins
 * 4. SQLParser - SQL syntax parsing
 * 5. QueryEngine - Query execution
 * 
 * =============================================================================
 */

const Column = require('./src/core/Column');
const Table = require('./src/core/Table');
const Database = require('./src/database');
const SQLParser = require('./src/parser/SQLParser');
const QueryEngine = require('./src/engine/QueryEngine');
const Index = require('./src/core/Index');

// Test counters
let passed = 0;
let failed = 0;

/**
 * Simple test assertion function
 */
function assert(condition, testName) {
    if (condition) {
        console.log(`  ✓ ${testName}`);
        passed++;
    } else {
        console.log(`  ✗ ${testName}`);
        failed++;
    }
}

/**
 * Assert that a function throws an error
 */
function assertThrows(fn, testName) {
    try {
        fn();
        console.log(`  ✗ ${testName} (expected error, but none thrown)`);
        failed++;
    } catch (e) {
        console.log(`  ✓ ${testName}`);
        passed++;
    }
}

// =========================================================================
// COLUMN TESTS
// =========================================================================

console.log('\n📋 COLUMN TESTS');
console.log('─'.repeat(50));

// Test Column creation
const intCol = new Column('id', 'INT', { primaryKey: true });
assert(intCol.name === 'id', 'Column name is set correctly');
assert(intCol.type === 'INT', 'Column type is set correctly');
assert(intCol.primaryKey === true, 'Primary key constraint is set');
assert(intCol.notNull === true, 'PK implies NOT NULL');
assert(intCol.unique === true, 'PK implies UNIQUE');

// Test type validation
const textCol = new Column('name', 'TEXT');
assert(textCol.isValidType('hello') === true, 'TEXT accepts strings');
assert(textCol.isValidType(123) === false, 'TEXT rejects numbers');

const boolCol = new Column('active', 'BOOL');
assert(boolCol.isValidType(true) === true, 'BOOL accepts true');
assert(boolCol.isValidType(false) === true, 'BOOL accepts false');
assert(boolCol.isValidType('true') === false, 'BOOL rejects strings');

// Test NOT NULL validation
const notNullCol = new Column('required', 'TEXT', { notNull: true });
assertThrows(() => notNullCol.validate(null), 'NOT NULL rejects null');
assertThrows(() => notNullCol.validate(undefined), 'NOT NULL rejects undefined');

// =========================================================================
// TABLE TESTS
// =========================================================================

console.log('\n📋 TABLE TESTS');
console.log('─'.repeat(50));

// Create test table
const userColumns = [
    new Column('id', 'INT', { primaryKey: true }),
    new Column('name', 'TEXT', { notNull: true }),
    new Column('email', 'TEXT', { unique: true }),
    new Column('active', 'BOOL')
];
const usersTable = new Table('users', userColumns);

// Test insert
const user1 = usersTable.insert({
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    active: true
});
assert(user1.id === 1, 'Insert returns inserted row');
assert(usersTable.count() === 1, 'Row count increases after insert');

// Test select all
const allUsers = usersTable.select();
assert(allUsers.length === 1, 'Select returns all rows');
assert(allUsers[0].name === 'Alice', 'Select returns correct data');

// Insert more data for testing
usersTable.insert({ id: 2, name: 'Bob', email: 'bob@example.com', active: false });
usersTable.insert({ id: 3, name: 'Charlie', email: 'charlie@example.com', active: true });

// Test select with columns
const namesOnly = usersTable.select(['name']);
assert(namesOnly[0].name !== undefined, 'Select specific columns works');
assert(namesOnly[0].id === undefined, 'Select excludes non-requested columns');

// Test select with WHERE
const activeUsers = usersTable.select(['*'], { 
    column: 'active', 
    operator: '=', 
    value: true 
});
assert(activeUsers.length === 2, 'WHERE clause filters correctly');

// Test unique constraint
assertThrows(
    () => usersTable.insert({ id: 4, name: 'Dave', email: 'alice@example.com', active: true }),
    'UNIQUE constraint prevents duplicate emails'
);

// Test primary key constraint
assertThrows(
    () => usersTable.insert({ id: 1, name: 'Duplicate', email: 'dup@example.com', active: true }),
    'PRIMARY KEY constraint prevents duplicates'
);

// Test update
const updated = usersTable.update(
    { active: false },
    { column: 'id', operator: '=', value: 1 }
);
assert(updated === 1, 'Update returns affected row count');
const updatedUser = usersTable.findByPrimaryKey(1);
assert(updatedUser.active === false, 'Update changes data correctly');

// Test delete
const deleted = usersTable.delete({ column: 'id', operator: '=', value: 3 });
assert(deleted === 1, 'Delete returns deleted row count');
assert(usersTable.count() === 2, 'Delete removes row from table');

// =========================================================================
// DATABASE TESTS
// =========================================================================

console.log('\n📋 DATABASE TESTS');
console.log('─'.repeat(50));

const db = new Database('testdb');

// Test create table
const postsColumns = [
    new Column('id', 'INT', { primaryKey: true }),
    new Column('user_id', 'INT'),
    new Column('title', 'TEXT', { notNull: true }),
    new Column('content', 'TEXT')
];
const postsTable = new Table('posts', postsColumns);

db.createTable('users', usersTable);
db.createTable('posts', postsTable);

assert(db.listTables().length === 2, 'Database tracks multiple tables');
assert(db.hasTable('users') === true, 'hasTable returns true for existing tables');
assert(db.hasTable('nonexistent') === false, 'hasTable returns false for missing tables');

// Test get table
const retrievedTable = db.getTable('users');
assert(retrievedTable === usersTable, 'getTable returns correct table');

assertThrows(
    () => db.getTable('nonexistent'),
    'getTable throws for missing tables'
);

// Test drop table
db.dropTable('posts');
assert(db.hasTable('posts') === false, 'dropTable removes table');

// =========================================================================
// INDEX TESTS
// =========================================================================

console.log('\n📋 INDEX TESTS');
console.log('─'.repeat(50));

const emailIndex = new Index('email');

emailIndex.add('alice@example.com', 0);
emailIndex.add('bob@example.com', 1);
emailIndex.add('charlie@example.com', 2);

assert(emailIndex.has('alice@example.com') === true, 'Index.has returns true for existing value');
assert(emailIndex.has('nonexistent@example.com') === false, 'Index.has returns false for missing value');

const found = emailIndex.find('alice@example.com');
assert(found.length === 1 && found[0] === 0, 'Index.find returns correct row index');

emailIndex.remove('alice@example.com', 0);
assert(emailIndex.has('alice@example.com') === false, 'Index.remove deletes entry');

// =========================================================================
// SQL PARSER TESTS
// =========================================================================

console.log('\n📋 SQL PARSER TESTS');
console.log('─'.repeat(50));

const parser = new SQLParser();

// Test SELECT parsing
const selectAST = parser.parse('SELECT name, email FROM users WHERE id = 1');
assert(selectAST.type === 'SELECT', 'Parser identifies SELECT query');
assert(selectAST.columns.includes('name'), 'Parser extracts columns');
assert(selectAST.table === 'users', 'Parser extracts table name');
assert(selectAST.where.column === 'id', 'Parser extracts WHERE column');
assert(selectAST.where.value === 1, 'Parser converts numeric values');

// Test INSERT parsing
const insertAST = parser.parse("INSERT INTO users (id, name) VALUES (1, 'Alice')");
assert(insertAST.type === 'INSERT', 'Parser identifies INSERT query');
assert(insertAST.table === 'users', 'Parser extracts INSERT table');
assert(insertAST.values[0] === 1, 'Parser extracts numeric value');
assert(insertAST.values[1] === 'Alice', 'Parser extracts string value');

// Test CREATE TABLE parsing
const createAST = parser.parse('CREATE TABLE posts (id INT PRIMARY KEY, title TEXT NOT NULL)');
assert(createAST.type === 'CREATE_TABLE', 'Parser identifies CREATE TABLE');
assert(createAST.columns.length === 2, 'Parser extracts column count');
assert(createAST.columns[0].primaryKey === true, 'Parser identifies PRIMARY KEY');
assert(createAST.columns[1].notNull === true, 'Parser identifies NOT NULL');

// Test UPDATE parsing
const updateAST = parser.parse("UPDATE users SET name = 'Bob' WHERE id = 1");
assert(updateAST.type === 'UPDATE', 'Parser identifies UPDATE query');
assert(updateAST.set.name === 'Bob', 'Parser extracts SET clause');

// Test DELETE parsing
const deleteAST = parser.parse('DELETE FROM users WHERE id = 1');
assert(deleteAST.type === 'DELETE', 'Parser identifies DELETE query');

// =========================================================================
// QUERY ENGINE TESTS
// =========================================================================

console.log('\n📋 QUERY ENGINE TESTS');
console.log('─'.repeat(50));

const testDb = new Database('engine_test');
const engine = new QueryEngine(testDb);

// Test CREATE TABLE execution
const createResult = engine.execute(`
    CREATE TABLE products (
        id INT PRIMARY KEY,
        name TEXT NOT NULL,
        price INT,
        in_stock BOOL
    )
`);
assert(createResult.success === true, 'CREATE TABLE executes successfully');
assert(testDb.hasTable('products') === true, 'Table is created in database');

// Test INSERT execution
const insertResult = engine.execute("INSERT INTO products VALUES (1, 'Widget', 100, true)");
assert(insertResult.success === true, 'INSERT executes successfully');
assert(insertResult.rowsAffected === 1, 'INSERT affects 1 row');

engine.execute("INSERT INTO products VALUES (2, 'Gadget', 200, true)");
engine.execute("INSERT INTO products VALUES (3, 'Gizmo', 150, false)");

// Test SELECT execution
const selectResult = engine.execute('SELECT * FROM products');
assert(selectResult.success === true, 'SELECT executes successfully');
assert(selectResult.data.length === 3, 'SELECT returns all rows');

// Test SELECT with WHERE
const filteredResult = engine.execute('SELECT name FROM products WHERE price > 100');
assert(filteredResult.success === true, 'SELECT with WHERE executes');
assert(filteredResult.data.length === 2, 'WHERE filters correctly');

// Test UPDATE execution
const updateResult = engine.execute("UPDATE products SET in_stock = false WHERE id = 2");
assert(updateResult.success === true, 'UPDATE executes successfully');
assert(updateResult.rowsAffected === 1, 'UPDATE affects correct rows');

// Test DELETE execution
const deleteResult = engine.execute('DELETE FROM products WHERE id = 3');
assert(deleteResult.success === true, 'DELETE executes successfully');
assert(deleteResult.rowsAffected === 1, 'DELETE affects correct rows');

// Verify delete
const afterDelete = engine.execute('SELECT * FROM products');
assert(afterDelete.data.length === 2, 'DELETE removes row from table');

// Test DROP TABLE
const dropResult = engine.execute('DROP TABLE products');
assert(dropResult.success === true, 'DROP TABLE executes successfully');
assert(testDb.hasTable('products') === false, 'Table is removed from database');

// Test error handling
const errorResult = engine.execute('SELECT * FROM nonexistent');
assert(errorResult.success === false, 'Error returns success=false');
assert(errorResult.error !== null, 'Error message is provided');

// =========================================================================
// DATABASE MANAGER TESTS
// =========================================================================

console.log('\n📋 DATABASE MANAGER TESTS');
console.log('─'.repeat(50));

const DatabaseManager = require('./src/DatabaseManager');

// Test DatabaseManager creation (disable persistence for tests)
const manager = new DatabaseManager({ createDefault: false, persist: false });
assert(manager.listDatabases().length === 0, 'Empty manager has no databases');
assert(manager.getCurrentDatabase() === null, 'No current database initially');

// Test CREATE DATABASE
manager.createDatabase('testdb');
assert(manager.databaseExists('testdb') === true, 'Database is created');
assert(manager.listDatabases().length === 1, 'Manager has one database');

// Test USE
manager.use('testdb');
assert(manager.getCurrentDatabaseName() === 'testdb', 'USE switches current database');
assert(manager.getCurrentDatabase() !== null, 'getCurrentDatabase returns database');
assert(manager.getCurrentDatabase().name === 'testdb', 'Current database has correct name');

// Test creating multiple databases
manager.createDatabase('db2');
manager.createDatabase('db3');
assert(manager.listDatabases().length === 3, 'Manager can hold multiple databases');

// Test database doesn't exist error
assertThrows(() => manager.use('nonexistent'), 'USE throws for nonexistent database');

// Test duplicate database error
assertThrows(() => manager.createDatabase('testdb'), 'Cannot create duplicate database');

// Test DROP DATABASE
manager.dropDatabase('db3');
assert(manager.listDatabases().length === 2, 'DROP DATABASE removes database');
assert(manager.databaseExists('db3') === false, 'Dropped database no longer exists');

// Test dropping current database clears selection
manager.use('db2');
manager.dropDatabase('db2');
assert(manager.getCurrentDatabaseName() === null, 'Dropping current DB clears selection');

// Test createDatabaseIfNotExists
manager.createDatabaseIfNotExists('testdb'); // should not throw
assert(manager.databaseExists('testdb') === true, 'createDatabaseIfNotExists works for existing');
manager.createDatabaseIfNotExists('newdb');
assert(manager.databaseExists('newdb') === true, 'createDatabaseIfNotExists creates new');

// Test getStats
const stats = manager.getStats();
assert(stats.databaseCount === 2, 'getStats returns correct database count');
assert(Array.isArray(stats.databases), 'getStats returns databases array');

// =========================================================================
// DATABASE COMMANDS IN QUERY ENGINE TESTS
// =========================================================================

console.log('\n📋 DATABASE SQL COMMANDS TESTS');
console.log('─'.repeat(50));

const manager2 = new DatabaseManager({ createDefault: false, persist: false });
const engine2 = new QueryEngine(manager2);

// Test CREATE DATABASE via SQL
let result = engine2.execute('CREATE DATABASE myapp');
assert(result.success === true, 'CREATE DATABASE SQL succeeds');
assert(manager2.databaseExists('myapp') === true, 'Database created via SQL');

// Test SHOW DATABASES
result = engine2.execute('SHOW DATABASES');
assert(result.success === true, 'SHOW DATABASES succeeds');
assert(result.data.length === 1, 'SHOW DATABASES returns correct count');
assert(result.data[0].Database === 'myapp', 'SHOW DATABASES returns database name');

// Test USE via SQL
result = engine2.execute('USE myapp');
assert(result.success === true, 'USE SQL succeeds');
assert(manager2.getCurrentDatabaseName() === 'myapp', 'USE changes current database');

// Test CREATE TABLE after USE
result = engine2.execute('CREATE TABLE users (id INT PRIMARY KEY, name TEXT)');
assert(result.success === true, 'CREATE TABLE in database succeeds');
assert(manager2.getCurrentDatabase().hasTable('users') === true, 'Table created in database');

// Test SHOW TABLES
result = engine2.execute('SHOW TABLES');
assert(result.success === true, 'SHOW TABLES succeeds');
assert(result.data.length === 1, 'SHOW TABLES returns correct count');
assert(result.data[0].Table === 'users', 'SHOW TABLES returns table name');

// Test INSERT and SELECT work with USE
result = engine2.execute("INSERT INTO users VALUES (1, 'Alice')");
assert(result.success === true, 'INSERT after USE succeeds');

result = engine2.execute('SELECT * FROM users');
assert(result.success === true, 'SELECT after USE succeeds');
assert(result.data.length === 1, 'SELECT returns correct data');

// Test CREATE DATABASE IF NOT EXISTS
result = engine2.execute('CREATE DATABASE IF NOT EXISTS myapp');
assert(result.success === true, 'CREATE DATABASE IF NOT EXISTS succeeds for existing');

result = engine2.execute('CREATE DATABASE IF NOT EXISTS newapp');
assert(result.success === true, 'CREATE DATABASE IF NOT EXISTS creates new database');
assert(manager2.databaseExists('newapp') === true, 'New database created');

// Test DROP DATABASE via SQL
result = engine2.execute('DROP DATABASE newapp');
assert(result.success === true, 'DROP DATABASE SQL succeeds');
assert(manager2.databaseExists('newapp') === false, 'Database dropped via SQL');

// Test DROP DATABASE IF EXISTS
result = engine2.execute('DROP DATABASE IF EXISTS nonexistent');
assert(result.success === true, 'DROP DATABASE IF EXISTS succeeds for nonexistent');

// Test error when no database selected
const manager3 = new DatabaseManager({ createDefault: false, persist: false });
const engine3 = new QueryEngine(manager3);
engine3.execute('CREATE DATABASE testdb');
// Don't USE, try to CREATE TABLE
result = engine3.execute('CREATE TABLE test (id INT)');
assert(result.success === false, 'CREATE TABLE fails without USE');
assert(result.error.includes('No database selected'), 'Error mentions no database selected');

// =========================================================================
// RESULTS SUMMARY
// =========================================================================

console.log('\n' + '═'.repeat(50));
console.log('TEST RESULTS');
console.log('═'.repeat(50));
console.log(`  ✓ Passed: ${passed}`);
console.log(`  ✗ Failed: ${failed}`);
console.log(`  Total:   ${passed + failed}`);
console.log('═'.repeat(50));

if (failed > 0) {
    console.log('\n⚠️  Some tests failed!\n');
    process.exit(1);
} else {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
}
