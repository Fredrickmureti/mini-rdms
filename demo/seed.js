/**
 * =============================================================================
 * DATABASE SEEDER
 * =============================================================================
 * 
 * This script populates the database with sample data for the demo.
 * It's useful for testing and demonstrating the application.
 * 
 * USAGE:
 * ------
 * $ node demo/seed.js
 * 
 * Or as part of the demo command:
 * $ npm run demo
 * 
 * =============================================================================
 */

const Database = require('../src/database');
const QueryEngine = require('../src/engine/QueryEngine');

/**
 * Sample tasks to seed the database
 */
const sampleTasks = [
    {
        id: 1,
        title: 'Learn about database tables',
        description: 'Understand how tables store data in rows and columns',
        completed: true,
        created_at: Date.now() - 86400000 * 3 // 3 days ago
    },
    {
        id: 2,
        title: 'Understand primary keys',
        description: 'Primary keys uniquely identify each row in a table',
        completed: true,
        created_at: Date.now() - 86400000 * 2 // 2 days ago
    },
    {
        id: 3,
        title: 'Practice SQL SELECT queries',
        description: 'Learn how to retrieve data from tables using SELECT',
        completed: false,
        created_at: Date.now() - 86400000 // 1 day ago
    },
    {
        id: 4,
        title: 'Explore INSERT operations',
        description: 'Add new rows to tables using INSERT INTO',
        completed: false,
        created_at: Date.now() - 3600000 // 1 hour ago
    },
    {
        id: 5,
        title: 'Try UPDATE and DELETE',
        description: 'Modify and remove data using UPDATE and DELETE queries',
        completed: false,
        created_at: Date.now()
    }
];

/**
 * Seeds the database with sample data
 */
async function seedDatabase() {
    console.log('🌱 Starting database seeding...\n');

    const db = new Database('demo_db');
    const engine = new QueryEngine(db);

    // Step 1: Create the tasks table
    console.log('📦 Creating tasks table...');
    
    const createResult = engine.execute(`
        CREATE TABLE tasks (
            id INT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            completed BOOL,
            created_at INT
        )
    `);

    if (createResult.success) {
        console.log('   ✓ Tasks table created\n');
    } else {
        console.log(`   ✗ ${createResult.error}\n`);
        return;
    }

    // Step 2: Insert sample tasks
    console.log('📝 Inserting sample tasks...');
    
    for (const task of sampleTasks) {
        const insertSQL = `
            INSERT INTO tasks (id, title, description, completed, created_at) 
            VALUES (
                ${task.id}, 
                '${task.title}', 
                '${task.description}', 
                ${task.completed}, 
                ${task.created_at}
            )
        `;
        
        const result = engine.execute(insertSQL);
        
        if (result.success) {
            console.log(`   ✓ Added: "${task.title}"`);
        } else {
            console.log(`   ✗ Failed: "${task.title}" - ${result.error}`);
        }
    }

    // Step 3: Display final state
    console.log('\n📊 Final database state:');
    
    const selectResult = engine.execute('SELECT * FROM tasks');
    
    if (selectResult.success) {
        console.log(`   Total tasks: ${selectResult.data.length}`);
        console.log(`   Completed: ${selectResult.data.filter(t => t.completed).length}`);
        console.log(`   Pending: ${selectResult.data.filter(t => !t.completed).length}`);
    }

    console.log('\n✅ Database seeding complete!\n');
    console.log('Run "npm run server" to start the web application.\n');
}

// Run the seeder
seedDatabase().catch(console.error);
