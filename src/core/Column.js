/**
 * =============================================================================
 * COLUMN CLASS
 * =============================================================================
 * 
 * A Column represents a single field definition in a database table.
 * It defines the name, data type, and constraints for that field.
 * 
 * CONCEPTS COVERED:
 * -----------------
 * 1. Data Types: INT (integer), TEXT (string), BOOL (boolean)
 * 2. Constraints: PRIMARY KEY, NOT NULL, UNIQUE
 * 3. Type Validation: Ensuring values match the column's declared type
 * 
 * USAGE EXAMPLE:
 * --------------
 * const idColumn = new Column('id', 'INT', { primaryKey: true });
 * const nameColumn = new Column('name', 'TEXT', { notNull: true });
 * const emailColumn = new Column('email', 'TEXT', { unique: true });
 * 
 * // Validate a value
 * idColumn.validate(42);      // ✓ Valid - integer for INT column
 * idColumn.validate('hello'); // ✗ Error - string for INT column
 * 
 * =============================================================================
 */

/**
 * Supported data types in this RDBMS
 * @constant {Object}
 */
const DATA_TYPES = {
    INT: 'INT',     // Integer numbers (whole numbers)
    TEXT: 'TEXT',   // Text/String values
    BOOL: 'BOOL'    // Boolean (true/false)
};

/**
 * Column class - Defines the structure and constraints for a table column
 */
class Column {
    /**
     * Creates a new Column instance
     * 
     * @param {string} name - The name of the column (e.g., 'id', 'username')
     * @param {string} type - Data type: 'INT', 'TEXT', or 'BOOL'
     * @param {Object} options - Constraint options
     * @param {boolean} [options.primaryKey=false] - Is this the primary key?
     * @param {boolean} [options.notNull=false] - Does this column reject NULL values?
     * @param {boolean} [options.unique=false] - Must values be unique across all rows?
     * 
     * @example
     * // Create a primary key column
     * const idColumn = new Column('id', 'INT', { primaryKey: true });
     * 
     * // Create a required text column
     * const nameColumn = new Column('name', 'TEXT', { notNull: true });
     * 
     * // Create a unique email column
     * const emailColumn = new Column('email', 'TEXT', { unique: true, notNull: true });
     */
    constructor(name, type, options = {}) {
        // Validate that name is provided
        if (!name || typeof name !== 'string') {
            throw new Error('Column name must be a non-empty string');
        }

        // Validate that type is supported
        if (!Object.values(DATA_TYPES).includes(type)) {
            throw new Error(
                `Invalid column type '${type}'. Supported types: ${Object.values(DATA_TYPES).join(', ')}`
            );
        }

        // Store column metadata
        this.name = name;
        this.type = type;

        // Store constraints with defaults
        // Primary Key: Uniquely identifies each row (like an ID)
        this.primaryKey = options.primaryKey || false;

        // Not Null: This column must have a value (can't be empty)
        this.notNull = options.notNull || false;

        // Unique: No two rows can have the same value in this column
        this.unique = options.unique || false;

        // Primary keys are implicitly unique and not null
        if (this.primaryKey) {
            this.unique = true;
            this.notNull = true;
        }
    }

    /**
     * Validates a value against this column's type and constraints
     * 
     * Validation Steps:
     * 1. Check NOT NULL constraint
     * 2. Check data type matches
     * 
     * Note: UNIQUE constraint is checked at the Table level
     *       (requires knowing all existing values)
     * 
     * @param {*} value - The value to validate
     * @throws {Error} If validation fails
     * 
     * @example
     * const ageColumn = new Column('age', 'INT', { notNull: true });
     * ageColumn.validate(25);    // ✓ Valid
     * ageColumn.validate(null);  // ✗ Error: NOT NULL violation
     * ageColumn.validate('old'); // ✗ Error: Type mismatch
     */
    validate(value) {
        // Step 1: Check NOT NULL constraint
        if (this.notNull && (value === null || value === undefined)) {
            throw new Error(
                `NOT NULL constraint violation: Column '${this.name}' cannot be null`
            );
        }

        // Step 2: If value is null/undefined and NOT NULL is not set, it's valid
        if (value === null || value === undefined) {
            return; // NULL is allowed for this column
        }

        // Step 3: Validate the data type
        if (!this.isValidType(value)) {
            throw new Error(
                `Type mismatch for column '${this.name}': ` +
                `Expected '${this.type}', but got '${typeof value}' (value: ${value})`
            );
        }
    }

    /**
     * Checks if a value matches this column's data type
     * 
     * Type Mapping:
     * - INT  → JavaScript integer (checked with Number.isInteger)
     * - TEXT → JavaScript string
     * - BOOL → JavaScript boolean
     * 
     * @param {*} value - The value to check
     * @returns {boolean} True if type matches, false otherwise
     * 
     * @example
     * const intCol = new Column('num', 'INT');
     * intCol.isValidType(42);      // true
     * intCol.isValidType(3.14);    // false (not an integer)
     * intCol.isValidType('42');    // false (string, not int)
     */
    isValidType(value) {
        // NULL/undefined checks are handled in validate()
        if (value === null || value === undefined) {
            return true; // Let validate() handle null checks
        }

        // Check type based on column definition
        switch (this.type) {
            case DATA_TYPES.INT:
                // Must be a whole number (not a float)
                return Number.isInteger(value);

            case DATA_TYPES.TEXT:
                // Must be a string
                return typeof value === 'string';

            case DATA_TYPES.BOOL:
                // Must be a boolean
                return typeof value === 'boolean';

            default:
                // This shouldn't happen if constructor validation works
                throw new Error(`Unknown column type: '${this.type}'`);
        }
    }

    /**
     * Returns a string representation of this column (for debugging)
     * 
     * @returns {string} Column definition string
     * 
     * @example
     * const col = new Column('id', 'INT', { primaryKey: true });
     * console.log(col.toString()); // "id INT PRIMARY KEY NOT NULL UNIQUE"
     */
    toString() {
        let definition = `${this.name} ${this.type}`;
        
        if (this.primaryKey) definition += ' PRIMARY KEY';
        if (this.notNull && !this.primaryKey) definition += ' NOT NULL';
        if (this.unique && !this.primaryKey) definition += ' UNIQUE';
        
        return definition;
    }

    /**
     * Creates a Column instance from a plain object (useful for JSON parsing)
     * 
     * @param {Object} obj - Plain object with column properties
     * @returns {Column} New Column instance
     * 
     * @example
     * const col = Column.fromObject({
     *   name: 'id',
     *   type: 'INT',
     *   primaryKey: true
     * });
     */
    static fromObject(obj) {
        return new Column(obj.name, obj.type, {
            primaryKey: obj.primaryKey || false,
            notNull: obj.notNull || false,
            unique: obj.unique || false
        });
    }
}

// Export the Column class and DATA_TYPES for use in other modules
module.exports = Column;
module.exports.DATA_TYPES = DATA_TYPES;