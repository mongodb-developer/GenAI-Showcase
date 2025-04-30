# Model Context Protocol (MCP) Servers

This directory provides information about the **Official MongoDB MCP Server** and various **Community MCP Servers**. These servers extend AI capabilities by providing tools and resources for interacting with MongoDB databases, MongoDB Atlas, and other external systems.

## Official MongoDB MCP Server

The official server provides comprehensive tools for interacting with both MongoDB databases and MongoDB Atlas management APIs.

| Repository | Description | Features/Tools | Use Case | Integration tools |
|------------|-------------|----------------|-------------|-------------|
| [mongodb-js/mongodb-mcp-server](https://github.com/mongodb-js/mongodb-mcp-server) | Official MCP server to connect to MongoDB databases and MongoDB Atlas Clusters. | **Atlas Tools:**<br>• `atlas-list-orgs`<br>• `atlas-list-projects`<br>• `atlas-create-project`<br>• `atlas-list-clusters`<br>• `atlas-inspect-cluster`<br>• `atlas-create-free-cluster`<br>• `atlas-connect-cluster`<br>• `atlas-inspect-access-list`<br>• `atlas-create-access-list`<br>• `atlas-list-db-users`<br>• `atlas-create-db-user`<br><br>**Database Tools:**<br>• `connect`<br>• `find`<br>• `aggregate`<br>• `count`<br>• `insert-one`/`many`<br>• `update-one`/`many`<br>• `delete-one`/`many`<br>• `create-index`<br>• `rename-collection`<br>• `drop-collection`/`database`<br>• `list-databases`/`collections`<br>• `collection-indexes`/`schema`/`storage-size`<br>• `db-stats` | Manage Atlas resources (orgs, projects, clusters, users, access) and interact with databases (CRUD, aggregations, schema inspection, etc.) directly from AI assistants. | **VSCode (Cline)**:<br>Add to `settings.json` or workspace settings.<br><br>**Claude Desktop**:<br>Add to `claude_desktop_config.json`.<br><br>*(See official repo README for detailed setup)* |

## Community MCP Servers

These servers are developed by the community and may offer specialized functionality.

| Repository | Description | Features/Tools | Use Case | Integration tools |
|------------|-------------|----------------|-------------|-------------|
| [mongodb-developer/mcp-mongodb-atlas](https://github.com/mongodb-developer/mcp-mongodb-atlas) | (Community) An MCP server focused *specifically* on managing MongoDB Atlas projects via the Atlas Admin API. | • `create_atlas_cluster`<br>• `setup_atlas_network_access`<br>• `create_atlas_user`<br>• `get_atlas_connection_strings`<br>• `list_atlas_projects`<br>• `list_atlas_clusters` | Create and manage MongoDB Atlas resources from AI assistants (focused on Atlas Admin API). | **VSCode (Cline)**:<br>Add to `cline_mcp_settings.json`<br><br>**Cursor**:<br>Add to MCP settings or `~/.cursor/mcp.json`<br><br>**Claude Desktop**:<br>Add to `claude_desktop_config.json` |
| [mongodb-developer/mongodb-mcp-server](https://github.com/mongodb-developer/mongodb-mcp-server) | (Community) An MCP server providing read-only access to MongoDB databases for inspection and aggregation. | • `aggregate`<br>• `explain`<br>• Resource: Collection Schemas (`mongodb://<host>/<collection>/schema`) | Inspect schemas and run read-only aggregations from AI assistants. | **Claude Desktop**:<br>Add to `claude_desktop_config.json` (see repo README for details) |

## Usage Examples

### Official MongoDB MCP Server (`mongodb-js/mongodb-mcp-server`)

This server can be configured via environment variables or command-line arguments. See the [official repository README](https://github.com/mongodb-js/mongodb-mcp-server) for full details on options like `apiClientId`, `apiClientSecret`, `connectionString`, `disabledTools`, `readOnly`, etc.

#### Command Line Usage
```bash
# Basic usage (will prompt if connection needed and not configured)
npx -y mongodb-mcp-server

# With Atlas API credentials via environment variables
export MDB_MCP_API_CLIENT_ID="your-atlas-client-id"
export MDB_MCP_API_CLIENT_SECRET="your-atlas-client-secret"
npx -y mongodb-mcp-server

# With a default connection string via environment variable
export MDB_MCP_CONNECTION_STRING="mongodb+srv://user:pass@cluster..."
npx -y mongodb-mcp-server

# Using command-line arguments
npx -y mongodb-mcp-server --apiClientId="id" --apiClientSecret="secret" --connectionString="mongodb+srv://..." --readOnly
```

#### Configuration Example (VSCode - Cline/settings.json)
Add to your user or workspace `settings.json` under `"mcp.servers"`:
```json
{
  "mcp.servers": {
    "MongoDB-Official": { // Choose a descriptive key
      "type": "stdio", // Assuming stdio type based on official docs example
      "command": "npx",
      "args": [
          "-y",
          "mongodb-mcp-server"
          // Add command-line args here if needed, e.g., "--readOnly"
      ],
      "env": {
        // Set environment variables here if preferred over args
        // "MDB_MCP_API_CLIENT_ID": "your-atlas-client-id",
        // "MDB_MCP_API_CLIENT_SECRET": "your-atlas-client-secret",
        // "MDB_MCP_CONNECTION_STRING": "mongodb+srv://..."
      },
      "disabled": false,
      "autoApprove": [] // Configure auto-approval if desired
    }
  }
}
```
*(Refer to the official server's README for detailed configuration options)*

#### Configuration Example (Claude Desktop)
Add the following to the `mcpServers` section in `claude_desktop_config.json`:
```json
{
  "MongoDB-Official": { // Choose a descriptive key
    "command": "npx",
    "args": [
      "-y", 
      "mongodb-mcp-server"
      // Add command-line args here if needed, e.g., "--readOnly"
      ],
    "env": {
      // Set environment variables here if preferred over args
      // "MDB_MCP_API_CLIENT_ID": "your-atlas-client-id",
      // "MDB_MCP_API_CLIENT_SECRET": "your-atlas-client-secret",
      // "MDB_MCP_CONNECTION_STRING": "mongodb+srv://..."
    },
    "disabled": false,
    "autoApprove": [] // Configure auto-approval if desired
  }
}
```
*(Refer to the official server's README for detailed configuration options)*


---
*(Note: Examples below refer to the specific **community** servers mentioned)*

### Community: MongoDB Atlas MCP Server (Admin API Focused)

#### Command Line Usage
```bash
# Using environment variables
export ATLAS_PUBLIC_KEY="your-public-key"
export ATLAS_PRIVATE_KEY="your-private-key"
npx mcp-mongodb-atlas

# Or passing keys as arguments
npx mcp-mongodb-atlas "your-public-key" "your-private-key"
```

#### Configuration Example (Cline VSCode Extension)
```json
{
  "mcpServers": {
    "atlas-community": { // Renamed key for clarity
      "command": "npx",
      "args": ["mcp-mongodb-atlas"],
      "env": {
        "ATLAS_PUBLIC_KEY": "your-public-key",
        "ATLAS_PRIVATE_KEY": "your-private-key"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Community: MongoDB MCP Server (Read-Only DB Interaction)

#### Command Line Usage
```bash
# Set the MongoDB connection string environment variable
export MONGODB_URI="mongodb+srv://<user>:<password>@<your-cluster-url>/<database>?retryWrites=true&w=majority"
npx -y @pash1986/mcp-server-mongodb

# Or pass the URI as an argument (ensure proper quoting)
npx -y @pash1986/mcp-server-mongodb "mongodb+srv://<user>:<password>@<your-cluster-url>/<database>?retryWrites=true&w=majority"
```

#### Configuration Example (Claude Desktop)
Add the following to the `mcpServers` section in `claude_desktop_config.json`:
```json
{
  "mongodb-community-readonly": { // Renamed key for clarity
    "command": "npx",
    "args": [
      "-y",
      "@pash1986/mcp-server-mongodb"
    ],
    "env": {
      "MONGODB_URI": "mongodb+srv://<user>:<password>@<your-cluster-url>/<database>?retryWrites=true&w=majority"
    },
    "disabled": false,
    "autoApprove": []
  }
}
```
*Replace `<user>`, `<password>`, `<your-cluster-url>`, and `<database>` with your actual credentials and database name.*

#### Configuration Example (Cursor)
Add the following to your MCP settings or `~/.cursor/mcp.json`:
```json
{
  "mongodb-community-readonly": { // Renamed key for clarity
    "command": "npx",
    "args": [
      "-y",
      "@pash1986/mcp-server-mongodb"
    ],
    "env": {
      "MONGODB_URI": "mongodb+srv://<user>:<password>@<your-cluster-url>/<database>?retryWrites=true&w=majority"
    },
    "disabled": false,
    "autoApprove": []
  }
}
```
*Replace `<user>`, `<password>`, `<your-cluster-url>`, and `<database>` with your actual credentials and database name.*


## Getting Started

To use an MCP server:

1.  **Choose a server:** Decide whether you need the Official server (broad Atlas & DB interaction) or a specific Community server.
2.  **Follow Installation/Setup:** Refer to the specific server's repository (`README.md`) for detailed installation and configuration instructions (API keys, connection strings, etc.). The official server's README is particularly detailed.
3.  **Configure Client:** Add the server configuration to your AI assistant (VSCode, Claude Desktop, Cursor) as shown in the examples or the server's documentation.
4.  **Restart Client:** Restart your AI assistant to connect to the newly configured MCP server.

## Contributing

If you've developed a **Community** MCP server that you'd like to add to this list, please submit a pull request with your server's information added to the "Community MCP Servers" table above. For contributions to the **Official** server, please refer to its repository's contributing guidelines.
