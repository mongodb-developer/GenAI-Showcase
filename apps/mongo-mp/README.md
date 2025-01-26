# MongoMP - MongoDB Music Platform

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

MongoMP is a cutting-edge music streaming platform that leverages the power of MongoDB and Next.js to provide a personalized and immersive listening experience.

## Features

- 🎵 Extensive music library with various genres
- 🤖 AI-powered song recommendations using MongoDB's vector search
   - This approach enables the system to identify songs with similar musical characteristics by comparing their vector embeddings to the user's centroid vector, leading to more accurate and personalized recommendations. [Learn more about centroid calculation](#centroid-calculation).
- 🔍 Advanced search functionality
- 📊 Real-time play count and last played tracking
- 📱 Responsive design for seamless use across devices
- 🎨 Customizable user profiles
- 📜 Playlist creation and management
- 🔐 Secure user authentication with JWT

## Tech Stack

- **Frontend**: Next.js 14 with App Router
- **Backend**: Node.js with Next.js API Routes
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Styling**: Tailwind CSS and shadcn/ui components


## centroid-calculation

The centroid calculation mechanism works by automatically computing and updating a user's musical taste profile based on their liked songs. Here's how it works:

### Overview
When a user likes or unlikes songs (updating their `likes` array), a MongoDB Trigger automatically calculates the centroid (average) of the musical embeddings for all liked songs.

### Technical Implementation
1. **Trigger Activation**: Monitors changes to user documents' `likes` array
2. **Data Processing Pipeline**:
   - Matches all liked songs in the songs collection
   - Unwinds the musical embeddings arrays
   - Groups and averages embeddings by dimension
   - Sorts to maintain dimensional order
   - Combines into a single centroid vector

### Code Example
```javascript
exports = async function(changeEvent) {
  const docId = changeEvent.documentKey._id;
  const serviceName = "<CLUSTER_NAME>";
  const db = context.services.get(serviceName).db("mongomp");
  const usersCollection = db.collection("users");
  const songsCollection = db.collection("songs");
  
  try {
    // Get the updated user document
    const userDoc = changeEvent.fullDocument;
    
    if (!userDoc.likes || userDoc.likes.length === 0) {
      console.log("No likes found for user:", docId);
      return;
    }

    const pipeline = [
      // Match liked songs
      {
        $match: {
          _id: { $in: userDoc.likes }
        }
      },
      // Unwind the embeddings array to work with individual elements
      {
        $unwind: {
          path: "$music_embeddings",
          includeArrayIndex: "dimension_index"
        }
      },
      // Group by dimension index to calculate averages
      {
        $group: {
          _id: "$dimension_index",
          avg_value: { $avg: "$music_embeddings" }
        }
      },
      // Sort by dimension index to maintain order
      {
        $sort: {
          _id: 1
        }
      },
      // Project to get just the averaged values in array form
      {
        $group: {
          _id: null,
          liked_embeddings: {
            $push: "$avg_value"
          }
        }
      }
    ];

    const aggregationResult = await songsCollection.aggregate(pipeline).toArray();
    
    if (!aggregationResult || aggregationResult.length === 0) {
      console.log("No embeddings calculated");
      return;
    }

    // Update user document with averaged embeddings
    const updateResult = await usersCollection.updateOne(
      { _id: docId },
      {
        $set: {
          liked_embeddings: aggregationResult[0].liked_embeddings
        }
      }
    );

    console.log("Updated user embeddings:", {
      userId: docId,
      numberOfLikes: userDoc.likes.length,
      embeddingsDimensions: aggregationResult[0].liked_embeddings.length,
      updateResult: updateResult
    });

  } catch (err) {
    console.log("Error processing embeddings:", err.message);
    console.log("Full error:", JSON.stringify(err));
  }
};
```

The resulting centroid vector becomes the user's musical taste profile, stored in `liked_embeddings`, enabling personalized song recommendations through vector similarity search.

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- MongoDB (v4.4 or later)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository_url>
   ```

2. Navigate to the project directory:
   ```bash
   cd mongo-mp
   ```

3. Install dependencies:
   ```bash
   npm install
   ```
   or
   ```bash
   yarn install
   ```

### Setting up the Database

1. Ensure your MongoDB instance is running and accessible.

2. Create a `.env.local` file in the root directory of the project and add your MongoDB connection string:
  ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```

3. Run the database seeding script to populate your database with sample data and create indexes:
   ```bash
   npm run seed
   ```
   or
   ```bash
   yarn seed
   ```
   This script is located in `scripts/seed-db.js` and will create sample users, songs, and  needed indexes.


### Running the Application

1. Start the development server:
   ```
   npm run dev
   ```
   or
   ```bash
   yarn dev
   ```

2. Your application should now be running on `http://localhost:3000`


## Installation and Deployment

### Building Locally

1. After following the installation steps, build the project:
   ```
   npm run build
   ```
  

2. Start the production server:
   ```
   npm start
   ```

3. Your application should now be running on `http://localhost:3000`

### Deployment

MongoMP can be easily deployed to Vercel:

1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com) and sign up or log in.
3. Click on "New Project" and import your GitHub repository.
4. Configure your environment variables (MONGODB_URI and JWT_SECRET).
5. Click "Deploy" and wait for the build to complete.

Your MongoMP instance will now be live on a Vercel URL!

## Project Structure

Here's an overview of the MongoMP project structure:

```
mongo-mp/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   ├── logout/
│   │   │   ├── register/
│   │   │   └── user/
│   │   ├── playlists/
│   │   ├── songs/
│   │   └── user/
│   ├── admin/
│   │   └── users/
│   ├── library/
│   ├── login/
│   ├── profile/
│   ├── register/
│   ├── search/
│   ├── home-content.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   ├── bottom-nav.tsx
│   ├── code-block.tsx
│   ├── info-tooltip.tsx
│   ├── library-content.tsx
│   ├── navbar.tsx
│   ├── notification.tsx
│   ├── playing-song-popup.tsx
│   ├── playlist-player.tsx
│   ├── RetroEqualizer.tsx
│   ├── search-bar.tsx
│   ├── song-card.tsx
│   ├── song-list.tsx
│   ├── suggested-songs.tsx
│   ├── tag.tsx
│   └── user-menu.tsx
├── contexts/
│   └── UserContext.tsx
├── hooks/
│   ├── useAudio.ts
│   └── useUser.ts
├── lib/
│   ├── mock-data.ts
│   ├── mock-users.ts
│   ├── mongodb.ts
│   └── utils.ts
├── public/
│   └── placeholder.svg
├── scripts/
│   └── seed-db.js
├── types/
│   ├── playlist.ts
│   └── song.ts
├── .env.local
├── .gitignore
├── next.config.js
├── package.json
├── README.md
├── tailwind.config.js
└── tsconfig.json
```

This structure shows the main directories and files in the MongoMP project. The `app/` directory contains the Next.js 14 App Router structure, with API routes and page components. The `components/` directory holds reusable React components, and `lib/` contains utility functions and database connection logic.

