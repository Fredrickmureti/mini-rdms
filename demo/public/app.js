/**
 * =============================================================================
 * TASK MANAGER - Frontend Application
 * =============================================================================
 * 
 * This is the JavaScript frontend for the Task Manager demo application.
 * It demonstrates how to interact with the Mini-RDBMS through its REST API.
 * 
 * CONCEPTS DEMONSTRATED:
 * ----------------------
 * 1. REST API consumption using fetch()
 * 2. CRUD operations (Create, Read, Update, Delete)
 * 3. DOM manipulation for dynamic UI updates
 * 4. Event handling for user interactions
 * 
 * =============================================================================
 */

// API base URL
const API_URL = '/api';

// Current filter state
let currentFilter = 'all';

// =========================================================================
// INITIALIZATION
// =========================================================================

/**
 * Initializes the application when the page loads
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Task Manager initializing...');

    // Set up event listeners
    setupEventListeners();

    // Initialize the database (create tasks table if not exists)
    await initializeDatabase();

    // Load and display tasks
    await loadTasks();

    console.log('✅ Task Manager ready!');
});

/**
 * Sets up all event listeners
 */
function setupEventListeners() {
    // Add task form
    const form = document.getElementById('task-form');
    form.addEventListener('submit', handleAddTask);

    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => handleFilterChange(btn));
    });

    // SQL console
    const executeBtn = document.getElementById('execute-sql');
    executeBtn.addEventListener('click', handleExecuteSQL);

    // Allow Ctrl+Enter to execute SQL
    const sqlInput = document.getElementById('sql-input');
    sqlInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            handleExecuteSQL();
        }
    });
}

// =========================================================================
// DATABASE OPERATIONS
// =========================================================================

/**
 * Initializes the database by creating the tasks table if it doesn't exist
 */
async function initializeDatabase() {
    try {
        // Check if tasks table exists
        const response = await fetch(`${API_URL}/tables`);
        const result = await response.json();

        if (!result.data.includes('tasks')) {
            // Create the tasks table
            console.log('📦 Creating tasks table...');

            await fetch(`${API_URL}/tables`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'tasks',
                    columns: [
                        { name: 'id', type: 'INT', primaryKey: true },
                        { name: 'title', type: 'TEXT', notNull: true },
                        { name: 'description', type: 'TEXT' },
                        { name: 'completed', type: 'BOOL' },
                        { name: 'created_at', type: 'INT' }
                    ]
                })
            });

            console.log('✅ Tasks table created');
        }
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        showError('Failed to connect to database');
    }
}

/**
 * Loads all tasks from the database
 */
async function loadTasks() {
    try {
        const response = await fetch(`${API_URL}/tables/tasks/rows`);
        const result = await response.json();

        if (result.success) {
            renderTasks(result.data);
            updateStats(result.data);
        } else {
            showError(result.error);
        }
    } catch (error) {
        console.error('❌ Failed to load tasks:', error);
        showError('Failed to load tasks');
    }
}

/**
 * Generates a simple unique ID
 * In a real app, this would be handled by the database (auto-increment)
 */
function generateId() {
    return Date.now();
}

// =========================================================================
// EVENT HANDLERS
// =========================================================================

/**
 * Handles adding a new task
 */
async function handleAddTask(event) {
    event.preventDefault();

    const titleInput = document.getElementById('task-title');
    const descInput = document.getElementById('task-description');

    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    if (!title) {
        alert('Please enter a task title');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/tables/tasks/rows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: generateId(),
                title: title,
                description: description || '',
                completed: false,
                created_at: Date.now()
            })
        });

        const result = await response.json();

        if (result.success) {
            // Clear form
            titleInput.value = '';
            descInput.value = '';

            // Reload tasks
            await loadTasks();
        } else {
            showError(result.error);
        }
    } catch (error) {
        console.error('❌ Failed to add task:', error);
        showError('Failed to add task');
    }
}

/**
 * Handles toggling a task's completed status
 */
async function handleToggleTask(id, currentStatus) {
    try {
        const response = await fetch(`${API_URL}/tables/tasks/rows`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                set: { completed: !currentStatus },
                where: { column: 'id', operator: '=', value: id }
            })
        });

        const result = await response.json();

        if (result.success) {
            await loadTasks();
        } else {
            showError(result.error);
        }
    } catch (error) {
        console.error('❌ Failed to toggle task:', error);
        showError('Failed to update task');
    }
}

/**
 * Handles deleting a task - shows custom confirmation modal
 */
async function handleDeleteTask(id) {
    showConfirmModal(
        'Delete Task?',
        'Are you sure you want to delete this task? This action cannot be undone.',
        async () => {
            try {
                const response = await fetch(`${API_URL}/tables/tasks/rows`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        where: { column: 'id', operator: '=', value: id }
                    })
                });

                const result = await response.json();

                if (result.success) {
                    await loadTasks();
                } else {
                    showError(result.error);
                }
            } catch (error) {
                console.error('❌ Failed to delete task:', error);
                showError('Failed to delete task');
            }
        }
    );
}

/**
 * Shows a custom confirmation modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {Function} onConfirm - Callback when confirmed
 */
function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const modalTitle = modal.querySelector('.modal-title');
    const modalMessage = modal.querySelector('.modal-message');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.add('active');

    // Handle cancel
    const handleCancel = () => {
        modal.classList.remove('active');
        cleanup();
    };

    // Handle confirm
    const handleConfirm = () => {
        modal.classList.remove('active');
        cleanup();
        onConfirm();
    };

    // Cleanup listeners
    const cleanup = () => {
        cancelBtn.removeEventListener('click', handleCancel);
        confirmBtn.removeEventListener('click', handleConfirm);
    };

    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);
}

/**
 * Handles filter button click
 */
function handleFilterChange(button) {
    // Update active state
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');

    // Update filter and re-render
    currentFilter = button.dataset.filter;
    loadTasks();
}

/**
 * Handles executing SQL from the console
 * Supports multiple statements separated by semicolons
 */
async function handleExecuteSQL() {
    const sqlInput = document.getElementById('sql-input');
    const sqlOutput = document.getElementById('sql-output');
    const sqlText = sqlInput.value.trim();

    if (!sqlText) {
        sqlOutput.innerHTML = '<span class="sql-error">Please enter a SQL query</span>';
        return;
    }

    // Split multiple statements by semicolon (but not inside quotes)
    const statements = splitSQLStatements(sqlText);
    
    if (statements.length === 0) {
        sqlOutput.innerHTML = '<span class="sql-error">Please enter a SQL query</span>';
        return;
    }

    let allOutput = '';
    let shouldReloadTasks = false;

    for (const sql of statements) {
        if (!sql.trim()) continue;

        try {
            // Show the command being executed
            allOutput += `<div class="sql-command">mysql&gt; ${escapeHtml(sql)}</div>`;

            const response = await fetch(`${API_URL}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql })
            });

            const result = await response.json();

            // Format the result in MySQL-style output
            allOutput += formatSQLResult(sql, result);
            allOutput += '<div class="sql-spacing"></div>';

            // Check if we need to reload tasks
            if (result.success && sql.toUpperCase().match(/^(INSERT|UPDATE|DELETE|CREATE|DROP)/)) {
                shouldReloadTasks = true;
            }

        } catch (error) {
            console.error('❌ SQL execution failed:', error);
            allOutput += `<span class="sql-error">ERROR: ${error.message}</span>`;
            allOutput += '<div class="sql-spacing"></div>';
        }
    }

    sqlOutput.innerHTML = allOutput;

    // Reload tasks if any data-modifying query was executed
    if (shouldReloadTasks) {
        await loadTasks();
    }
}

/**
 * Splits SQL text into individual statements
 * Handles semicolons inside quoted strings correctly
 */
function splitSQLStatements(sqlText) {
    const statements = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < sqlText.length; i++) {
        const char = sqlText[i];
        const prevChar = i > 0 ? sqlText[i - 1] : '';

        // Track quote state (ignore escaped quotes)
        if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }

        // Split on semicolon only if not inside quotes
        if (char === ';' && !inSingleQuote && !inDoubleQuote) {
            const stmt = current.trim();
            if (stmt) {
                statements.push(stmt);
            }
            current = '';
        } else {
            current += char;
        }
    }

    // Add the last statement if it doesn't end with semicolon
    const lastStmt = current.trim();
    if (lastStmt) {
        statements.push(lastStmt);
    }

    return statements;
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Formats SQL result in MySQL-style output
 */
function formatSQLResult(sql, result) {
    if (!result.success) {
        return `<span class="sql-error">ERROR: ${result.error}</span>`;
    }

    const command = sql.trim().split(/\s+/)[0].toUpperCase();
    let output = '';

    switch (command) {
        case 'SELECT':
        case 'SHOW':
            output = formatTableResult(result.data, result.message);
            break;

        case 'INSERT':
            output = formatSuccessMessage(`Query OK, 1 row affected`, result);
            break;

        case 'UPDATE':
            output = formatSuccessMessage(`Query OK, ${result.rowsAffected} row(s) affected`, result);
            break;

        case 'DELETE':
            output = formatSuccessMessage(`Query OK, ${result.rowsAffected} row(s) deleted`, result);
            break;

        case 'CREATE':
            if (sql.toUpperCase().includes('DATABASE')) {
                output = formatSuccessMessage(`Database created successfully`, result);
            } else {
                output = formatSuccessMessage(`Table created successfully`, result);
            }
            break;

        case 'DROP':
            if (sql.toUpperCase().includes('DATABASE')) {
                output = formatSuccessMessage(`Database dropped successfully`, result);
            } else {
                output = formatSuccessMessage(`Table dropped successfully`, result);
            }
            break;

        case 'USE':
            output = formatSuccessMessage(`Database changed`, result);
            break;

        default:
            output = formatSuccessMessage(result.message || 'Query executed successfully', result);
    }

    return output;
}

/**
 * Formats a table result (for SELECT/SHOW queries)
 */
function formatTableResult(data, message) {
    if (!data || data.length === 0) {
        return `<div class="sql-message">Empty set (0 rows)</div>`;
    }

    // Get column names from first row
    const columns = Object.keys(data[0]);

    // Calculate column widths
    const widths = {};
    columns.forEach(col => {
        widths[col] = col.length;
        data.forEach(row => {
            const val = formatCellValue(row[col]);
            widths[col] = Math.max(widths[col], val.length);
        });
    });

    // Build the table
    let table = '<div class="sql-table">';

    // Header separator
    const separator = '+' + columns.map(col => '-'.repeat(widths[col] + 2)).join('+') + '+';

    // Header row
    const headerRow = '|' + columns.map(col => ` ${col.padEnd(widths[col])} `).join('|') + '|';

    table += `<div class="sql-row sql-separator">${separator}</div>`;
    table += `<div class="sql-row sql-header">${headerRow}</div>`;
    table += `<div class="sql-row sql-separator">${separator}</div>`;

    // Data rows
    data.forEach(row => {
        const dataRow = '|' + columns.map(col => {
            const val = formatCellValue(row[col]);
            return ` ${val.padEnd(widths[col])} `;
        }).join('|') + '|';
        table += `<div class="sql-row">${dataRow}</div>`;
    });

    table += `<div class="sql-row sql-separator">${separator}</div>`;
    table += '</div>';

    // Row count
    table += `<div class="sql-message">${data.length} row(s) in set</div>`;

    return table;
}

/**
 * Formats a cell value for display
 */
function formatCellValue(value) {
    if (value === null || value === undefined) {
        return 'NULL';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    return String(value);
}

/**
 * Formats a success message
 */
function formatSuccessMessage(message, result) {
    return `<div class="sql-success">✓ ${message}</div>`;
}

// =========================================================================
// RENDERING
// =========================================================================

/**
 * Renders the task list
 */
function renderTasks(tasks) {
    const taskList = document.getElementById('task-list');

    // Filter tasks based on current filter
    let filteredTasks = tasks;
    if (currentFilter === 'completed') {
        filteredTasks = tasks.filter(t => t.completed);
    } else if (currentFilter === 'pending') {
        filteredTasks = tasks.filter(t => !t.completed);
    }

    // Sort by created_at (newest first)
    filteredTasks.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    if (filteredTasks.length === 0) {
        taskList.innerHTML = `
            <p class="empty-message">
                ${currentFilter === 'all' 
                    ? '📝 No tasks yet. Add one above!' 
                    : `No ${currentFilter} tasks.`}
            </p>
        `;
        return;
    }

    taskList.innerHTML = filteredTasks.map(task => `
        <div class="task-item ${task.completed ? 'completed' : ''}">
            <div class="task-checkbox">
                <input 
                    type="checkbox" 
                    ${task.completed ? 'checked' : ''}
                    onchange="handleToggleTask(${task.id}, ${task.completed})"
                >
            </div>
            <div class="task-content">
                <h3 class="task-title">${escapeHtml(task.title)}</h3>
                ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
                <span class="task-date">
                    ${task.created_at ? formatDate(task.created_at) : ''}
                </span>
            </div>
            <div class="task-actions">
                <button 
                    class="btn btn-danger btn-small"
                    onclick="handleDeleteTask(${task.id})"
                >
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Updates the statistics display
 */
function updateStats(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;

    document.getElementById('stats-total').textContent = `${total} total`;
    document.getElementById('stats-completed').textContent = `${completed} completed`;
    document.getElementById('stats-pending').textContent = `${pending} pending`;
}

/**
 * Shows an error message
 */
function showError(message) {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = `
        <p class="error-message">❌ ${escapeHtml(message)}</p>
    `;
}

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================

/**
 * Escapes HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Formats a timestamp to a readable date
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
