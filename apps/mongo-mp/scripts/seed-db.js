// mongoclinet
import { MongoClient } from 'mongodb';
import { hash } from 'bcrypt'
import * as dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env', import.meta.url) })

async function seed() {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db("mongomp");
    
    // Load songs from JSON
    let songs = JSON.parse(await import('fs/promises').then(fs => 
      fs.readFile(new URL('../app/data/mongomp.songs-pop.json', import.meta.url), 'utf8')
    ));
     
    await db.collection("songs").deleteMany({});
    await db.collection("songs").insertMany(songs);
    console.log(`Successfully inserted ${songs.length} songs`);
    songs = JSON.parse(await import('fs/promises').then(fs => 
      fs.readFile(new URL('../app/data/mongomp.songs-comedy.json', import.meta.url), 'utf8')
    ));
    await db.collection("songs").insertMany(songs);
    await createSearchIndex(client);
    await createVectorIndex(client);
    console.log(`Successfully inserted ${songs.length} songs`);

    await seedUsers();
  } catch (e) {
    console.error('Failed to seed database:', e);
  } finally {
    process.exit();
  }
}

async function seedUsers() {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db("mongomp");

    // Clear existing users
    await db.collection("users").deleteMany({});

    // Load users from JSON

    let users = JSON.parse(await import('fs/promises').then(fs => 
      fs.readFile(new URL('../app/data/users.json', import.meta.url), 'utf8')
    ));

    // Hash passwords
    const usersWithHashedPasswords = await Promise.all(users.map(async (user) => ({
      ...user,
      password: await hash(user.password, 10)
    })));

    const result = await db.collection("users").insertMany(usersWithHashedPasswords);

    console.log(`Successfully inserted ${result.insertedCount} users`);
  } catch (e) {
    console.error('Failed to seed users:', e);
  }
}

async function createSearchIndex(client) {
  try {
    const db = client.db("mongomp");
    
    await db.collection("songs").dropIndexes();
    await db.command({
      createSearchIndexes: "songs",
      indexes: [{
        name: "default",
        definition: {
          mappings: {
            dynamic: true
          }
        }
      }]
    });
    
    console.log("Successfully created Atlas Search index");
  } catch (e) {
    console.error('Failed to create search index:', e);
  }
}


async function createVectorIndex(client) {
  try {
    const db = client.db("mongomp");
    await db.command({
      createSearchIndexes: "songs",
      indexes: [{
        name: "vector_index",
        type: "vectorSearch",
        definition: {
          "fields": [
            {
              "type": "vector",
              "numDimensions": 2048,
              "path": "music_embeddings",
              "similarity": "euclidean"
            }
          ]
        }
    }]
    });
    console.log("Successfully created vector search index");
  } catch (e) {
    console.error('Failed to create vector index:', e);
  }
}

seed();
