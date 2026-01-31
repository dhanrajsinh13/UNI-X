/**
 * Social Graph Initialization Script
 * 
 * Run this script to initialize the social graph indexes in MongoDB.
 * 
 * Usage: node scripts/init-social-graph.js
 */

const { MongoClient } = require('mongodb')

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || ''
const DB_NAME = process.env.MONGODB_DB_NAME || 'unix'

// Collection names
const GraphCollections = {
    GRAPH_EDGES: 'graph_edges',
    USER_GRAPH_CACHE: 'user_graph_cache',
}

async function initializeSocialGraph() {
    console.log('🚀 Initializing Social Graph...\n')

    if (!MONGODB_URI) {
        console.error('❌ Error: MONGODB_URI environment variable is not set')
        process.exit(1)
    }

    let client

    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...')
        client = await MongoClient.connect(MONGODB_URI, {
            maxPoolSize: 5,
            serverSelectionTimeoutMS: 30000,
        })

        const db = client.db(DB_NAME)
        console.log(`✅ Connected to database: ${DB_NAME}\n`)

        // Create graph_edges collection and indexes
        console.log('Creating graph_edges indexes...')
        const edgesCollection = db.collection(GraphCollections.GRAPH_EDGES)

        // Unique compound index for relationship lookups
        await edgesCollection.createIndex(
            { sourceUserId: 1, targetUserId: 1 },
            { unique: true, name: 'idx_source_target_unique' }
        )
        console.log('  ✓ Created unique index: sourceUserId + targetUserId')

        // Index for fetching all users someone follows
        await edgesCollection.createIndex(
            { sourceUserId: 1 },
            { name: 'idx_source' }
        )
        console.log('  ✓ Created index: sourceUserId')

        // Index for fetching all followers of a user
        await edgesCollection.createIndex(
            { targetUserId: 1 },
            { name: 'idx_target' }
        )
        console.log('  ✓ Created index: targetUserId')

        // Index for sorting by interaction weight
        await edgesCollection.createIndex(
            { sourceUserId: 1, interactionWeight: -1 },
            { name: 'idx_source_weight' }
        )
        console.log('  ✓ Created index: sourceUserId + interactionWeight')

        // Index for time-based queries
        await edgesCollection.createIndex(
            { lastInteractionTimestamp: -1 },
            { name: 'idx_last_interaction' }
        )
        console.log('  ✓ Created index: lastInteractionTimestamp')

        // Index for created_at queries
        await edgesCollection.createIndex(
            { createdAt: -1 },
            { name: 'idx_created' }
        )
        console.log('  ✓ Created index: createdAt\n')

        // Verify indexes
        const indexes = await edgesCollection.indexes()
        console.log(`📊 Total indexes on graph_edges: ${indexes.length}`)
        indexes.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`)
        })

        console.log('\n✅ Social Graph initialization complete!')
        console.log('\nAvailable API Endpoints:')
        console.log('  POST   /api/graph/follow      - Follow a user')
        console.log('  DELETE /api/graph/follow      - Unfollow a user')
        console.log('  GET    /api/graph/followers   - Get followers list')
        console.log('  GET    /api/graph/following   - Get following list')
        console.log('  GET    /api/graph/relationship- Check relationship strength')
        console.log('  GET    /api/graph/mutual      - Get mutual connections')
        console.log('  GET    /api/graph/suggestions - Get user suggestions')
        console.log('  POST   /api/graph/interaction - Record an interaction')
        console.log('  GET    /api/graph/stats       - Get graph statistics')

    } catch (error) {
        console.error('❌ Error initializing social graph:', error)
        process.exit(1)
    } finally {
        if (client) {
            await client.close()
            console.log('\n🔌 MongoDB connection closed')
        }
    }
}

// Run the initialization
initializeSocialGraph()
