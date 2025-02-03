def depth_first_search(graph,start,relationship_names,path):
    visited = []
    stack = []
    parent = []
    nodes = []
    links = []
    stack.append(start)
    visited.append(start)
    i = 0
    while stack:
        s=stack.pop()
        print(s,end=" ")
        node = {'id':s,'group':0,'level':1,'label':s.split(":")[0]+' from '+s.split(":")[1]}
        nodes.append(node)
        if i!=0:
            parent_node = parent[-1]
            parent_name=''
            current_child_count=0
            for x,y in parent_node.items():
                parent_name=x
                current_child_count=y
            relationships = relationship_names[(parent_name,s)]
            #print(f'{relationships}')
            rel_names=''
            j=0
            if relationships:
                for rel in relationships:
                    if j!=len(relationships)-1:
                        rel_names+=rel+" / "
                    else:
                        rel_names+=rel
                    j+=1
                path+= f'{parent_name.split(":")[0]} ({rel_names}) {s.split(":")[0]}, '
                link = {'source':parent_name,'target':s,'strength':0.7,'linkName':rel_names}
                links.append(link)
            current_child_count -= 1
            if current_child_count == 0:
                parent.pop()
            else:
                parent[-1][parent_name]=current_child_count
        k=0
        for x in graph[s][::-1]:
            if x not in visited:
                visited.append(x)
                stack.append(x)
                k+=1
        if k > 0:
            parent.append({s:k})
        i+=1
    return path,nodes,links