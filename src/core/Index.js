/**
 * =============================================================================
 * INDEX CLASS
 * =============================================================================
 * 
 * An Index is a data structure that improves the speed of data retrieval
 * operations on a database table. Think of it like the index at the back
 * of a book - instead of reading every page to find a topic, you look
 * it up in the index to find the exact page number.
 * 
 * CONCEPTS COVERED:
 * -----------------
 * 1. Hash Index: O(1) lookups using a hash map
 * 2. Index Maintenance: Keeping indexes in sync with table data
 * 3. Query Optimization: Using indexes to speed up WHERE clauses
 * 
 * HOW IT WORKS:
 * -------------
 * Without Index (Full Table Scan - O(n)):
 * ┌────────────────────────────────────────────┐
 * │ SELECT * FROM users WHERE email = 'x@y.z' │
 * └────────────────────────────────────────────┘
 *              ↓
 * Scan every row: Row 1? No. Row 2? No. Row 3? Yes!
 * Time: O(n) where n = number of rows
 * 
 * With Index (Hash Lookup - O(1)):
 * ┌────────────────────────────────────────────┐
 * │ SELECT * FROM users WHERE email = 'x@y.z' │
 * └────────────────────────────────────────────┘
 *              ↓
 * Look up 'x@y.z' in index → Row 3
 * Time: O(1) constant time
 * 
 * INDEX STRUCTURE:
 * ----------------
 * Index on 'email' column:
 * {
 *   'alice@example.com': [0],     // Value → Array of row indexes
 *   'bob@example.com': [1],
 *   'charlie@example.com': [2]
 * }
 * 
 * USAGE EXAMPLE:
 * --------------
 * const index = new Index('email');
 * index.add('alice@example.com', 0);  // Row 0 has this email
 * index.add('bob@example.com', 1);    // Row 1 has this email
 * 
 * const rowIndexes = index.find('alice@example.com'); // [0]
 * 
 * =============================================================================
 */

class Index {
    /**
     * Creates a new Index instance
     * 
     * @param {string} columnName - The name of the column being indexed
     * @param {string} [type='HASH'] - Type of index (currently only HASH supported)
     * 
     * @example
     * const emailIndex = new Index('email');
     * const ageIndex = new Index('age');
     */
    constructor(columnName, type = 'HASH') {
        // The column this index is for
        this.columnName = columnName;

        // Index type (for future expansion - B-tree, etc.)
        this.type = type;

        // The actual index data structure
        // Maps: value → array of row indexes
        // We use an array because non-unique columns can have duplicate values
        this.data = {};

        // Track number of entries for statistics
        this.entryCount = 0;
    }

    // =========================================================================
    // CORE OPERATIONS
    // =========================================================================

    /**
     * Adds a value-to-row-index mapping to the index
     * 
     * @param {*} value - The column value to index
     * @param {number} rowIndex - The row index where this value exists
     * 
     * @example
     * index.add('alice@example.com', 0);  // Row 0 contains 'alice@example.com'
     * index.add('bob@example.com', 1);    // Row 1 contains 'bob@example.com'
     */
    add(value, rowIndex) {
        // Convert value to string key (handles null/undefined)
        const key = this._toKey(value);

        // Skip null/undefined values (they typically aren't indexed)
        if (key === null) {
            return;
        }

        // Initialize array if this is a new value
        if (!this.data[key]) {
            this.data[key] = [];
        }

        // Add the row index
        this.data[key].push(rowIndex);
        this.entryCount++;
    }

    /**
     * Finds all row indexes for a given value
     * 
     * This is the main query operation - O(1) lookup time!
     * 
     * @param {*} value - The value to search for
     * @returns {number[]} Array of row indexes containing this value
     * 
     * @example
     * const rows = index.find('alice@example.com');
     * // Returns [0] if 'alice@example.com' is in row 0
     * 
     * const rows = index.find('nonexistent@email.com');
     * // Returns [] if value doesn't exist
     */
    find(value) {
        const key = this._toKey(value);

        if (key === null) {
            return [];
        }

        // Return a copy of the array to prevent external modification
        return [...(this.data[key] || [])];
    }

    /**
     * Checks if a value exists in the index
     * 
     * @param {*} value - The value to check
     * @returns {boolean} True if value exists in index
     * 
     * @example
     * if (index.has('alice@example.com')) {
     *   console.log('Email exists in table');
     * }
     */
    has(value) {
        const key = this._toKey(value);
        return key !== null && key in this.data;
    }

    /**
     * Removes a value-to-row-index mapping from the index
     * 
     * @param {*} value - The column value
     * @param {number} rowIndex - The row index to remove
     * 
     * @example
     * // When deleting a row or updating a value
     * index.remove('old@email.com', 5);
     */
    remove(value, rowIndex) {
        const key = this._toKey(value);

        if (key === null || !this.data[key]) {
            return;
        }

        // Find and remove the row index
        const indexes = this.data[key];
        const position = indexes.indexOf(rowIndex);

        if (position !== -1) {
            indexes.splice(position, 1);
            this.entryCount--;

            // Clean up empty arrays
            if (indexes.length === 0) {
                delete this.data[key];
            }
        }
    }

    /**
     * Updates an entry in the index (convenience method for update operations)
     * 
     * @param {*} oldValue - The old column value
     * @param {*} newValue - The new column value
     * @param {number} rowIndex - The row index being updated
     * 
     * @example
     * // When updating a row's email from 'old@mail.com' to 'new@mail.com'
     * index.update('old@mail.com', 'new@mail.com', 5);
     */
    update(oldValue, newValue, rowIndex) {
        this.remove(oldValue, rowIndex);
        this.add(newValue, rowIndex);
    }

    // =========================================================================
    // BULK OPERATIONS
    // =========================================================================

    /**
     * Clears all entries from the index
     * 
     * @example
     * index.clear(); // Empties the index
     */
    clear() {
        this.data = {};
        this.entryCount = 0;
    }

    /**
     * Rebuilds the index from scratch using table data
     * 
     * This is useful after bulk operations like DELETE that might
     * invalidate row indexes.
     * 
     * @param {Object[]} rows - Array of row objects from the table
     * 
     * @example
     * // After a DELETE operation, row indexes might be stale
     * index.rebuild(table.getAllRows());
     */
    rebuild(rows) {
        this.clear();

        for (let i = 0; i < rows.length; i++) {
            const value = rows[i][this.columnName];
            this.add(value, i);
        }
    }

    // =========================================================================
    // RANGE QUERIES (Future Enhancement)
    // =========================================================================

    /**
     * Gets all unique values in the index
     * 
     * @returns {Array} Array of unique values
     * 
     * @example
     * const allEmails = index.getUniqueValues();
     * // ['alice@example.com', 'bob@example.com', 'charlie@example.com']
     */
    getUniqueValues() {
        return Object.keys(this.data);
    }

    /**
     * Gets the count of rows for each unique value
     * 
     * @returns {Object} Map of value → count
     * 
     * @example
     * const counts = index.getValueCounts();
     * // { 'USA': 150, 'UK': 75, 'Canada': 50 }
     */
    getValueCounts() {
        const counts = {};
        for (const [key, indexes] of Object.entries(this.data)) {
            counts[key] = indexes.length;
        }
        return counts;
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Converts a value to an index key
     * 
     * @private
     * @param {*} value - Value to convert
     * @returns {string|null} String key or null for null/undefined values
     */
    _toKey(value) {
        if (value === null || value === undefined) {
            return null;
        }

        // Convert to string for consistent hash map keys
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        return String(value);
    }

    /**
     * Gets statistics about the index
     * 
     * @returns {Object} Index statistics
     * 
     * @example
     * const stats = index.getStats();
     * // {
     * //   columnName: 'email',
     * //   type: 'HASH',
     * //   uniqueValues: 100,
     * //   totalEntries: 100,
     * //   avgEntriesPerValue: 1
     * // }
     */
    getStats() {
        const uniqueValues = Object.keys(this.data).length;
        return {
            columnName: this.columnName,
            type: this.type,
            uniqueValues: uniqueValues,
            totalEntries: this.entryCount,
            avgEntriesPerValue: uniqueValues > 0 
                ? (this.entryCount / uniqueValues).toFixed(2) 
                : 0
        };
    }

    /**
     * Returns a string representation of the index
     * 
     * @returns {string} Index info
     */
    toString() {
        return `Index(${this.columnName}): ${this.entryCount} entries, ` +
               `${Object.keys(this.data).length} unique values`;
    }
}

module.exports = Index;
