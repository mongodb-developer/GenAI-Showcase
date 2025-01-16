from collections import defaultdict 
def addEdge(graph,u,v): 
    graph[u].append(v) 
def generate_edges(graph): 
    edges = [] 
  
    # for each node in graph 
    for node in graph: 
          
        # for each neighbour node of a single node 
        for neighbour in graph[node]: 
              
            # if edge exists then append 
            edges.append((node, neighbour)) 
    return edges

def build_graph(level_dict):
    graph = defaultdict(list)
    relationship_names = defaultdict(set)
    for level in level_dict.keys():
        #print(f'Level is {level}')
        for source,targets in level_dict[level].items():
            #print(f'Source is {source} and targets are {targets}')
            for _,relationships in targets.items():
                #print(f'Target Node {target_node} and relationships {relationships}')
                for target_node, edges in relationships.items():
                    addEdge(graph,source,target_node)
                    relationship_key = (source,target_node)
                    for edge in edges:
                        relationship_names[relationship_key].add(edge)
    return graph,relationship_names