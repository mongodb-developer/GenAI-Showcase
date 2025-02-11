# Voice Grocery Assistant

![Voice RT UI](./voice-assistant-ui.png)
## Summary

The Voice Grocery Assistant is an innovative demo application that showcases the power of voice-controlled e-commerce. It allows users to shop for groceries using natural language voice commands, providing a hands-free and intuitive shopping experience.

## The Idea

This demo application was created to explore and demonstrate the potential of combining voice recognition technology with e-commerce functionality. The main goals are:

1. To provide a seamless voice-controlled shopping experience
2. To showcase how AI can understand and process natural language in a shopping context
3. To demonstrate real-time voice-to-text and text-to-voice capabilities
4. To explore the integration of voice commands with typical e-commerce actions like searching for products, adding items to a cart, and placing orders

## Tech Stack

- **Frontend Framework**: Next.js (React)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Voice Processing**: WebRTC for real-time audio streaming
- **AI Integration**: OpenAI API for natural language processing
- **Database**: MongoDB for product and order storage
- **Search** : The Application uses MongoDB Hybrid search solution.
- **API Routes**: Next.js API routes for backend functionality
- **State Management**: React hooks (useState, useEffect, useCallback)
- **Authentication**: (Not implemented in this demo, but could be added using NextAuth.js)

## Atlas Creation

To set up MongoDB Atlas for this project:

1. Visit [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create an account
2. Create a new project
3. Build a database (use 7.0+):
   - Choose the FREE tier
   - Select your preferred provider and region
   - Pick a cluster name
   - Click "Create"
4. Configure security:
   - Create a database user with read/write permissions
   - Add your IP address to the network access list
5. Get your connection string from the "Connect" button
   - Select "Drivers"
   - Copy the connection string
   - Replace `<password>` with your database user's password


## Configuration

Before running the application, create a .env file in the project root with the following variables. Set MONGODB_URI to your MongoDB connection string (for example, mongodb+srv://username:password@cluster.example.com), and set OPENAI_API_KEY to your OpenAI API key:
```
   MONGODB_URI=your_mongodb_connection_string
   OPENAI_API_KEY=your_openai_api_key
```

## Installation

To get started with the Voice Grocery Assistant:

1. Clone the repository:
   ```bash
   git clone https://github.com/mongodb-developer/GenAI-Showcase
   cd GenAI-Showcase/apps/RT-voice-ts-store-agent
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Run the following script to seed the database with products and its vectorized embeddings for semantic search/full text search.
   ```
   npm run seed
   ```
3. Build and run the application:
   ```bash
   npm run dev
   ```


## Usage

1. Ensure your microphone is enabled and configured.
2. Launch the application and follow the on-screen instructions.
3. Use voice commands to search for products, add items to your cart, and complete your purchase.

## Contributing

Contributions are welcome. Please open issues or submit pull requests to suggest improvements or add new features.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
