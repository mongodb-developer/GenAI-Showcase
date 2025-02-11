# kg_graph__rag_mongo
This guide explores how to leverage MongoDB's capabilities to create and manipulate graph representations using both Python and Node.js. By utilizing these two popular programming languages, we can demonstrate the versatility of MongoDB in different development environments, showcasing how to perform essential Graph RAG to represent and analyze graphs can provide valuable insights into complex relationships and interactions within data combining the Graph and RAG data in MongoDB.


## Prep Steps
1. Set Up Your MongoDB Database:

    Set up a Atlas a [cloud-based MongoDB instance of MongoDB.](https://www.mongodb.com/docs/atlas/tutorial/create-new-cluster/)

2. Install Required Libraries:
    For Python:
    Please do a regular installation of Anaconda for your Operating System using the [doc](https://docs.conda.io/projects/conda/en/latest/user-guide/install/index.html)
    Once conda is installed, open up a shell with the Conda CLI, change to this directory and create a new environment with the packages listed in the requirements.txt by executing the following statement:

 ```bash
    conda env create -f environment.yaml
    conda activate kg-demo
```
    For Node.js:
    For the Node JS files we have a package.json and you will be able to use npm install to install all the packages needed. Our Code was tested on Node version v20.15.0 and npm version 10.7.0

3.  Now open the .env file in the directory and populate the following three variables. Please note that the .env file may  be empty when you clone this repository
    OPENAI_API_KEY1=
    ATLAS_CONNECTION_STRING=
    PDF =

4. Create the MongoDB Atlas Database:
    Please note that ATLAS_CONNECTION_STRING and OPENAI_API_KEY1 should already be created in the environment file.
    Please create a new MongoDB Atlas database called <code>langchain_db</code>
    Create two collections named <code>knowledge_graph</code> and <code>nodes_relationships</code>

5. Download and install **MongoDB Compass** for your platform by following the steps mentioned [here](https://www.mongodb.com/docs/compass/current/install/). Please ensure you install a compass version 1.40.0 or higher. Once installed, connect to your Atlas cluster by following the link [here](https://www.mongodb.com/docs/compass/current/connect/).

6. Create vector index on the Compass UI for the <code>embedding</code> field for <code>knowledge_graph</code> collection. [Please refer to this document](https://www.mongodb.com/docs/compass/current/indexes/create-vector-search-index/). You can use the following json document for the index defination. Please name the vector index as <code>vector_index</code>
    Sample:
    ```json
    {
        "fields": [ {
            "type": "vector",
            "path": "embedding",
            "numDimensions": 1536,
            "similarity": "euclidean"
        } ]
    }
    ```
    After this create an Atlas Search Index on the <code>knowledge_graph</code> collection. [Please refer this document](https://www.mongodb.com/docs/compass/current/indexes/create-search-index/). Please name the Atlas Search Index as <code>default</code>




## Running the application

### If running for the first time
We have to setup the data in the collection. Please perform the following steps:

1. Open an Anaconda Shell and navigate to the project directory.
2. Activate the kg-demo environment by issuing the below commands:
```bash
conda activate kg-demo
```
3. Run the <code>data_insert.py file</code> by issuing the following command:
```bash
python data_insert.py
```
4. Now open a OS shell which should have `node` installed. Navigate to the project directory and issue the following commands in the same order:
```bash
node addEmbeddings.js
```
**Please note that if the above command does not end after 10-15 seconds, please terminate it using Ctrl+C**
And then
```bash
node addTags.js
```
5. Now return to the Anaconda shell opened in Step 1 where you should already be there in the project directory and in the kg-demo environment and run the following command:
```bash
python driver_code.py
```
This will ask for a question which you want to ask. You can give a question like **How is social support related to aging?**.
It will then ask about the Spanning Tree depth. You can give it a value of 2 or 3 for an optimal performance.
Enjoy

### On Subsequent Runs
Data is already prepared. We just need to chat and ask questions. Please perform the following steps:

1. Open an Anaconda Shell and navigate to the project directory.
2. Activate the kg-demo environment by issuing the below commands:
```bash
conda activate kg-demo
```
3. Run the following command:
```bash
python driver_code.py
```
This will ask for a question which you want to ask. You can give a question like **How is social support related to aging?**.
It will then ask about the Spanning Tree depth. You can give it a value of 2 or 3 for an optimal performance.

The answer for this question should be something as below:

**Social Support:Social factor Stress:Condition Diet:Lifestyle factor Physical Health:Condition Work Environment:Environment Job Satisfaction:Emotional state Aging:Condition Job Satisfaction:Condition Productivity:Condition Social Support:Activity Immune System:Biological system Cortisol:Hormone Cognitive Function:Function Immune System:System Diet:Activity Burnout:Condition Work Performance:Condition Heart Disease:Disease Cognitive Function:Condition Sleep Quality:Condition Inflammation:Biological process Social Support:Condition Productivity:Outcome Employee Turnover:Outcome Work Environment:Factor Diabetes:Disease Genetics:Biological factor Physical Activity:Activity Diet:Condition Obesity:Condition Heart Disease:Condition Social Support:Factor Social Relationships:Condition Sleep Quality:Health aspect Inflammation:Condition Diet:Factor Memory:Condition Blood Pressure:Condition Exercise:Activity Depression:Condition Anxiety:Condition Mental Health:Aspect Learning:Condition Sleep Quality:Aspect Stress:Concept Diet:Behavior Physical Health:Health aspect Anxiety:Emotional state Anxiety:Mental condition Depression:Mental condition Depression:Emotional state Physical Activity:Behavior Job Satisfaction:Psychological factor Mental Health:Health aspect Mental Health:Condition -----------
Social support is related to aging through its impact on stress. Social support reduces stress, and since stress accelerates aging, having social support can indirectly slow down the aging process by reducing the level of stress experienced by individuals.**
