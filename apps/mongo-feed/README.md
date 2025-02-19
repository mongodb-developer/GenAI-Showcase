# MongoFeed

MongoFeed is a comprehensive platform for product feedback analysis and sentiment tracking. It leverages MongoDB for data storage and Amazon Bedrock for AI-powered sentiment analysis, providing valuable insights into customer feedback and product reviews.

> ♥️ Inpired by a customer success story : [Syncly](https://www.mongodb.com/customers/syncly)

## Hosted Version

https://mongo-feed.vercel.app

## Features

- File upload for product feedback analysis (JSON, HTML, images)
- Chat paste functionality for direct input of customer interactions
- Sentiment analysis using Amazon Bedrock AI
- Real-time processing queue for feedback analysis
- Interactive charts and visualizations:
  - Feedback trends over time
  - Sentiment distribution
  - Top issues identification
- Agent performance tracking and sentiment analysis

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or later)
- npm (v6 or later)
- MongoDB (6.0+)
- An AWS account with access to Amazon Bedrock and Claude 3.5 V2 model

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd mongo-feed
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   - Create a `.env.local` file in the root directory.
   - Add your MongoDB connection string and AWS Bedrock credentials.
     ```env
     MONGODB_URI=your_mongodb_connection_string
     AWS_REGION=your_aws_region
     AWS_ACCESS_KEY_ID=your_aws_access_key_id
     AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
     ```
     **Note:** Ensure you have the necessary permissions for Amazon Bedrock and MongoDB.

## Development

1. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## Building for Production

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start the production server:**
   ```bash
   npm run start
   ```

## Usage

To use MongoFeed:

1. **Access the application** in your browser at [http://localhost:3000](http://localhost:3000) after running the development or production server.
2. **Upload Feedback Files or Paste Chat Interactions:**
   - Navigate to the feedback input section.
   - Choose to upload files (JSON, HTML, images) or paste text from chat interactions.
   - Follow the on-screen instructions to input your feedback data.
3. **View Sentiment Analysis Results and Visualizations:**
   - Once the feedback is processed, navigate to the dashboard.
   - Explore interactive charts and visualizations to understand:
     - Feedback trends over time
     - Sentiment distribution across feedback
     - Top issues identified from the feedback
4. **Navigate the Dashboard:**
   - Use the dashboard to access different features, such as:
     - Real-time processing queue monitoring.
     - Agent performance tracking and sentiment analysis (if applicable).
     - Detailed views of individual feedback entries and their sentiment analysis.

## Configuration

- **Environment Variables:**
  - `MONGODB_URI`: MongoDB connection string for your MongoDB database.
  - `AWS_REGION`: AWS region where your Bedrock service is configured.
  - `AWS_ACCESS_KEY_ID`: AWS access key ID for authentication.
  - `AWS_SECRET_ACCESS_KEY`: AWS secret access key for authentication.

- **Other configurations:**
  - The application may have additional configurations that can be set in the `.env.local` file or through the application's settings panel. Refer to the application documentation for advanced configuration options.

## Contributing

If you'd like to contribute to MongoFeed, please follow these guidelines:
1. Fork the repository.
2. Create a branch for your feature or bug fix.
3. Ensure your code adheres to the project's coding standards.
4. Submit a pull request with a clear description of your changes.

## License

[Specify the project license, e.g., MIT License]
